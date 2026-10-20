import { db } from './db';
import { assertGroupingRevision, getGroupingRevision } from './grouping-revision';
import { listManagedGroupings, manageGrouping, type GroupingAction, type GroupingKind, type ManagedGrouping } from './grouping-management';
import { normalizeName, nowIso, recordChange } from './repositories';

export type ManagedDataKind = GroupingKind | 'company' | 'role' | 'location';
export type ManagedDataAction = GroupingAction | { type: 'replace'; value: string } | { type: 'clear' };
export interface ManagedValue extends ManagedGrouping {
  inactiveContactCount?: number;
}

/** Matches the trim/case-insensitive identity used by role/location suggestions. */
export function normalizeTextValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export async function listManagedData(kind: ManagedDataKind, database = db): Promise<{ revision: string; items: ManagedValue[] }> {
  if (kind === 'tag' || kind === 'folder') return listManagedGroupings(kind, database);
  return database.transaction('r', [database.accounts, database.companies, database.changeLog], async () => {
    const accounts = await database.accounts.toArray();
    let items: ManagedValue[];
    if (kind === 'company') {
      items = (await database.companies.toArray()).filter((company) => !company.deletedAt).map((company) => {
        const matches = accounts.filter((account) => account.companyId === company.id);
        return { id: company.id, name: company.name, contacts: matches.filter((a) => !a.deletedAt),
          inactiveContactCount: matches.filter((a) => a.deletedAt).length };
      });
    } else {
      const byValue = new Map<string, ManagedValue>();
      for (const account of accounts) {
        const name = account[kind]?.trim();
        if (!name) continue;
        const id = normalizeTextValue(name);
        const item = byValue.get(id) ?? { id, name, contacts: [], inactiveContactCount: 0 };
        if (name < item.name) item.name = name;
        if (account.deletedAt) item.inactiveContactCount = (item.inactiveContactCount ?? 0) + 1;
        else item.contacts.push(account);
        byValue.set(id, item);
      }
      items = [...byValue.values()];
    }
    for (const item of items) item.contacts.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return { revision: await getGroupingRevision(database), items: items.sort((a, b) => a.name.localeCompare(b.name)) };
  });
}

export async function manageData(
  kind: ManagedDataKind, id: string, action: ManagedDataAction, revision: string, database = db,
): Promise<void> {
  if (kind === 'tag' || kind === 'folder') {
    if (action.type === 'replace' || action.type === 'clear') throw new Error('Unsupported action');
    return manageGrouping(kind, id, action, revision, database);
  }
  if (kind !== 'company' && kind !== 'role' && kind !== 'location') throw new Error('Unsupported data type');
  await database.transaction('rw', [database.accounts, database.companies, database.changeLog], async () => {
    await assertGroupingRevision(revision, database);
    const timestamp = nowIso();
    if (kind === 'company') {
      const source = await database.companies.get(id);
      if (!source || source.deletedAt) throw new Error('This company no longer exists. Reopen the action.');
      const accounts = await database.accounts.where('companyId').equals(id).toArray();
      let destinationId: string | undefined;
      if (action.type === 'rename') {
        const name = action.name.trim().replace(/\s+/g, ' ');
        if (!name) throw new Error('Enter a name.');
        const normalizedName = normalizeName(name);
        const existing = await database.companies.where('normalizedName').equals(normalizedName).first();
        if (existing && existing.id !== id) {
          throw new Error(existing.deletedAt ? 'That name belongs to an inactive company. Choose another name.' : 'That name already exists. Use Merge instead.');
        }
        await database.companies.update(id, { name, normalizedName, updatedAt: timestamp });
        await recordChange(database, 'company', id, 'update');
        destinationId = id;
      } else if (action.type === 'merge' || action.type === 'delete') {
        if (action.type === 'merge') {
          if (action.targetId === id) throw new Error('Choose a different destination.');
          const target = await database.companies.get(action.targetId);
          if (!target || target.deletedAt) throw new Error('The destination no longer exists. Choose another company.');
          await database.companies.update(target.id, {
            website: target.website?.trim() ? target.website : source.website,
            notes: [...new Set([target.notes, source.notes].filter((note): note is string => !!note?.trim()))].join('\n\n') || undefined,
            updatedAt: timestamp,
          });
          await recordChange(database, 'company', target.id, 'update');
          destinationId = target.id;
        }
        await database.companies.delete(id);
        await recordChange(database, 'company', id, 'delete');
      } else throw new Error('Unsupported company action');
      for (const account of accounts) {
        await database.accounts.update(account.id, { companyId: destinationId, updatedAt: timestamp, syncState: 'pending-sync' });
        await recordChange(database, 'account', account.id, 'update');
      }
    } else {
      if (action.type !== 'replace' && action.type !== 'clear') throw new Error('Unsupported text-field action');
      const value = action.type === 'replace' ? action.value.trim() : undefined;
      if (action.type === 'replace' && !value) throw new Error('Enter a replacement value, or use Clear everywhere.');
      const accounts = (await database.accounts.toArray()).filter((account) => {
        const current = account[kind];
        return !!current?.trim() && normalizeTextValue(current) === id;
      });
      if (!accounts.length) throw new Error('This value no longer exists. Reopen the action.');
      for (const account of accounts) {
        await database.accounts.update(account.id, { [kind]: value, updatedAt: timestamp, syncState: 'pending-sync' });
        await recordChange(database, 'account', account.id, 'update');
      }
    }
    // Reuse the existing persisted revision, including backup compatibility.
    await recordChange(database, 'groupingCatalog', 'catalog', 'update');
  });
}
