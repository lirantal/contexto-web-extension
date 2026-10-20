import { db } from './db';

/** Only explicit catalog edits invalidate drafts; ordinary assignment saves do not. */
export async function getGroupingRevision(database = db): Promise<string> {
  const changes = await database.changeLog.where('entityType').equals('groupingCatalog').primaryKeys();
  return changes.sort().join(',');
}

export async function assertGroupingRevision(revision: string | undefined, database = db): Promise<void> {
  if ((revision ?? '') !== await getGroupingRevision(database)) {
    throw new Error('Tags or folders changed in Manage data. Your draft has not been saved. Reload saved values or cancel and reopen this action.');
  }
}
