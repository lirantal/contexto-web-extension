import { db } from './db';
import { assertGroupingRevision, getGroupingRevision } from './grouping-revision';
import { createId, normalizeName, nowIso, recordChange } from './repositories';
import type { Account, Folder, Tag } from '../shared/types';

export type GroupingKind = 'tag' | 'folder';
export interface ManagedGrouping {
  id: string;
  name: string;
  contacts: Account[];
}
export type GroupingAction =
  | { type: 'rename'; name: string }
  | { type: 'merge'; targetId: string }
  | { type: 'delete' };

export async function listManagedGroupings(kind: GroupingKind, database = db) {
  return database.transaction('r', [database.tags, database.folders, database.accountTags,
    database.folderAccounts, database.accounts, database.changeLog], async () => {
    const definitions = await (kind === 'tag' ? database.tags : database.folders).toArray();
    const accounts = new Map((await database.accounts.toArray()).filter((a) => !a.deletedAt).map((a) => [a.id, a]));
    const joins = kind === 'tag'
      ? (await database.accountTags.toArray()).map((j) => ({ accountId: j.accountId, groupingId: j.tagId }))
      : (await database.folderAccounts.toArray()).map((j) => ({ accountId: j.accountId, groupingId: j.folderId }));
    const contactsByGrouping = new Map<string, Set<string>>();
    for (const join of joins) {
      if (!accounts.has(join.accountId)) continue;
      const ids = contactsByGrouping.get(join.groupingId) ?? new Set<string>();
      ids.add(join.accountId);
      contactsByGrouping.set(join.groupingId, ids);
    }
    return {
      revision: await getGroupingRevision(database),
      items: definitions.filter((d) => !d.deletedAt).map((d): ManagedGrouping => ({
        id: d.id, name: d.name,
        contacts: [...(contactsByGrouping.get(d.id) ?? [])].map((id) => accounts.get(id)!)
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

/** Hard deletion removes definitions and all joins, including legacy/inactive joins. */
export async function manageGrouping(
  kind: GroupingKind, id: string, action: GroupingAction, revision: string, database = db,
): Promise<void> {
  if (kind !== 'tag' && kind !== 'folder') throw new Error('Unsupported grouping type');
  await database.transaction('rw', [database.tags, database.folders, database.accountTags,
    database.folderAccounts, database.accounts, database.changeLog], async () => {
    await assertGroupingRevision(revision, database);
    const definitions = kind === 'tag' ? database.tags : database.folders;
    const source: Tag | Folder | undefined = await definitions.get(id);
    if (!source || source.deletedAt) throw new Error('This value no longer exists. Reopen the action.');
    const timestamp = nowIso();
    const joins = kind === 'tag'
      ? (await database.accountTags.where('tagId').equals(id).toArray()).map((j) => ({ ...j, groupingId: j.tagId }))
      : (await database.folderAccounts.where('folderId').equals(id).toArray()).map((j) => ({ ...j, groupingId: j.folderId }));

    if (action.type === 'rename') {
      const name = action.name.trim().replace(/\s+/g, ' ');
      if (!name) throw new Error('Enter a name.');
      const normalizedName = normalizeName(name);
      const existing = await definitions.where('normalizedName').equals(normalizedName).first();
      if (existing && existing.id !== id) throw new Error('That name already exists. Use Merge instead.');
      await definitions.update(id, { name, normalizedName, updatedAt: timestamp });
      await recordChange(database, kind, id, 'update');
    } else if (action.type === 'delete' || action.type === 'merge') {
      if (action.type === 'merge') {
        if (action.targetId === id) throw new Error('Choose a different destination.');
        const target = await definitions.get(action.targetId);
        if (!target || target.deletedAt) throw new Error('The destination no longer exists. Choose another value.');
        for (const join of joins) {
          if (kind === 'tag') {
            const existing = await database.accountTags.where('[accountId+tagId]').equals([join.accountId, target.id]).first();
            if (!existing) await database.accountTags.add({ id: createId('account_tag'), accountId: join.accountId, tagId: target.id, createdAt: join.createdAt });
          } else {
            const existing = await database.folderAccounts.where('[folderId+accountId]').equals([target.id, join.accountId]).first();
            if (!existing) await database.folderAccounts.add({ id: createId('folder_account'), accountId: join.accountId, folderId: target.id, createdAt: join.createdAt });
          }
        }
        await definitions.update(target.id, { updatedAt: timestamp });
        await recordChange(database, kind, target.id, 'update');
      }
      if (kind === 'tag') await database.accountTags.where('tagId').equals(id).delete();
      else await database.folderAccounts.where('folderId').equals(id).delete();
      await definitions.delete(id);
      await recordChange(database, kind, id, 'delete');
    } else {
      throw new Error('Unsupported action');
    }
    for (const accountId of new Set(joins.map((j) => j.accountId))) {
      if (await database.accounts.get(accountId)) {
        await database.accounts.update(accountId, { updatedAt: timestamp, syncState: 'pending-sync' });
        await recordChange(database, 'account', accountId, 'update');
      }
    }
    await recordChange(database, 'groupingCatalog', 'catalog', 'update');
  });
}
