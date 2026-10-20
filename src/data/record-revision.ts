/** Stable serialization preserves unknown persisted fields and ignores object key ordering. */
export function canonicalRecord(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
    }
    return item;
  });
}

export function accountRevision(account: unknown, tags: { tagId: string }[], folders: { folderId: string }[]): string {
  return canonicalRecord([account, tags.map((join) => join.tagId).sort(), folders.map((join) => join.folderId).sort()]);
}
