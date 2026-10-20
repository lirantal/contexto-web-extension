import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextoDatabase } from '@/src/data/db';
import { listManagedGroupings, manageGrouping } from '@/src/data/grouping-management';
import { assignTag, assignFolder, ensureAccountFromProfile, exportBackup, getAccountSummary,
  getLookups, importBackup, resetDatabaseForTests, saveAccountContext, saveAccountGroupings } from '@/src/data/repositories';

const database = new ContextoDatabase('GroupingManagementTests');
afterEach(async () => { vi.restoreAllMocks(); await resetDatabaseForTests(database); });
async function account(handle: string) {
  return ensureAccountFromProfile({ platform: 'x', handle, profileUrl: `https://x.com/${handle}` }, database);
}

for (const kind of ['tag', 'folder'] as const) describe(`${kind} management`, () => {
  const assign = (id: string, name: string) => (kind === 'tag' ? assignTag : assignFolder)(id, name, database);
  const definitions = () => kind === 'tag' ? database.tags : database.folders;
  const values = (summary: NonNullable<Awaited<ReturnType<typeof getAccountSummary>>>) => kind === 'tag' ? summary.tags : summary.folders;
  async function fixture() {
    const first = await account('first');
    const second = await account('second');
    const other = await account('other');
    const source = values(await assign(first.id, 'Typo'))[0];
    await assign(second.id, 'Typo');
    const target = values(await assign(second.id, 'Correct')).find((value) => value.name === 'Correct')!;
    await assign(other.id, 'Correct');
    return { first, second, other, source, target, revision: (await listManagedGroupings(kind, database)).revision };
  }

  it('lists active contacts and unused definitions, excluding inactive contacts', async () => {
    const f = await fixture();
    await database.accounts.update(f.second.id, { deletedAt: new Date().toISOString() });
    await definitions().add({ id: 'unused', name: 'Unused', normalizedName: 'unused', createdAt: '', updatedAt: '' });
    const result = await listManagedGroupings(kind, database);
    expect(result.items.map((i) => [i.name, i.contacts.map((a) => a.handle)])).toEqual([
      ['Correct', ['other']], ['Typo', ['first']], ['Unused', []],
    ]);
  });

  it('renames globally while retaining identity and assignments', async () => {
    const f = await fixture();
    await manageGrouping(kind, f.source.id, { type: 'rename', name: ' Fixed   spelling ' }, f.revision, database);
    expect(await definitions().get(f.source.id)).toMatchObject({ name: 'Fixed spelling', normalizedName: 'fixed spelling', createdAt: f.source.createdAt });
    for (const contact of [f.first, f.second]) {
      const updated = (await getAccountSummary(contact.id, database))!;
      expect(values(updated)).toContainEqual(expect.objectContaining({ id: f.source.id, name: 'Fixed spelling' }));
      expect(updated.syncState).toBe('pending-sync');
    }
    expect((await getAccountSummary(f.other.id, database))!.updatedAt).toBe(f.other.updatedAt);
  });

  it('rejects blank and conflicting names and invalid merge destinations without writes', async () => {
    const f = await fixture();
    const before = (await exportBackup(database)).data;
    for (const action of [{ type: 'rename' as const, name: '  ' }, { type: 'rename' as const, name: '  CORRECT ' },
      { type: 'merge' as const, targetId: f.source.id }, { type: 'merge' as const, targetId: 'missing' }]) {
      await expect(manageGrouping(kind, f.source.id, action, f.revision, database)).rejects.toThrow();
    }
    expect((await exportBackup(database)).data).toEqual(before);
  });

  it('merges the union of assignments without duplicates and removes the source', async () => {
    const f = await fixture();
    await manageGrouping(kind, f.source.id, { type: 'merge', targetId: f.target.id }, f.revision, database);
    expect(await definitions().get(f.source.id)).toBeUndefined();
    for (const contact of [f.first, f.second, f.other]) {
      expect(values((await getAccountSummary(contact.id, database))!).map((v) => v.id)).toEqual([f.target.id]);
    }
    const joins = kind === 'tag' ? await database.accountTags.toArray() : await database.folderAccounts.toArray();
    expect(joins).toHaveLength(3);
    expect(await database.changeLog.where('entityId').equals(f.source.id).toArray()).toContainEqual(expect.objectContaining({ operation: 'delete' }));
  });

  it('hard deletes all joins, including inactive contacts, while retaining contacts and other data', async () => {
    const f = await fixture();
    await database.accounts.update(f.second.id, { deletedAt: new Date().toISOString() });
    await manageGrouping(kind, f.source.id, { type: 'delete' }, f.revision, database);
    expect(await definitions().get(f.source.id)).toBeUndefined();
    const joins = kind === 'tag' ? await database.accountTags.where('tagId').equals(f.source.id).count()
      : await database.folderAccounts.where('folderId').equals(f.source.id).count();
    expect(joins).toBe(0);
    expect(await database.accounts.count()).toBe(3);
    expect(await definitions().get(f.target.id)).toBeDefined();
    expect(values((await getAccountSummary(f.first.id, database))!)).toEqual([]);
    expect((await listManagedGroupings(kind, database)).items.map((i) => i.name)).toEqual(['Correct']);
  });

  it.each(['rename', 'merge', 'delete'] as const)('rolls back the whole %s on a late write failure', async (type) => {
    const f = await fixture();
    const before = (await exportBackup(database)).data;
    const add = database.changeLog.add.bind(database.changeLog);
    vi.spyOn(database.changeLog, 'add').mockImplementation((entry) => {
      if (entry.entityType === 'groupingCatalog') return Dexie.Promise.reject(new Error('Storage unavailable'));
      return add(entry);
    });
    await expect(manageGrouping(kind, f.source.id,
      type === 'rename' ? { type, name: 'Fixed' } : type === 'merge' ? { type, targetId: f.target.id } : { type }, f.revision, database)).rejects.toThrow('Storage unavailable');
    expect((await exportBackup(database)).data).toEqual(before);
  });

  it('rejects stale full and grouping-only saves before they can recreate deleted values', async () => {
    const f = await fixture();
    const draft = (await getAccountSummary(f.first.id, database))!;
    await manageGrouping(kind, f.source.id, { type: 'delete' }, f.revision, database);
    const before = (await exportBackup(database)).data;
    const tags = kind === 'tag' ? ['Typo'] : [];
    const folders = kind === 'folder' ? ['Typo'] : [];
    await expect(saveAccountGroupings(f.first.id, tags, folders, database, draft.groupingRevision)).rejects.toThrow('Tags or folders changed');
    await expect(saveAccountContext({ profile: { platform: 'x', handle: 'newcontact', profileUrl: 'https://x.com/newcontact' },
      metadata: { role: 'Unsaved' }, tagNames: tags, folderNames: folders, groupingRevision: draft.groupingRevision }, database)).rejects.toThrow('Tags or folders changed');
    expect((await exportBackup(database)).data).toEqual(before);
    const current = (await getLookups(database)).groupingRevision;
    const saved = await saveAccountGroupings(f.first.id, [], [], database, current);
    expect(values(saved)).toEqual([]);
    expect(saved.groupingRevision).toBe(current);
  });

  it('invalidates other management forms and retains protection through backups', async () => {
    const f = await fixture();
    await manageGrouping(kind, f.source.id, { type: 'delete' }, f.revision, database);
    await expect(manageGrouping(kind, f.target.id, { type: 'rename', name: 'Changed' }, f.revision, database)).rejects.toThrow('Tags or folders changed');
    const backup = await exportBackup(database);
    const revision = (await getLookups(database)).groupingRevision;
    await resetDatabaseForTests(database);
    await importBackup(backup, database);
    expect((await getLookups(database)).groupingRevision).toBe(revision);
    await expect(saveAccountGroupings(f.first.id, ['Typo'], [], database)).rejects.toThrow('Tags or folders changed');
  });
});

it('deletes an unused definition and rejects missing or inactive sources', async () => {
  await database.tags.bulkAdd([
    { id: 'unused', name: 'Unused', normalizedName: 'unused', createdAt: '', updatedAt: '' },
    { id: 'inactive', name: 'Inactive', normalizedName: 'inactive', createdAt: '', updatedAt: '', deletedAt: '2026-01-01' },
  ]);
  await expect(manageGrouping('tag', 'missing', { type: 'delete' }, '', database)).rejects.toThrow('no longer exists');
  await expect(manageGrouping('tag', 'inactive', { type: 'delete' }, '', database)).rejects.toThrow('no longer exists');
  await manageGrouping('tag', 'unused', { type: 'delete' }, '', database);
  expect(await database.tags.get('unused')).toBeUndefined();
  expect(await database.tags.get('inactive')).toBeDefined();
});
