import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextoDatabase } from '@/src/data/db';
import {
  addNote,
  assignFolder,
  assignTag,
  captureBookmark,
  deleteAccount,
  ensureAccountFromProfile,
  exportBackup,
  findBookmarkByPost,
  getAccountByHandle,
  getLookups,
  importBackup,
  listAccountSummaries,
  listBookmarks,
  listTargetAccountSuggestions,
  markAccountCaughtUp,
  removeBookmark,
  removeFolder,
  removeTag,
  recordSearch,
  resetDatabaseForTests,
  saveAccountContext,
  updateAccount,
  updateBookmark,
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
        role: '  Security engineer  ',
        companyName: 'Example Corp',
        location: 'Berlin',
        relationshipSource: 'Met at a conference',
      },
      database,
    );

    expect(updated.company?.name).toBe('Example Corp');
    expect(updated.role).toBe('Security engineer');
    expect(await listAccountSummaries({ query: 'security engineer' }, database)).toHaveLength(1);
    const exported = (await exportBackup(database)).data.accounts[0];
    expect(exported).toMatchObject({ role: 'Security engineer' });
    expect(exported).not.toHaveProperty('profession');
    expect(exported).not.toHaveProperty('position');
    expect(await getAccountByHandle('x', '@exampledev', database)).toMatchObject({ id: account.id });
  });

  it('advances an explicit catch-up checkpoint and preserves it in backups', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'CatchUp', displayName: 'Catch Up', profileUrl: 'https://x.com/catchup' },
      database,
    );

    const updated = await markAccountCaughtUp(account.id, database, '2026-07-16T10:15:00.000Z');

    expect(updated).toMatchObject({
      id: account.id,
      lastCatchUpAt: '2026-07-16T10:15:00.000Z',
      updatedAt: '2026-07-16T10:15:00.000Z',
      syncState: 'pending-sync',
    });
    const backup = await exportBackup(database);
    expect(backup.data.accounts[0].lastCatchUpAt)
      .toBe('2026-07-16T10:15:00.000Z');
    expect(await database.changeLog.where('entityType').equals('account').count()).toBe(2);

    await resetDatabaseForTests(database);
    await importBackup(backup, database);
    expect((await getAccountByHandle('x', 'catchup', database))?.lastCatchUpAt)
      .toBe('2026-07-16T10:15:00.000Z');
  });

  it('rolls back a catch-up checkpoint when change recording fails', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'RollbackCatchUp', displayName: 'Rollback', profileUrl: 'https://x.com/rollbackcatchup' },
      database,
    );
    const addChange = vi.spyOn(database.changeLog, 'add');

    try {
      addChange.mockRejectedValueOnce(new Error('change log failure'));
      await expect(markAccountCaughtUp(
        account.id,
        database,
        '2026-07-16T10:15:00.000Z',
      )).rejects.toThrow('change log failure');
      const unchanged = await database.accounts.get(account.id);
      expect(unchanged?.updatedAt).toBe(account.updatedAt);
      expect(unchanged).not.toHaveProperty('lastCatchUpAt');
    } finally {
      addChange.mockRestore();
    }
  });

  it('discards legacy profession and position values during the database upgrade', async () => {
    const name = `ContextoLegacyRoleMigration-${globalThis.crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      accounts:
        'id, &[platform+normalizedHandle], platform, normalizedHandle, displayName, companyId, profession, position, location, updatedAt, deletedAt',
    });
    await legacy.table('accounts').put({
      id: 'account_legacy',
      platform: 'x',
      handle: 'legacy',
      normalizedHandle: 'legacy',
      displayName: 'Legacy User',
      profileUrl: 'https://x.com/legacy',
      profession: 'Developer',
      position: 'CTO',
      location: 'Berlin',
      syncState: 'local-only',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    legacy.close();

    const upgraded = new ContextoDatabase(name);
    try {
      const account = await upgraded.accounts.get('account_legacy');
      expect(account).toMatchObject({ displayName: 'Legacy User', location: 'Berlin' });
      expect(account).not.toHaveProperty('profession');
      expect(account).not.toHaveProperty('position');
      expect(account).not.toHaveProperty('role');
    } finally {
      await upgraded.delete();
    }
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

  it('removes account tag and folder assignments without deleting shared lookups', async () => {
    const first = await ensureAccountFromProfile(
      { platform: 'x', handle: 'First', displayName: 'First', profileUrl: 'https://x.com/first' },
      database,
    );
    const second = await ensureAccountFromProfile(
      { platform: 'x', handle: 'Second', displayName: 'Second', profileUrl: 'https://x.com/second' },
      database,
    );
    const assignedFirst = await assignFolder(first.id, 'Friends', database);
    const withBoth = await assignTag(first.id, 'founder', database);
    await assignFolder(second.id, 'Friends', database);
    await assignTag(second.id, 'founder', database);

    const withoutTag = await removeTag(first.id, withBoth.tags[0].id, database);
    const withoutFolder = await removeFolder(first.id, assignedFirst.folders[0].id, database);

    expect(withoutTag.tags).toEqual([]);
    expect(withoutFolder.folders).toEqual([]);
    const secondSummary = await getAccountByHandle('x', 'second', database);
    expect(secondSummary?.tags.map(({ name }) => name)).toEqual(['founder']);
    expect(secondSummary?.folders.map(({ name }) => name)).toEqual(['Friends']);
    const lookups = await getLookups(database);
    expect(lookups.tags.map(({ name }) => name)).toContain('founder');
    expect(lookups.folders.map(({ name }) => name)).toContain('Friends');
  });

  it('permanently deletes account-owned data while retaining shared lookups and other accounts', async () => {
    const first = await ensureAccountFromProfile(
      { platform: 'x', handle: 'first', displayName: 'First', profileUrl: 'https://x.com/first' },
      database,
    );
    const second = await ensureAccountFromProfile(
      { platform: 'x', handle: 'second', displayName: 'Second', profileUrl: 'https://x.com/second' },
      database,
    );
    await updateAccount(first.id, { companyName: 'Shared Co', role: 'Engineer' }, database);
    await updateAccount(second.id, { companyName: 'Shared Co' }, database);
    await assignTag(first.id, 'Shared tag', database);
    await assignTag(second.id, 'Shared tag', database);
    await assignFolder(first.id, 'Shared folder', database);
    await assignFolder(second.id, 'Shared folder', database);
    const firstNote = await addNote(first.id, 'Private note', database);
    await addNote(second.id, 'Keep this note', database);
    const firstBookmark = await captureBookmark(first.id, {
      authorHandle: 'first', postUrl: 'https://x.com/first/status/1', reminder: 'Private reminder',
    }, database);
    await captureBookmark(second.id, {
      authorHandle: 'second', postUrl: 'https://x.com/second/status/2',
    }, database);
    await removeBookmark(firstBookmark.id, database);
    await recordSearch(
      { viewerHandle: 'me', targetHandle: 'first', direction: 'from-profile' },
      'https://x.com/search?q=from%3Afirst',
      first.id,
      database,
    );
    await recordSearch(
      { viewerHandle: 'me', targetHandle: 'second', direction: 'from-profile' },
      'https://x.com/search?q=from%3Asecond',
      second.id,
      database,
    );

    await deleteAccount(first.id, database);

    expect(await database.accounts.get(first.id)).toBeUndefined();
    expect(await getAccountByHandle('x', 'first', database)).toBeUndefined();
    expect(await database.accountTags.where('accountId').equals(first.id).count()).toBe(0);
    expect(await database.folderAccounts.where('accountId').equals(first.id).count()).toBe(0);
    expect(await database.notes.where('accountId').equals(first.id).count()).toBe(0);
    expect(await database.bookmarks.where('accountId').equals(first.id).count()).toBe(0);
    expect(await database.searchHistory.where('accountId').equals(first.id).count()).toBe(0);
    expect((await listAccountSummaries({}, database)).map(({ id }) => id)).toEqual([second.id]);
    expect((await getAccountByHandle('x', 'second', database))?.tags.map(({ name }) => name)).toEqual(['Shared tag']);
    expect((await getAccountByHandle('x', 'second', database))?.folders.map(({ name }) => name)).toEqual(['Shared folder']);
    expect((await getLookups(database)).companies.map(({ name }) => name)).toEqual(['Shared Co']);
    expect((await getLookups(database)).tags.map(({ name }) => name)).toEqual(['Shared tag']);
    expect((await getLookups(database)).folders.map(({ name }) => name)).toEqual(['Shared folder']);

    const remainingChanges = await database.changeLog.toArray();
    expect(remainingChanges).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: first.id }),
      expect.objectContaining({ entityId: firstNote.latestNote?.id }),
      expect.objectContaining({ entityId: firstBookmark.id }),
    ]));
  });

  it('lists distinct active saved locations as reusable lookups', async () => {
    const locations = [
      ['berlin-primary', ' Berlin '],
      ['berlin-duplicate', 'berlin'],
      ['san-francisco', 'San Francisco'],
      ['blank-location', '   '],
      ['deleted-location', 'London'],
    ] as const;

    for (const [handle, location] of locations) {
      const account = await ensureAccountFromProfile(
        { platform: 'x', handle, displayName: handle, profileUrl: `https://x.com/${handle}` },
        database,
      );
      await database.accounts.update(account.id, {
        location,
        ...(handle === 'deleted-location' ? { deletedAt: '2026-07-12T00:00:00.000Z' } : {}),
      });
    }

    expect((await getLookups(database)).locations).toEqual(['Berlin', 'San Francisco']);
  });

  it('rolls back assignment removal when change recording fails', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'Rollback', displayName: 'Rollback', profileUrl: 'https://x.com/rollback' },
      database,
    );
    const withTag = await assignTag(account.id, 'founder', database);
    const withFolder = await assignFolder(account.id, 'Friends', database);
    const addChange = vi.spyOn(database.changeLog, 'add');

    try {
      addChange.mockRejectedValueOnce(new Error('change log failure'));
      await expect(removeTag(account.id, withTag.tags[0].id, database))
        .rejects.toThrow('change log failure');
      expect((await getAccountByHandle('x', account.handle, database))?.tags)
        .toHaveLength(1);

      addChange.mockRejectedValueOnce(new Error('change log failure'));
      await expect(removeFolder(account.id, withFolder.folders[0].id, database))
        .rejects.toThrow('change log failure');
      expect((await getAccountByHandle('x', account.handle, database))?.folders)
        .toHaveLength(1);
    } finally {
      addChange.mockRestore();
    }
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
    const bookmark = await captureBookmark(account.id, {
      authorHandle: 'backupuser',
      postUrl: 'https://twitter.com/BackupUser/status/123?ref=home',
      excerpt: 'Backup   release',
      reminder: 'Restore this',
    }, database);
    const handled = await updateBookmark(
      bookmark.id,
      { completed: true },
      database,
      '2026-07-16T12:00:00.000Z',
    );

    const backup = await exportBackup(database);
    expect(backup.formatVersion).toBe(2);
    expect(backup.data.bookmarks).toEqual([handled]);
    await resetDatabaseForTests(database);

    const invalidCompletion = {
      ...backup,
      data: {
        ...backup.data,
        bookmarks: [{ ...handled, completedAt: 'not-a-timestamp' }],
      },
    };
    await expect(importBackup(invalidCompletion, database)).rejects.toThrow('Backup bookmark is invalid');
    expect(await database.bookmarks.count()).toBe(0);

    await importBackup(backup, database);

    expect(await listAccountSummaries({}, database)).toHaveLength(1);
    expect(await listBookmarks(account.id, database)).toEqual([handled]);
  });

  it('captures, deduplicates, removes, and restores contact bookmarks', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'Theo', displayName: 'Theo', profileUrl: 'https://x.com/theo' },
      database,
    );
    const first = await captureBookmark(account.id, {
      authorHandle: 'theo',
      postUrl: 'https://twitter.com/Theo/status/123?ref=home',
      excerpt: ' Release   update ',
      reminder: ' Possible  podcast guest \n Follow up ',
    }, database);

    expect(first).toMatchObject({
      accountId: account.id,
      platform: 'x',
      postId: '123',
      postUrl: 'https://x.com/theo/status/123',
      excerpt: 'Release update',
      reminder: 'Possible podcast guest\nFollow up',
    });
    expect(await findBookmarkByPost(account.id, 'https://x.com/theo/status/123', database)).toEqual(first);
    expect(await captureBookmark(account.id, {
      authorHandle: 'theo',
      postUrl: first.postUrl,
      reminder: 'Do not replace an active duplicate',
    }, database)).toEqual(first);
    expect(await database.bookmarks.count()).toBe(1);

    await database.bookmarks.update(first.id, { completedAt: '2026-07-15T12:00:00.000Z' });
    await removeBookmark(first.id, database);
    expect(await listBookmarks(account.id, database)).toEqual([]);
    expect((await database.bookmarks.get(first.id))?.deletedAt).toBeDefined();

    const restored = await captureBookmark(account.id, {
      authorHandle: 'theo',
      postUrl: first.postUrl,
      excerpt: 'Updated excerpt',
      reminder: 'Updated reminder',
    }, database);
    expect(restored).toMatchObject({
      id: first.id,
      createdAt: first.createdAt,
      excerpt: 'Updated excerpt',
      reminder: 'Updated reminder',
      completedAt: undefined,
      deletedAt: undefined,
    });
    expect(restored.capturedAt >= first.capturedAt).toBe(true);
    expect(await database.changeLog.where('entityType').equals('bookmark').count()).toBe(3);
    expect((await database.accounts.get(account.id))?.syncState).toBe('pending-sync');
  });

  it('validates bookmark ownership, URL shape, and bounded text', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo' },
      database,
    );

    await expect(captureBookmark(account.id, {
      authorHandle: 'other', postUrl: 'https://x.com/theo/status/123',
    }, database)).rejects.toThrow('Bookmark author does not match');
    await expect(captureBookmark(account.id, {
      authorHandle: 'theo', postUrl: 'https://x.com/other/status/123',
    }, database)).rejects.toThrow('Bookmark author does not match');
    await expect(captureBookmark(account.id, {
      authorHandle: 'theo', postUrl: 'https://example.com/theo/status/123',
    }, database)).rejects.toThrow('valid X post');
    await expect(captureBookmark(account.id, {
      authorHandle: 'theo', postUrl: 'https://x.com/theo/status/123', excerpt: 'x'.repeat(281),
    }, database)).rejects.toThrow('Excerpt must be 280');
    await expect(captureBookmark(account.id, {
      authorHandle: 'theo', postUrl: 'https://x.com/theo/status/123', reminder: 'x'.repeat(501),
    }, database)).rejects.toThrow('Reminder must be 500');
    expect(await database.bookmarks.count()).toBe(0);
  });

  it('edits bookmark reminders and toggles handled state without removing the source', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo' },
      database,
    );
    const captured = await captureBookmark(account.id, {
      authorHandle: 'theo',
      postUrl: 'https://x.com/theo/status/123',
      reminder: 'Original reminder',
    }, database);

    const handled = await updateBookmark(captured.id, {
      reminder: '  Invite after launch \n Follow up  ',
      completed: true,
    }, database, '2026-07-16T12:00:00.000Z');
    expect(handled).toMatchObject({
      id: captured.id,
      postUrl: captured.postUrl,
      reminder: 'Invite after launch\nFollow up',
      completedAt: '2026-07-16T12:00:00.000Z',
      updatedAt: '2026-07-16T12:00:00.000Z',
    });
    expect(await findBookmarkByPost(account.id, captured.postUrl, database)).toEqual(handled);
    expect(await listBookmarks(account.id, database)).toEqual([handled]);

    const reopened = await updateBookmark(
      captured.id,
      { reminder: '', completed: false },
      database,
      '2026-07-16T12:05:00.000Z',
    );
    expect(reopened.reminder).toBeUndefined();
    expect(reopened.completedAt).toBeUndefined();
    expect(reopened.updatedAt).toBe('2026-07-16T12:05:00.000Z');
    expect((await database.accounts.get(account.id))?.syncState).toBe('pending-sync');
    expect(await database.changeLog.where('entityType').equals('bookmark').count()).toBe(3);
  });

  it('rejects invalid or removed bookmark updates', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo' },
      database,
    );
    const bookmark = await captureBookmark(account.id, {
      authorHandle: 'theo', postUrl: 'https://x.com/theo/status/123',
    }, database);

    await expect(updateBookmark(bookmark.id, { reminder: 'x'.repeat(501) }, database))
      .rejects.toThrow('Reminder must be 500');
    await removeBookmark(bookmark.id, database);
    await expect(updateBookmark(bookmark.id, { completed: true }, database))
      .rejects.toThrow('Bookmark not found');
    await expect(updateBookmark('missing', { completed: true }, database))
      .rejects.toThrow('Bookmark not found');
  });

  it('rolls back bookmark edits when change recording fails', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo' },
      database,
    );
    const bookmark = await captureBookmark(account.id, {
      authorHandle: 'theo', postUrl: 'https://x.com/theo/status/123', reminder: 'Original',
    }, database);
    const accountBefore = await database.accounts.get(account.id);
    const addChange = vi.spyOn(database.changeLog, 'add');

    try {
      addChange.mockRejectedValueOnce(new Error('change log failure'));
      await expect(updateBookmark(
        bookmark.id,
        { reminder: 'Changed', completed: true },
        database,
        '2026-07-16T12:00:00.000Z',
      )).rejects.toThrow('change log failure');
      expect(await database.bookmarks.get(bookmark.id)).toEqual(bookmark);
      expect(await database.accounts.get(account.id)).toEqual(accountBefore);
    } finally {
      addChange.mockRestore();
    }
  });

  it('lists active bookmarks by account and captured recency', async () => {
    const firstAccount = await ensureAccountFromProfile(
      { platform: 'x', handle: 'first', displayName: 'First', profileUrl: 'https://x.com/first' },
      database,
    );
    const secondAccount = await ensureAccountFromProfile(
      { platform: 'x', handle: 'second', displayName: 'Second', profileUrl: 'https://x.com/second' },
      database,
    );
    const older = await captureBookmark(firstAccount.id, {
      authorHandle: 'first', postUrl: 'https://x.com/first/status/1',
    }, database);
    const newer = await captureBookmark(firstAccount.id, {
      authorHandle: 'first', postUrl: 'https://x.com/first/status/2',
    }, database);
    await captureBookmark(secondAccount.id, {
      authorHandle: 'second', postUrl: 'https://x.com/second/status/3',
    }, database);
    await database.bookmarks.update(older.id, { capturedAt: '2026-07-10T00:00:00.000Z' });
    await database.bookmarks.update(newer.id, { capturedAt: '2026-07-11T00:00:00.000Z' });

    expect((await listBookmarks(firstAccount.id, database)).map(({ id }) => id)).toEqual([newer.id, older.id]);
  });

  it('imports legacy backups without bookmarks and rejects orphaned version 2 bookmarks atomically', async () => {
    const account = await ensureAccountFromProfile(
      { platform: 'x', handle: 'legacy', displayName: 'Legacy', profileUrl: 'https://x.com/legacy' },
      database,
    );
    const backup = await exportBackup(database);
    const legacyData = { ...backup.data } as Record<string, unknown>;
    delete legacyData.bookmarks;
    await resetDatabaseForTests(database);
    await importBackup({ ...backup, formatVersion: 1, data: legacyData } as never, database);
    expect(await listBookmarks(account.id, database)).toEqual([]);

    await resetDatabaseForTests(database);
    const orphaned = {
      ...backup,
      data: {
        ...backup.data,
        bookmarks: [{
          id: 'bookmark_orphan', accountId: 'missing', platform: 'x' as const, postId: '123',
          postUrl: 'https://x.com/legacy/status/123', capturedAt: '2026-07-12T00:00:00.000Z',
          createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
        }],
      },
    };
    await expect(importBackup(orphaned, database)).rejects.toThrow('owning account');
    expect(await database.accounts.count()).toBe(0);
    expect(await database.bookmarks.count()).toBe(0);
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
        role: 'CTO',
        companyName: 'Example Corp',
        location: 'Berlin',
        relationshipSource: 'Conference',
      },
      tagNames: ['Security', 'Founder'],
      folderNames: ['Friends', 'Speakers'],
    }, database);

    expect(first).toMatchObject({ displayName: 'Saved Name', role: 'CTO' });
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
        role: 'CTO',
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
