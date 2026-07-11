import { afterEach, describe, expect, it } from 'vitest';
import { ContextoDatabase } from '@/src/data/db';
import {
  addNote,
  assignFolder,
  assignTag,
  ensureAccountFromProfile,
  exportBackup,
  getAccountByHandle,
  importBackup,
  listAccountSummaries,
  listTargetAccountSuggestions,
  resetDatabaseForTests,
  saveAccountContext,
  updateAccount,
} from '@/src/data/repositories';

const database = new ContextoDatabase('ContextoTestDatabase');

afterEach(async () => {
  await resetDatabaseForTests(database);
});

describe('Contexto repositories', () => {
  it('creates and enriches accounts from profile snapshots', async () => {
    const account = await ensureAccountFromProfile(
      {
        platform: 'x',
        handle: 'ExampleDev',
        displayName: 'Example Dev',
        profileUrl: 'https://x.com/exampledev',
      },
      database,
    );

    const updated = await updateAccount(
      account.id,
      {
        profession: 'Security engineer',
        companyName: 'Example Corp',
        location: 'Berlin',
        relationshipSource: 'Met at a conference',
      },
      database,
    );

    expect(updated.company?.name).toBe('Example Corp');
    expect(updated.profession).toBe('Security engineer');
    expect(await getAccountByHandle('x', '@exampledev', database)).toMatchObject({ id: account.id });
  });

  it('assigns folders, tags, and notes for dashboard search', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'Builder', displayName: 'Builder', profileUrl: 'https://x.com/builder' },
      database,
    );
    await assignTag(account.id, 'security', database);
    await assignFolder(account.id, 'DevRel friends', database);
    await addNote(account.id, 'Talked about supply chain security.', database);

    const summaries = await listAccountSummaries({ query: 'supply chain' }, database);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].tags.map((tag) => tag.name)).toContain('security');
    expect(summaries[0].folders.map((folder) => folder.name)).toContain('DevRel friends');
  });

  it('lists active X accounts as lightweight suggestions ordered by recency', async () => {
    const alice = await ensureAccountFromProfile(
      { platform: 'x', handle: 'alice', displayName: 'Alice', profileUrl: 'https://x.com/alice' },
      database,
    );
    await updateAccount(alice.id, { companyName: 'Acme' }, database);
    const bob = await ensureAccountFromProfile(
      { platform: 'x', handle: 'bob', displayName: 'Bob', profileUrl: 'https://x.com/bob' },
      database,
    );
    const deleted = await ensureAccountFromProfile(
      { platform: 'x', handle: 'deleted', displayName: 'Deleted', profileUrl: 'https://x.com/deleted' },
      database,
    );
    await database.accounts.add({
      id: 'account_linkedin',
      platform: 'linkedin',
      handle: 'linked-person',
      normalizedHandle: 'linked-person',
      displayName: 'Linked Person',
      profileUrl: 'https://linkedin.com/in/linked-person',
      syncState: 'local-only',
      createdAt: '2026-07-09T00:00:00Z',
      updatedAt: '2026-07-09T00:00:00Z',
    });
    await database.accounts.update(alice.id, { updatedAt: '2026-07-10T00:00:00Z' });
    await database.accounts.update(bob.id, { updatedAt: '2026-07-11T00:00:00Z' });
    await database.accounts.update(deleted.id, { deletedAt: '2026-07-12T00:00:00Z' });

    await expect(listTargetAccountSuggestions(database)).resolves.toEqual([
      {
        id: bob.id,
        handle: 'bob',
        displayName: 'Bob',
        companyName: undefined,
        updatedAt: '2026-07-11T00:00:00Z',
      },
      {
        id: alice.id,
        handle: 'alice',
        displayName: 'Alice',
        companyName: 'Acme',
        updatedAt: '2026-07-10T00:00:00Z',
      },
    ]);
  });

  it('round-trips backup data', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'BackupUser', displayName: 'Backup User', profileUrl: 'https://x.com/backupuser' },
      database,
    );
    await assignTag(account.id, 'backup', database);

    const backup = await exportBackup(database);
    await resetDatabaseForTests(database);
    await importBackup(backup, database);

    expect(await listAccountSummaries({}, database)).toHaveLength(1);
  });

  it('keeps a missing-account lookup read-only', async () => {
    expect(await getAccountByHandle('x', '@unknown', database)).toBeUndefined();
    expect(await database.accounts.count()).toBe(0);
    expect(await database.changeLog.count()).toBe(0);
  });

  it('saves profile metadata, tags, and folders as complete sets', async () => {
    const first = await saveAccountContext({
      profile: {
        platform: 'x',
        handle: 'ExampleDev',
        displayName: 'X Display Name',
        profileUrl: 'https://x.com/exampledev',
        avatarUrl: 'https://example.com/avatar.png',
      },
      metadata: {
        displayName: 'Saved Name',
        profession: 'Developer',
        position: 'CTO',
        companyName: 'Example Corp',
        location: 'Berlin',
        relationshipSource: 'Conference',
      },
      tagNames: ['Security', 'Founder'],
      folderNames: ['Friends', 'Speakers'],
    }, database);

    expect(first).toMatchObject({ displayName: 'Saved Name', position: 'CTO' });
    expect(first.tags.map(({ name }) => name).sort()).toEqual(['Founder', 'Security']);
    expect(first.folders.map(({ name }) => name).sort()).toEqual(['Friends', 'Speakers']);

    const second = await saveAccountContext({
      profile: {
        platform: 'x',
        handle: 'ExampleDev',
        displayName: 'Changed on X',
        profileUrl: 'https://x.com/exampledev',
      },
      metadata: {
        displayName: 'Saved Name',
        profession: 'Developer',
        position: 'CTO',
        companyName: 'Example Corp',
        location: 'Berlin',
        relationshipSource: 'Conference',
      },
      tagNames: ['Founder'],
      folderNames: ['Speakers'],
    }, database);

    expect(second.displayName).toBe('Saved Name');
    expect(second.tags.map(({ name }) => name)).toEqual(['Founder']);
    expect(second.folders.map(({ name }) => name)).toEqual(['Speakers']);
  });

  it('rejects an explicit save whose X handle and profile URL disagree', async () => {
    await expect(saveAccountContext({
      profile: { platform: 'x', handle: 'wrong', displayName: 'Wrong', profileUrl: 'https://x.com/right' },
      metadata: { displayName: 'Wrong' },
      tagNames: [],
      folderNames: [],
    }, database)).rejects.toThrow('Profile handle does not match the X profile URL');
    expect(await database.accounts.count()).toBe(0);
    expect(await database.changeLog.count()).toBe(0);
  });

  it('falls back to the captured X display name when an explicit save submits a blank name', async () => {
    const saved = await saveAccountContext({
      profile: { platform: 'x', handle: 'exampledev', displayName: 'X Display Name', profileUrl: 'https://x.com/exampledev' },
      metadata: { displayName: '   ' },
      tagNames: [],
      folderNames: [],
    }, database);
    expect(saved.displayName).toBe('X Display Name');
  });
});
