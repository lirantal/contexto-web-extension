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
  resetDatabaseForTests,
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
});
