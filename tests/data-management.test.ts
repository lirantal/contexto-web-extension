import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextoDatabase } from '@/src/data/db';
import { listManagedData, manageData, type ManagedDataAction } from '@/src/data/data-management';
import { ensureAccountFromProfile, exportBackup, getAccountSummary, getLookups, importBackup,
  resetDatabaseForTests, saveAccountContext, updateAccount } from '@/src/data/repositories';

const database = new ContextoDatabase('DataManagementTests');
afterEach(async () => { vi.restoreAllMocks(); await resetDatabaseForTests(database); });
async function seed(handle: string, companyName = '', role = '', location = '') {
  const account = await ensureAccountFromProfile({ platform: 'x', handle, profileUrl: `https://x.com/${handle}` }, database);
  return updateAccount(account.id, { companyName, role, location }, database);
}
async function companyFixture() {
  const first = await seed('first', 'Typo', 'Engineer', 'Berlin');
  const second = await seed('second', 'Typo');
  const third = await seed('third', 'Correct');
  await database.companies.add({ id: 'unused', name: 'Unused', normalizedName: 'unused', createdAt: '', updatedAt: '' });
  return { first, second, third, source: first.company!, target: third.company!, catalog: await listManagedData('company', database) };
}

describe('company management', () => {
  it('lists active usage, unused companies, and inactive-contact counts', async () => {
    const f = await companyFixture();
    await database.accounts.update(f.second.id, { deletedAt: '2026-01-01' });
    const catalog = await listManagedData('company', database);
    expect(catalog.items.map((i) => [i.name, i.contacts.map((a) => a.handle), i.inactiveContactCount])).toEqual([
      ['Correct', ['third'], 0], ['Typo', ['first'], 1], ['Unused', [], 0],
    ]);
  });

  it('renames a company without replacing its ID, details, or contact associations', async () => {
    const f = await companyFixture();
    await database.companies.update(f.source.id, { notes: 'Keep notes', website: 'https://example.com' });
    await manageData('company', f.source.id, { type: 'rename', name: ' Fixed  company ' }, f.catalog.revision, database);
    expect(await database.companies.get(f.source.id)).toMatchObject({ name: 'Fixed company', normalizedName: 'fixed company', notes: 'Keep notes', website: 'https://example.com' });
    for (const contact of [f.first, f.second]) {
      expect(await getAccountSummary(contact.id, database)).toMatchObject({ companyId: f.source.id, company: { name: 'Fixed company' }, syncState: 'pending-sync' });
    }
    expect((await getAccountSummary(f.third.id, database))!.updatedAt).toBe(f.third.updatedAt);
  });

  it('merges all references, combines notes, fills missing details, and retains destination identity', async () => {
    const f = await companyFixture();
    await database.accounts.update(f.second.id, { deletedAt: '2026-01-01' });
    await database.companies.update(f.source.id, { notes: 'Source notes', website: 'https://source.example' });
    await database.companies.update(f.target.id, { notes: 'Target notes' });
    await manageData('company', f.source.id, { type: 'merge', targetId: f.target.id }, f.catalog.revision, database);
    expect(await database.companies.get(f.source.id)).toBeUndefined();
    expect(await database.companies.get(f.target.id)).toMatchObject({ name: 'Correct', website: 'https://source.example', notes: 'Target notes\n\nSource notes' });
    for (const account of [f.first, f.second, f.third]) expect((await database.accounts.get(account.id))!.companyId).toBe(f.target.id);
    expect(await database.accounts.where('companyId').equals(f.source.id).count()).toBe(0);
    expect(await getAccountSummary(f.first.id, database)).toMatchObject({ role: 'Engineer', location: 'Berlin' });
  });

  it('keeps the destination website and deduplicates identical notes on merge', async () => {
    const f = await companyFixture();
    await database.companies.update(f.source.id, { notes: 'Same notes', website: 'https://source.example' });
    await database.companies.update(f.target.id, { notes: 'Same notes', website: 'https://target.example' });
    await manageData('company', f.source.id, { type: 'merge', targetId: f.target.id }, f.catalog.revision, database);
    expect(await database.companies.get(f.target.id)).toMatchObject({ website: 'https://target.example', notes: 'Same notes' });
  });

  it('deletes the company and clears references on active and inactive contacts only', async () => {
    const f = await companyFixture();
    await database.accounts.update(f.second.id, { deletedAt: '2026-01-01' });
    await manageData('company', f.source.id, { type: 'delete' }, f.catalog.revision, database);
    expect(await database.companies.get(f.source.id)).toBeUndefined();
    expect((await database.accounts.get(f.first.id))!.companyId).toBeUndefined();
    expect((await database.accounts.get(f.second.id))!.companyId).toBeUndefined();
    expect((await database.accounts.get(f.third.id))!.companyId).toBe(f.target.id);
    expect(await database.accounts.count()).toBe(3);
    expect((await getLookups(database)).companies.map((c) => c.name)).toEqual(['Correct', 'Unused']);
  });

  it('deletes an unused company without touching contacts', async () => {
    const f = await companyFixture();
    const contacts = await database.accounts.toArray();
    await manageData('company', 'unused', { type: 'delete' }, f.catalog.revision, database);
    expect(await database.companies.get('unused')).toBeUndefined();
    expect(await database.accounts.toArray()).toEqual(contacts);
  });

  it('rejects blank names, collisions, missing/inactive sources, and invalid destinations without writes', async () => {
    const f = await companyFixture();
    await database.companies.add({ id: 'inactive', name: 'Inactive', normalizedName: 'inactive', createdAt: '', updatedAt: '', deletedAt: '2026-01-01' });
    const before = (await exportBackup(database)).data;
    const actions: ManagedDataAction[] = [{ type: 'rename', name: ' ' }, { type: 'rename', name: ' CORRECT ' }, { type: 'rename', name: 'Inactive' },
      { type: 'merge', targetId: f.source.id }, { type: 'merge', targetId: 'missing' }, { type: 'merge', targetId: 'inactive' }, { type: 'clear' }];
    for (const action of actions) await expect(manageData('company', f.source.id, action, f.catalog.revision, database)).rejects.toThrow();
    for (const id of ['missing', 'inactive']) await expect(manageData('company', id, { type: 'delete' }, f.catalog.revision, database)).rejects.toThrow('no longer exists');
    expect((await exportBackup(database)).data).toEqual(before);
  });

  it.each(['rename', 'merge', 'delete'] as const)('rolls back the entire %s after a late logging failure', async (type) => {
    const f = await companyFixture();
    const before = (await exportBackup(database)).data;
    const add = database.changeLog.add.bind(database.changeLog);
    vi.spyOn(database.changeLog, 'add').mockImplementation((entry) => entry.entityType === 'groupingCatalog'
      ? Dexie.Promise.reject(new Error('Storage unavailable')) : add(entry));
    const action: ManagedDataAction = type === 'rename' ? { type, name: 'Fixed' } : type === 'merge' ? { type, targetId: f.target.id } : { type };
    await expect(manageData('company', f.source.id, action, f.catalog.revision, database)).rejects.toThrow('Storage unavailable');
    expect((await exportBackup(database)).data).toEqual(before);
  });
});

for (const field of ['role', 'location'] as const) describe(`${field} cleanup`, () => {
  async function fixture() {
    const first = await seed('first', 'Acme', field === 'role' ? 'Typo' : 'Engineer', field === 'location' ? 'Typo' : 'Berlin');
    const second = await seed('second');
    const inactive = await seed('inactive');
    const unrelated = await seed('unrelated');
    // Imported whitespace/case variants match the same suggestion identity.
    await database.accounts.update(second.id, { [field]: ' typo ' });
    await database.accounts.update(inactive.id, { [field]: 'TYPO', deletedAt: '2026-01-01' });
    await database.accounts.update(unrelated.id, { [field]: 'Other' });
    return { first, second, inactive, unrelated, catalog: await listManagedData(field, database) };
  }

  it('groups case/trim variants, counts usage, omits blanks, and shows inactive usage', async () => {
    await fixture();
    const values = (await listManagedData(field, database)).items;
    expect(values.map((item) => [item.id, item.contacts.length, item.inactiveContactCount])).toEqual([
      ['other', 1, 0], ['typo', 2, 1],
    ]);
  });

  it('replaces every matching value, including inactive records, while preserving other fields', async () => {
    const f = await fixture();
    await manageData(field, 'typo', { type: 'replace', value: ' Correct value ' }, f.catalog.revision, database);
    for (const account of [f.first, f.second, f.inactive]) {
      expect(await database.accounts.get(account.id)).toMatchObject({ [field]: 'Correct value', syncState: 'pending-sync' });
    }
    const first = (await database.accounts.get(f.first.id))!;
    expect(first.companyId).toBe(f.first.companyId);
    expect(first[field === 'role' ? 'location' : 'role']).toBe(field === 'role' ? 'Berlin' : 'Engineer');
    expect((await database.accounts.get(f.unrelated.id))![field]).toBe('Other');
    expect((await getLookups(database))[field === 'role' ? 'roles' : 'locations']).not.toContain('Typo');
  });

  it('supports case-only replacement to standardize spelling', async () => {
    const f = await fixture();
    await manageData(field, 'typo', { type: 'replace', value: 'TYPO' }, f.catalog.revision, database);
    for (const account of [f.first, f.second, f.inactive]) expect((await database.accounts.get(account.id))![field]).toBe('TYPO');
    expect((await listManagedData(field, database)).items.map((item) => item.id)).toEqual(['other', 'typo']);
  });

  it('clears the field on matching contacts and leaves unrelated values intact', async () => {
    const f = await fixture();
    await manageData(field, 'typo', { type: 'clear' }, f.catalog.revision, database);
    for (const account of [f.first, f.second, f.inactive]) expect((await database.accounts.get(account.id))![field]).toBeUndefined();
    expect((await database.accounts.get(f.unrelated.id))![field]).toBe('Other');
    expect((await listManagedData(field, database)).items.map((i) => i.id)).toEqual(['other']);
  });

  it('rejects blank replacement, missing source, invalid actions, and stale forms without writes', async () => {
    const f = await fixture();
    const before = (await exportBackup(database)).data;
    await expect(manageData(field, 'typo', { type: 'replace', value: '  ' }, f.catalog.revision, database)).rejects.toThrow('replacement value');
    await expect(manageData(field, 'missing', { type: 'clear' }, f.catalog.revision, database)).rejects.toThrow('no longer exists');
    await expect(manageData(field, 'typo', { type: 'delete' }, f.catalog.revision, database)).rejects.toThrow('Unsupported');
    expect((await exportBackup(database)).data).toEqual(before);
    await manageData(field, 'typo', { type: 'clear' }, f.catalog.revision, database);
    await expect(manageData(field, 'other', { type: 'clear' }, f.catalog.revision, database)).rejects.toThrow('Shared data changed');
  });

  it.each(['replace', 'clear'] as const)('rolls back a %s when the last log write fails', async (type) => {
    const f = await fixture();
    const before = (await exportBackup(database)).data;
    const add = database.changeLog.add.bind(database.changeLog);
    vi.spyOn(database.changeLog, 'add').mockImplementation((entry) => entry.entityType === 'groupingCatalog'
      ? Dexie.Promise.reject(new Error('Storage unavailable')) : add(entry));
    await expect(manageData(field, 'typo', type === 'replace' ? { type, value: 'Correct' } : { type }, f.catalog.revision, database)).rejects.toThrow('Storage unavailable');
    expect((await exportBackup(database)).data).toEqual(before);
  });
});

it('prevents stale metadata saves from undoing cleanup and preserves the revision through backup/restore', async () => {
  const original = await seed('first', 'Typo', 'Engineer', 'Berlin');
  const catalog = await listManagedData('company', database);
  await manageData('company', original.companyId!, { type: 'delete' }, catalog.revision, database);
  const before = (await exportBackup(database)).data;
  await expect(updateAccount(original.id, { companyName: 'Typo', groupingRevision: original.groupingRevision }, database)).rejects.toThrow('Shared data changed');
  await expect(saveAccountContext({ profile: { platform: 'x', handle: 'first', profileUrl: 'https://x.com/first' },
    metadata: { companyName: 'Typo' }, groupingRevision: original.groupingRevision, tagNames: [], folderNames: [] }, database)).rejects.toThrow('Shared data changed');
  expect((await exportBackup(database)).data).toEqual(before);
  const current = (await getAccountSummary(original.id, database))!;
  await updateAccount(original.id, { role: 'Updated', groupingRevision: current.groupingRevision }, database);
  const backup = await exportBackup(database);
  await resetDatabaseForTests(database);
  await importBackup(backup, database);
  expect((await getAccountSummary(original.id, database))!.groupingRevision).toBe(current.groupingRevision);
  expect(await database.companies.count()).toBe(0);
});
