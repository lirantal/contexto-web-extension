import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextoDatabase } from '../src/data/db';
import { backupTables } from '../src/data/backup-validation';
import {
  addNote, assignFolder, assignTag, captureBookmark, ensureAccountFromProfile, exportBackup,
  getAccountSummary, importBackup, previewBackup, resetDatabaseForTests, saveAccountContext,
  saveAccountGroupings, updateAccount,
} from '../src/data/repositories';
import type { BackupEnvelope } from '../src/shared/types';

const database = new ContextoDatabase('ContextoIntegrityTests');
const profile = { platform: 'x' as const, handle: 'example', profileUrl: 'https://x.com/example' };
const stamp = '2026-01-01T00:00:00.000Z';
afterEach(async () => { vi.restoreAllMocks(); await resetDatabaseForTests(database); });
async function populated() {
  const account = await saveAccountContext({ profile, metadata: { role: 'Engineer', companyName: 'Example Co', website: 'https://example.com' }, tagNames: ['API'], folderNames: ['Friends'] }, database);
  await addNote(account.id, 'Keep every field', database);
  await captureBookmark(account.id, { authorHandle: 'example', postUrl: 'https://x.com/example/status/123', reminder: 'Review' }, database);
  return account;
}

describe('lossless model evolution', () => {
  it.each([1, 2, 3])('upgrades version %s while retaining legacy, current, and unknown fields', async (version) => {
    const name = `IntegrityMigration-${version}`;
    const old = new Dexie(name);
    old.version(version).stores({ accounts: 'id, &[platform+normalizedHandle], platform, normalizedHandle' });
    await old.table('accounts').add({ id: 'legacy', ...profile, normalizedHandle: 'example', displayName: 'Example',
      profession: 'Engineer', position: 'CTO', createdAt: stamp, updatedAt: stamp, syncState: 'local-only', futureField: { context: 'keep' } });
    old.close();
    const upgraded = new ContextoDatabase(name);
    try {
      expect(await upgraded.accounts.get('legacy')).toMatchObject({ role: 'CTO · Engineer', profession: 'Engineer', position: 'CTO', futureField: { context: 'keep' }, createdAt: stamp });
    } finally { await upgraded.delete(); }
  });
  it('retains an explicitly saved role and every legacy field on backup import', async () => {
    await populated();
    const backup = await exportBackup(database);
    Object.assign(backup.data.accounts[0], { role: 'Saved role', profession: 'Engineer', position: 'CTO', futureField: ['keep'] });
    await resetDatabaseForTests(database);
    await importBackup(backup, database);
    expect(await database.accounts.get(backup.data.accounts[0].id)).toMatchObject({ role: 'Saved role', profession: 'Engineer', position: 'CTO', futureField: ['keep'] });
  });
  it('exports every table and round-trips all stored fields including unknown additions', async () => {
    const account = await populated();
    await database.table('accounts').update(account.id, { extra: { meaning: 'future field' }, lastCatchUpAt: stamp });
    await database.searchPresets.add({ id: 'preset', name: 'Search', platform: 'x', filters: { direction: 'from-profile' }, createdAt: stamp, updatedAt: stamp });
    await database.searchHistory.add({ id: 'history', accountId: account.id, platform: 'x', query: 'from:example', url: 'https://x.com/search?q=from:example', filters: { direction: 'from-profile' }, createdAt: stamp });
    const backup = JSON.parse(JSON.stringify(await exportBackup(database))) as BackupEnvelope;
    expect(Object.keys(backup.data).sort()).toEqual(database.tables.map((table) => table.name).sort());
    await resetDatabaseForTests(database);
    await importBackup(backup, database);
    const restored = await exportBackup(database);
    for (const table of backupTables) {
      for (const row of backup.data[table]) expect(restored.data[table]).toContainEqual(row);
      if (!['backups', 'changeLog'].includes(table)) expect(restored.data[table]).toEqual(backup.data[table]);
    }
  });
  it('exports a consistent cross-table snapshot while a writer updates both tables', async () => {
    const account = await populated();
    for (let count = 0; count < 5; count++) {
      const [backup] = await Promise.all([
        exportBackup(database),
        database.transaction('rw', [database.accounts, database.companies], async () => {
          await database.accounts.update(account.id, { role: `Revision ${count}` });
          await database.companies.update(account.companyId!, { notes: `Revision ${count}` });
        }),
      ]);
      const role = backup.data.accounts[0].role;
      if (role?.startsWith('Revision')) expect(backup.data.companies[0].notes).toBe(role);
      else expect(backup.data.companies[0].notes).toBeUndefined();
    }
  });
});

describe('atomic writes', () => {
  it('rolls back a failed note save and permits a single-copy retry', async () => {
    const account = await populated();
    const before = (await exportBackup(database)).data;
    const failure = vi.spyOn(database.changeLog, 'add').mockRejectedValueOnce(new Error('log failed'));
    await expect(addNote(account.id, 'Retry me', database)).rejects.toThrow('log failed');
    expect((await exportBackup(database)).data).toEqual(before);
    failure.mockRestore();
    await addNote(account.id, 'Retry me', database);
    expect((await database.notes.toArray()).filter((note) => note.body === 'Retry me')).toHaveLength(1);
  });
  it('rolls back profile creation when logging fails', async () => {
    vi.spyOn(database.changeLog, 'add').mockRejectedValueOnce(new Error('log failed'));
    await expect(ensureAccountFromProfile(profile, database)).rejects.toThrow('log failed');
    expect(await database.accounts.count()).toBe(0);
  });
  it('rolls back metadata, company, and pending tag if a later circle save fails', async () => {
    const account = await populated();
    const before = (await exportBackup(database)).data;
    vi.spyOn(database.folderAccounts, 'add').mockRejectedValueOnce(new Error('circle failed'));
    await expect(updateAccount(account.id, { role: 'New role', companyName: 'New Co', addTagNames: ['New tag'], addFolderNames: ['New circle'] }, database)).rejects.toThrow('circle failed');
    expect((await exportBackup(database)).data).toEqual(before);
  });
  it.each(['note', 'tag', 'circle'])('rejects %s writes for missing and inactive contacts', async (kind) => {
    const account = await ensureAccountFromProfile(profile, database);
    const write = (id: string) => kind === 'note' ? addNote(id, 'note', database) : kind === 'tag' ? assignTag(id, 'Tag', database) : assignFolder(id, 'Circle', database);
    await expect(write('missing')).rejects.toThrow('Account not found');
    await database.accounts.update(account.id, { deletedAt: stamp });
    await expect(write(account.id)).rejects.toThrow('Account not found');
    expect(await database.notes.count()).toBe(0); expect(await database.tags.count()).toBe(0); expect(await database.folders.count()).toBe(0);
  });
});

describe('safe backup import and restore', () => {
  it.each([
    ['note owner', (b: BackupEnvelope) => { b.data.notes[0].accountId = 'missing'; }],
    ['company reference', (b: BackupEnvelope) => { b.data.accounts[0].companyId = 'missing'; }],
    ['tag reference', (b: BackupEnvelope) => { b.data.accountTags[0].tagId = 'missing'; }],
    ['circle reference', (b: BackupEnvelope) => { b.data.folderAccounts[0].folderId = 'missing'; }],
    ['account timestamp', (b: BackupEnvelope) => { b.data.accounts[0].createdAt = 'bad'; }],
    ['note body', (b: BackupEnvelope) => { (b.data.notes[0] as unknown as { body: number }).body = 123; }],
    ['duplicate ID', (b: BackupEnvelope) => { b.data.notes.push({ ...b.data.notes[0] }); }],
    ['normalized identity', (b: BackupEnvelope) => { b.data.accounts[0].normalizedHandle = 'other'; }],
    ['missing table', (b: BackupEnvelope) => { delete (b.data as Partial<BackupEnvelope['data']>).notes; }],
    ['unknown table', (b: BackupEnvelope) => { Object.assign(b.data, { futureTable: [] }); }],
  ] as const)('rejects invalid %s without changing local data', async (_label, mutate) => {
    await populated();
    const before = (await exportBackup(database)).data;
    const backup = structuredClone(await exportBackup(database)); mutate(backup);
    await expect(importBackup(backup, database)).rejects.toThrow();
    expect((await exportBackup(database)).data).toEqual(before);
  });
  it('refuses to overwrite newer fields with an old backup', async () => {
    const account = await populated(); const old = await exportBackup(database);
    await updateAccount(account.id, { role: 'Newest', website: 'https://new.example' }, database);
    const before = (await exportBackup(database)).data;
    expect((await previewBackup(old, database)).conflicts).toBeGreaterThan(0);
    await expect(importBackup(old, database)).rejects.toThrow('conflicts');
    expect((await exportBackup(database)).data).toEqual(before);
  });
  it('rejects same-identity/different-ID merges atomically', async () => {
    await ensureAccountFromProfile(profile, database); const backup = await exportBackup(database);
    backup.data.accounts[0].id = 'different';
    await expect(importBackup(backup, database)).rejects.toThrow('conflicts');
    expect(await database.accounts.count()).toBe(1);
  });
  it('restores exactly the backup graph, removing records absent from the file', async () => {
    const account = await populated(); const backup = await exportBackup(database);
    await updateAccount(account.id, { role: 'Later' }, database);
    await ensureAccountFromProfile({ platform: 'x', handle: 'later', profileUrl: 'https://x.com/later' }, database);
    const preview = await previewBackup(backup, database);
    await importBackup(backup, database, { mode: 'restore', expectedDatabaseRevision: preview.databaseRevision });
    expect(await database.accounts.toArray()).toEqual(backup.data.accounts);
    expect(await database.notes.toArray()).toEqual(backup.data.notes);
  });
  it('rejects a restore without preview and stale previews in either mode', async () => {
    const account = await populated(); const backup = await exportBackup(database);
    await expect(importBackup(backup, database, { mode: 'restore' })).rejects.toThrow('Preview');
    const preview = await previewBackup(backup, database);
    await addNote(account.id, 'Saved after preview', database);
    const before = (await exportBackup(database)).data;
    for (const mode of ['merge', 'restore'] as const) {
      await expect(importBackup(backup, database, { mode, expectedDatabaseRevision: preview.databaseRevision })).rejects.toThrow('Local data changed');
      expect((await exportBackup(database)).data).toEqual(before);
    }
  });
  it('rolls back clearing and imported rows on a late restore failure', async () => {
    const account = await populated(); const backup = await exportBackup(database);
    await updateAccount(account.id, { role: 'Newest' }, database);
    const before = (await exportBackup(database)).data;
    const preview = await previewBackup(backup, database);
    vi.spyOn(database.backups, 'add').mockRejectedValueOnce(new Error('metadata failed'));
    await expect(importBackup(backup, database, { mode: 'restore', expectedDatabaseRevision: preview.databaseRevision })).rejects.toThrow('metadata failed');
    expect((await exportBackup(database)).data).toEqual(before);
  });
});

describe('concurrent editor protection', () => {
  it('rejects stale metadata even when timestamps are equal', async () => {
    const original = await populated();
    const first = (await getAccountSummary(original.id, database))!;
    const second = await updateAccount(first.id, { role: 'New role', accountRevision: first.accountRevision }, database);
    await database.accounts.update(first.id, { updatedAt: first.updatedAt });
    const before = (await exportBackup(database)).data;
    await expect(updateAccount(first.id, { role: 'Old role', accountRevision: first.accountRevision }, database)).rejects.toThrow('Contact changed');
    expect((await exportBackup(database)).data).toEqual(before);
    const fresh = (await getAccountSummary(first.id, database))!;
    await expect(updateAccount(first.id, { location: 'New place', accountRevision: fresh.accountRevision }, database)).resolves.toMatchObject({ role: second.role });
  });
  it('rejects stale grouping replacement and full-context saves before any write', async () => {
    const original = await populated(); const baseline = (await getAccountSummary(original.id, database))!;
    await assignTag(original.id, 'Added elsewhere', database);
    const before = (await exportBackup(database)).data;
    await expect(saveAccountGroupings(original.id, ['API'], [], database, baseline.groupingRevision, baseline.accountRevision)).rejects.toThrow('Contact changed');
    await expect(saveAccountContext({ profile, metadata: { role: 'Stale' }, tagNames: [], folderNames: [], accountRevision: baseline.accountRevision }, database)).rejects.toThrow('Contact changed');
    expect((await exportBackup(database)).data).toEqual(before);
  });
  it('does not overwrite a contact created while an unsaved editor was open', async () => {
    await ensureAccountFromProfile(profile, database);
    await expect(saveAccountContext({ profile, metadata: {}, tagNames: [], folderNames: [], accountRevision: '' }, database)).rejects.toThrow('Contact changed');
  });
});

it('rejects direct identity mismatches, reused X IDs, and missing company references without mutation', async () => {
  const account = await ensureAccountFromProfile({ ...profile, xUserId: '1234567890123456789' }, database);
  const before = (await exportBackup(database)).data;
  await expect(ensureAccountFromProfile({ ...profile, profileUrl: 'https://x.com/someoneelse' }, database)).rejects.toThrow('Profile handle');
  await expect(ensureAccountFromProfile({ platform: 'x', handle: 'another', profileUrl: 'https://x.com/another', xUserId: '1234567890123456789' }, database)).rejects.toThrow('another saved handle');
  await expect(updateAccount(account.id, { companyId: 'missing' }, database)).rejects.toThrow('Company not found');
  expect((await exportBackup(database)).data).toEqual(before);
});
