import { db } from './db';

/** All Manage data edits invalidate drafts; ordinary account/assignment saves do not. */
export async function getGroupingRevision(database = db): Promise<string> {
  const changes = await database.changeLog.where('entityType').equals('groupingCatalog').primaryKeys();
  return changes.sort().join(',');
}

export async function assertGroupingRevision(revision: string | undefined, database = db): Promise<void> {
  if ((revision ?? '') !== await getGroupingRevision(database)) {
    throw new Error('Shared data changed in Manage data. Your draft has not been saved. Reload saved values or cancel and reopen this action.');
  }
}
