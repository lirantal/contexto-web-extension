import { ContextoDatabase, db } from './db';
import { buildXSearchQuery, normalizeXHandle, parseXPostUrl, parseXProfileUrl } from '../shared/platforms/x';
import type {
  Account,
  AccountFilters,
  AccountSummary,
  AccountTag,
  AccountContextSaveInput,
  AccountUpdateInput,
  BackupEnvelope,
  BackupImportEnvelope,
  BackupRecord,
  Bookmark,
  BookmarkCaptureInput,
  BookmarkUpdateInput,
  ChangeEntityType,
  Company,
  Folder,
  FolderAccount,
  LookupData,
  Note,
  Platform,
  ProfileSnapshot,
  SearchHistory,
  SearchPreset,
  Tag,
  XSearchFilters,
} from '../shared/types';
import type { TargetAccountSuggestion } from '../shared/target-handle-suggestions';

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeHandle(platform: Platform, handle: string): string {
  if (platform === 'x') return normalizeXHandle(handle);
  return handle.trim().toLowerCase();
}

function active<T extends { deletedAt?: string }>(records: T[]): T[] {
  return records.filter((record) => !record.deletedAt);
}

async function recordChange(
  database: ContextoDatabase,
  entityType: ChangeEntityType,
  entityId: string,
  operation: 'create' | 'update' | 'delete' | 'import',
): Promise<void> {
  await database.changeLog.add({
    id: createId('change'),
    entityType,
    entityId,
    operation,
    changedAt: nowIso(),
  });
}

async function upsertCompanyByName(name: string, database = db): Promise<Company> {
  const normalizedName = normalizeName(name);
  const existing = await database.companies.where('normalizedName').equals(normalizedName).first();
  const timestamp = nowIso();

  if (existing) {
    await database.companies.update(existing.id, { name: name.trim(), updatedAt: timestamp, deletedAt: undefined });
    await recordChange(database, 'company', existing.id, 'update');
    return { ...existing, name: name.trim(), updatedAt: timestamp, deletedAt: undefined };
  }

  const company: Company = {
    id: createId('company'),
    name: name.trim(),
    normalizedName,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await database.companies.add(company);
  await recordChange(database, 'company', company.id, 'create');
  return company;
}

async function upsertTagByName(name: string, database = db): Promise<Tag> {
  const normalizedName = normalizeName(name);
  const existing = await database.tags.where('normalizedName').equals(normalizedName).first();
  const timestamp = nowIso();

  if (existing) {
    await database.tags.update(existing.id, { name: name.trim(), updatedAt: timestamp, deletedAt: undefined });
    await recordChange(database, 'tag', existing.id, 'update');
    return { ...existing, name: name.trim(), updatedAt: timestamp, deletedAt: undefined };
  }

  const tag: Tag = {
    id: createId('tag'),
    name: name.trim(),
    normalizedName,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await database.tags.add(tag);
  await recordChange(database, 'tag', tag.id, 'create');
  return tag;
}

async function upsertFolderByName(name: string, database = db): Promise<Folder> {
  const normalizedName = normalizeName(name);
  const existing = await database.folders.where('normalizedName').equals(normalizedName).first();
  const timestamp = nowIso();

  if (existing) {
    await database.folders.update(existing.id, { name: name.trim(), updatedAt: timestamp, deletedAt: undefined });
    await recordChange(database, 'folder', existing.id, 'update');
    return { ...existing, name: name.trim(), updatedAt: timestamp, deletedAt: undefined };
  }

  const folder: Folder = {
    id: createId('folder'),
    name: name.trim(),
    normalizedName,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await database.folders.add(folder);
  await recordChange(database, 'folder', folder.id, 'create');
  return folder;
}

export async function ensureAccountFromProfile(profile: ProfileSnapshot, database = db): Promise<AccountSummary> {
  const normalizedHandle = normalizeHandle(profile.platform, profile.handle);
  const existing = await database.accounts.where('[platform+normalizedHandle]').equals([profile.platform, normalizedHandle]).first();
  const timestamp = nowIso();

  if (existing) {
    const patch: Partial<Account> = {
      displayName: profile.displayName?.trim() || existing.displayName || profile.handle,
      profileUrl: profile.profileUrl,
      avatarUrl: profile.avatarUrl || existing.avatarUrl,
      bioSnapshot: profile.bioSnapshot || existing.bioSnapshot,
      website: profile.website || existing.website,
      location: profile.location || existing.location,
      updatedAt: timestamp,
      deletedAt: undefined,
      syncState: 'pending-sync',
    };
    await database.accounts.update(existing.id, patch);
    await recordChange(database, 'account', existing.id, 'update');
    return getAccountSummary(existing.id, database) as Promise<AccountSummary>;
  }

  const account: Account = {
    id: createId('account'),
    platform: profile.platform,
    handle: profile.handle.replace(/^@/, ''),
    normalizedHandle,
    displayName: profile.displayName?.trim() || profile.handle.replace(/^@/, ''),
    profileUrl: profile.profileUrl,
    avatarUrl: profile.avatarUrl,
    bioSnapshot: profile.bioSnapshot,
    website: profile.website,
    location: profile.location,
    createdAt: timestamp,
    updatedAt: timestamp,
    syncState: 'local-only',
  };

  await database.accounts.add(account);
  await recordChange(database, 'account', account.id, 'create');
  return getAccountSummary(account.id, database) as Promise<AccountSummary>;
}

export async function getAccountByHandle(platform: Platform, handle: string, database = db): Promise<AccountSummary | undefined> {
  const normalizedHandle = normalizeHandle(platform, handle);
  const account = await database.accounts.where('[platform+normalizedHandle]').equals([platform, normalizedHandle]).first();
  return account ? getAccountSummary(account.id, database) : undefined;
}

export async function updateAccount(accountId: string, input: AccountUpdateInput, database = db): Promise<AccountSummary> {
  const timestamp = nowIso();
  const patch: Partial<Account> = {
    updatedAt: timestamp,
    syncState: 'pending-sync',
  };

  if (input.displayName !== undefined) patch.displayName = input.displayName.trim();
  if (input.role !== undefined) patch.role = input.role.trim();
  if (input.location !== undefined) patch.location = input.location.trim();
  if (input.relationshipSource !== undefined) patch.relationshipSource = input.relationshipSource.trim();
  if (input.website !== undefined) patch.website = input.website.trim();
  if (input.bioSnapshot !== undefined) patch.bioSnapshot = input.bioSnapshot.trim();
  if (input.companyId !== undefined) patch.companyId = input.companyId;
  if (input.companyName !== undefined && !input.companyName.trim()) patch.companyId = undefined;
  if (input.companyName?.trim()) {
    const company = await upsertCompanyByName(input.companyName, database);
    patch.companyId = company.id;
  }

  await database.accounts.update(accountId, patch);
  await recordChange(database, 'account', accountId, 'update');
  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}

export async function markAccountCaughtUp(
  accountId: string,
  database = db,
  caughtUpAt = nowIso(),
): Promise<AccountSummary> {
  const account = await database.accounts.get(accountId);
  if (!account || account.deletedAt) throw new Error('Account not found');

  const timestamp = new Date(caughtUpAt).toISOString();
  await database.transaction(
    'rw',
    [database.accounts, database.changeLog],
    async () => {
      await database.accounts.update(accountId, {
        lastCatchUpAt: timestamp,
        updatedAt: timestamp,
        syncState: 'pending-sync',
      });
      await recordChange(database, 'account', accountId, 'update');
    },
  );

  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}

async function syncAccountTags(accountId: string, names: string[], database: ContextoDatabase): Promise<void> {
  const uniqueNames = [...new Map(names.map((name) => [normalizeName(name), name.trim()])).values()].filter(Boolean);
  const tags = await Promise.all(uniqueNames.map((name) => upsertTagByName(name, database)));
  const selectedIds = new Set(tags.map((tag) => tag.id));
  const current = await database.accountTags.where('accountId').equals(accountId).toArray();
  await database.accountTags.bulkDelete(current.filter((join) => !selectedIds.has(join.tagId)).map((join) => join.id));
  for (const tag of tags) {
    if (!current.some((join) => join.tagId === tag.id)) {
      await database.accountTags.add({ id: createId('account_tag'), accountId, tagId: tag.id, createdAt: nowIso() });
    }
  }
}

async function syncAccountFolders(accountId: string, names: string[], database: ContextoDatabase): Promise<void> {
  const uniqueNames = [...new Map(names.map((name) => [normalizeName(name), name.trim()])).values()].filter(Boolean);
  const folders = await Promise.all(uniqueNames.map((name) => upsertFolderByName(name, database)));
  const selectedIds = new Set(folders.map((folder) => folder.id));
  const current = await database.folderAccounts.where('accountId').equals(accountId).toArray();
  await database.folderAccounts.bulkDelete(current.filter((join) => !selectedIds.has(join.folderId)).map((join) => join.id));
  for (const folder of folders) {
    if (!current.some((join) => join.folderId === folder.id)) {
      await database.folderAccounts.add({ id: createId('folder_account'), folderId: folder.id, accountId, createdAt: nowIso() });
    }
  }
}

function validateAccountContextSave(input: AccountContextSaveInput): AccountContextSaveInput {
  const parsed = parseXProfileUrl(input.profile.profileUrl);
  if (input.profile.platform !== 'x' || !parsed) throw new Error('Profile must be a valid X profile');
  if (normalizeXHandle(input.profile.handle) !== normalizeXHandle(parsed.handle)) {
    throw new Error('Profile handle does not match the X profile URL');
  }
  if (!Array.isArray(input.tagNames) || !Array.isArray(input.folderNames)
    || !input.tagNames.every((name) => typeof name === 'string')
    || !input.folderNames.every((name) => typeof name === 'string')) {
    throw new Error('Tags and folders must be lists of names');
  }
  return {
    ...input,
    profile: { ...input.profile, handle: parsed.handle, profileUrl: parsed.profileUrl },
    metadata: {
      ...input.metadata,
      displayName: input.metadata.displayName?.trim() || input.profile.displayName?.trim() || parsed.handle,
    },
    tagNames: input.tagNames.map((name) => name.trim()),
    folderNames: input.folderNames.map((name) => name.trim()),
  };
}

export async function saveAccountContext(input: AccountContextSaveInput, database = db): Promise<AccountSummary> {
  input = validateAccountContextSave(input);
  return database.transaction(
    'rw',
    [
      database.accounts,
      database.companies,
      database.tags,
      database.accountTags,
      database.folders,
      database.folderAccounts,
      database.notes,
      database.changeLog,
    ],
    async () => {
      const account = await ensureAccountFromProfile(input.profile, database);
      const updated = await updateAccount(account.id, input.metadata, database);
      await syncAccountTags(updated.id, input.tagNames, database);
      await syncAccountFolders(updated.id, input.folderNames, database);
      return getAccountSummary(updated.id, database) as Promise<AccountSummary>;
    },
  );
}

export async function addNote(accountId: string, body: string, database = db): Promise<AccountSummary> {
  const trimmed = body.trim();
  if (!trimmed) return getAccountSummary(accountId, database) as Promise<AccountSummary>;

  const timestamp = nowIso();
  await database.notes.add({
    id: createId('note'),
    accountId,
    body: trimmed,
    source: 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await database.accounts.update(accountId, { updatedAt: timestamp, syncState: 'pending-sync' });
  await recordChange(database, 'note', accountId, 'create');
  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}

function normalizeBookmarkExcerpt(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('Bookmark excerpt must be text');
  const normalized = value.replace(/\s+/g, ' ').trim();
  if ([...normalized].length > 280) throw new Error('Excerpt must be 280 characters or fewer');
  return normalized || undefined;
}

function normalizeBookmarkReminder(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('Bookmark reminder must be text');
  const normalized = value
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .trim();
  if ([...normalized].length > 500) throw new Error('Reminder must be 500 characters or fewer');
  return normalized || undefined;
}

async function validateBookmarkCapture(
  accountId: string,
  input: BookmarkCaptureInput,
  database: ContextoDatabase,
): Promise<{ account: Account; postId: string; postUrl: string; excerpt?: string; reminder?: string }> {
  const account = await database.accounts.get(accountId);
  if (!account || account.deletedAt) throw new Error('Bookmark owning account was not found');
  if (account.platform !== 'x') throw new Error('Bookmarks currently require an X account');

  const parsed = parseXPostUrl(input.postUrl);
  if (!parsed) throw new Error('Bookmark must reference a valid X post');
  const inputHandle = normalizeXHandle(input.authorHandle);
  if (inputHandle !== account.normalizedHandle || parsed.handle !== account.normalizedHandle) {
    throw new Error('Bookmark author does not match the owning account');
  }

  return {
    account,
    postId: parsed.postId,
    postUrl: parsed.postUrl,
    excerpt: normalizeBookmarkExcerpt(input.excerpt),
    reminder: normalizeBookmarkReminder(input.reminder),
  };
}

export async function captureBookmark(
  accountId: string,
  input: BookmarkCaptureInput,
  database = db,
): Promise<Bookmark> {
  const validated = await validateBookmarkCapture(accountId, input, database);
  return database.transaction(
    'rw',
    [database.accounts, database.bookmarks, database.changeLog],
    async () => {
      const existing = await database.bookmarks
        .where('[accountId+postUrl]')
        .equals([accountId, validated.postUrl])
        .first();
      if (existing && !existing.deletedAt) return existing;

      const timestamp = nowIso();
      let bookmark: Bookmark;
      if (existing) {
        bookmark = {
          ...existing,
          postId: validated.postId,
          excerpt: validated.excerpt,
          reminder: validated.reminder,
          capturedAt: timestamp,
          completedAt: undefined,
          updatedAt: timestamp,
          deletedAt: undefined,
        };
        await database.bookmarks.put(bookmark);
        await recordChange(database, 'bookmark', bookmark.id, 'update');
      } else {
        bookmark = {
          id: createId('bookmark'),
          accountId,
          platform: 'x',
          postId: validated.postId,
          postUrl: validated.postUrl,
          excerpt: validated.excerpt,
          reminder: validated.reminder,
          capturedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await database.bookmarks.add(bookmark);
        await recordChange(database, 'bookmark', bookmark.id, 'create');
      }
      await database.accounts.update(accountId, { updatedAt: timestamp, syncState: 'pending-sync' });
      return bookmark;
    },
  );
}

export async function findBookmarkByPost(
  accountId: string,
  postUrl: string,
  database = db,
): Promise<Bookmark | undefined> {
  const parsed = parseXPostUrl(postUrl);
  if (!parsed) return undefined;
  const bookmark = await database.bookmarks
    .where('[accountId+postUrl]')
    .equals([accountId, parsed.postUrl])
    .first();
  return bookmark && !bookmark.deletedAt ? bookmark : undefined;
}

export async function listBookmarks(accountId: string, database = db): Promise<Bookmark[]> {
  const bookmarks = active(await database.bookmarks.where('accountId').equals(accountId).toArray());
  return bookmarks.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
}

export async function updateBookmark(
  bookmarkId: string,
  input: BookmarkUpdateInput,
  database = db,
  changedAt = nowIso(),
): Promise<Bookmark> {
  if (input.completed !== undefined && typeof input.completed !== 'boolean') {
    throw new Error('Bookmark completed state must be true or false');
  }
  const updatesReminder = input.reminder !== undefined;
  const updatesCompletion = input.completed !== undefined;
  const reminder = updatesReminder ? normalizeBookmarkReminder(input.reminder) : undefined;

  return database.transaction(
    'rw',
    [database.accounts, database.bookmarks, database.changeLog],
    async () => {
      const bookmark = await database.bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.deletedAt) throw new Error('Bookmark not found');
      if (!updatesReminder && !updatesCompletion) return bookmark;

      const timestamp = new Date(changedAt).toISOString();
      const updated: Bookmark = {
        ...bookmark,
        ...(updatesReminder ? { reminder } : {}),
        ...(updatesCompletion
          ? { completedAt: input.completed ? timestamp : undefined }
          : {}),
        updatedAt: timestamp,
      };
      await database.bookmarks.put(updated);
      await database.accounts.update(bookmark.accountId, {
        updatedAt: timestamp,
        syncState: 'pending-sync',
      });
      await recordChange(database, 'bookmark', bookmark.id, 'update');
      return updated;
    },
  );
}

export async function removeBookmark(bookmarkId: string, database = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.accounts, database.bookmarks, database.changeLog],
    async () => {
      const bookmark = await database.bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.deletedAt) return;
      const timestamp = nowIso();
      await database.bookmarks.update(bookmarkId, { deletedAt: timestamp, updatedAt: timestamp });
      await database.accounts.update(bookmark.accountId, { updatedAt: timestamp, syncState: 'pending-sync' });
      await recordChange(database, 'bookmark', bookmark.id, 'delete');
    },
  );
}

export async function deleteAccount(accountId: string, database = db): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.accounts,
      database.accountTags,
      database.folderAccounts,
      database.notes,
      database.bookmarks,
      database.searchHistory,
      database.changeLog,
    ],
    async () => {
      const account = await database.accounts.get(accountId);
      if (!account) throw new Error('Account not found');

      const [notes, bookmarks, changes] = await Promise.all([
        database.notes.where('accountId').equals(accountId).toArray(),
        database.bookmarks.where('accountId').equals(accountId).toArray(),
        database.changeLog.toArray(),
      ]);
      const noteIds = new Set(notes.map((note) => note.id));
      const bookmarkIds = new Set(bookmarks.map((bookmark) => bookmark.id));
      const accountChangeIds = changes
        .filter((change) => {
          if (change.entityType === 'account') return change.entityId === accountId;
          if (change.entityType === 'note') return change.entityId === accountId || noteIds.has(change.entityId);
          if (change.entityType === 'bookmark') return bookmarkIds.has(change.entityId);
          return false;
        })
        .map((change) => change.id);

      await Promise.all([
        database.accountTags.where('accountId').equals(accountId).delete(),
        database.folderAccounts.where('accountId').equals(accountId).delete(),
        database.notes.where('accountId').equals(accountId).delete(),
        database.bookmarks.where('accountId').equals(accountId).delete(),
        database.searchHistory.where('accountId').equals(accountId).delete(),
        database.changeLog.bulkDelete(accountChangeIds),
        database.accounts.delete(accountId),
      ]);
    },
  );
}

export async function assignTag(accountId: string, name: string, database = db): Promise<AccountSummary> {
  const tag = await upsertTagByName(name, database);
  const existing = await database.accountTags.where('[accountId+tagId]').equals([accountId, tag.id]).first();

  if (!existing) {
    const join: AccountTag = { id: createId('account_tag'), accountId, tagId: tag.id, createdAt: nowIso() };
    await database.accountTags.add(join);
    await recordChange(database, 'account', accountId, 'update');
  }

  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}

export async function assignFolder(accountId: string, name: string, database = db): Promise<AccountSummary> {
  const folder = await upsertFolderByName(name, database);
  const existing = await database.folderAccounts.where('[folderId+accountId]').equals([folder.id, accountId]).first();

  if (!existing) {
    const join: FolderAccount = { id: createId('folder_account'), folderId: folder.id, accountId, createdAt: nowIso() };
    await database.folderAccounts.add(join);
    await recordChange(database, 'account', accountId, 'update');
  }

  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}

export async function removeTag(accountId: string, tagId: string, database = db): Promise<AccountSummary> {
  await database.transaction(
    'rw',
    [database.accountTags, database.changeLog],
    async () => {
      const assignment = await database.accountTags
        .where('[accountId+tagId]')
        .equals([accountId, tagId])
        .first();

      if (assignment) {
        await database.accountTags.delete(assignment.id);
        await recordChange(database, 'account', accountId, 'update');
      }
    },
  );

  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}

export async function removeFolder(accountId: string, folderId: string, database = db): Promise<AccountSummary> {
  await database.transaction(
    'rw',
    [database.folderAccounts, database.changeLog],
    async () => {
      const assignment = await database.folderAccounts
        .where('[folderId+accountId]')
        .equals([folderId, accountId])
        .first();

      if (assignment) {
        await database.folderAccounts.delete(assignment.id);
        await recordChange(database, 'account', accountId, 'update');
      }
    },
  );

  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}

export async function getLookups(database = db): Promise<LookupData> {
  const [companies, tags, folders, accounts] = await Promise.all([
    database.companies.orderBy('name').toArray(),
    database.tags.orderBy('name').toArray(),
    database.folders.orderBy('name').toArray(),
    database.accounts.toArray(),
  ]);
  const accountsForSuggestions = active(accounts);
  function distinctValues(field: 'location' | 'role'): string[] {
    const valuesByNormalizedName = new Map<string, string>();
    for (const account of accountsForSuggestions) {
      const value = account[field]?.trim();
      if (!value) continue;
      const normalizedValue = value.toLocaleLowerCase();
      const existingValue = valuesByNormalizedName.get(normalizedValue);
      if (existingValue === undefined || value < existingValue) {
        valuesByNormalizedName.set(normalizedValue, value);
      }
    }
    return [...valuesByNormalizedName.values()].sort((left, right) => left.localeCompare(right));
  }

  return {
    companies: active(companies),
    tags: active(tags),
    folders: active(folders),
    locations: distinctValues('location'),
    roles: distinctValues('role'),
  };
}

export async function getAccountSummary(accountId: string, database = db): Promise<AccountSummary | undefined> {
  const account = await database.accounts.get(accountId);
  if (!account || account.deletedAt) return undefined;

  const [company, accountTags, folderAccounts, latestNote] = await Promise.all([
    account.companyId ? database.companies.get(account.companyId) : undefined,
    database.accountTags.where('accountId').equals(account.id).toArray(),
    database.folderAccounts.where('accountId').equals(account.id).toArray(),
    database.notes.where('accountId').equals(account.id).reverse().sortBy('createdAt').then((notes) => active(notes).at(0)),
  ]);

  const [tags, folders] = await Promise.all([
    Promise.all(accountTags.map((join) => database.tags.get(join.tagId))),
    Promise.all(folderAccounts.map((join) => database.folders.get(join.folderId))),
  ]);

  return {
    ...account,
    company: company && !company.deletedAt ? company : undefined,
    tags: active(tags.filter(Boolean) as Tag[]),
    folders: active(folders.filter(Boolean) as Folder[]),
    latestNote,
  };
}

export async function listAccountSummaries(filters: AccountFilters = {}, database = db): Promise<AccountSummary[]> {
  const accounts = active(await database.accounts.toArray());
  const summaries = (await Promise.all(accounts.map((account) => getAccountSummary(account.id, database)))).filter(
    Boolean,
  ) as AccountSummary[];

  const query = filters.query?.trim().toLowerCase();
  return summaries
    .filter((summary) => {
      if (query) {
        const haystack = [
          summary.handle,
          summary.displayName,
          summary.company?.name,
          summary.role,
          summary.location,
          summary.relationshipSource,
          summary.latestNote?.body,
          ...summary.tags.map((tag) => tag.name),
          ...summary.folders.map((folder) => folder.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (filters.tagIds && !filters.tagIds.every((id) => summary.tags.some((tag) => tag.id === id))) return false;
      if (filters.folderIds && !filters.folderIds.every((id) => summary.folders.some((folder) => folder.id === id))) return false;
      if (filters.companyIds && !filters.companyIds.every((id) => summary.companyId === id)) return false;
      if (filters.tagId && !summary.tags.some((tag) => tag.id === filters.tagId)) return false;
      if (filters.folderId && !summary.folders.some((folder) => folder.id === filters.folderId)) return false;
      if (filters.companyId && summary.companyId !== filters.companyId) return false;
      if (filters.location && summary.location !== filters.location) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listTargetAccountSuggestions(
  database = db,
): Promise<TargetAccountSuggestion[]> {
  const accounts = active(await database.accounts.toArray())
    .filter((account) => account.platform === 'x');

  const suggestions = await Promise.all(accounts.map(async (account) => {
    const company = account.companyId ? await database.companies.get(account.companyId) : undefined;
    return {
      id: account.id,
      handle: account.handle,
      displayName: account.displayName,
      companyName: company && !company.deletedAt ? company.name : undefined,
      updatedAt: account.updatedAt,
    };
  }));

  return suggestions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function recordSearch(
  filters: XSearchFilters,
  url: string,
  accountId?: string,
  database = db,
): Promise<SearchHistory> {
  const history: SearchHistory = {
    id: createId('search'),
    platform: 'x',
    accountId,
    query: buildXSearchQuery(filters),
    url,
    filters,
    createdAt: nowIso(),
  };
  await database.searchHistory.add(history);
  return history;
}

export async function listSearchHistory(database = db): Promise<SearchHistory[]> {
  return database.searchHistory.orderBy('createdAt').reverse().limit(20).toArray();
}

export async function createSearchPreset(
  name: string,
  filters: XSearchFilters,
  database = db,
): Promise<SearchPreset> {
  const timestamp = nowIso();
  const preset: SearchPreset = {
    id: createId('preset'),
    name: name.trim(),
    platform: 'x',
    filters,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await database.searchPresets.add(preset);
  await recordChange(database, 'searchPreset', preset.id, 'create');
  return preset;
}

export async function listSearchPresets(database = db): Promise<SearchPreset[]> {
  return active(await database.searchPresets.orderBy('name').toArray());
}

export async function exportBackup(database = db): Promise<BackupEnvelope> {
  const [accounts, companies, tags, accountTags, folders, folderAccounts, notes, bookmarks, searchPresets, searchHistory, backups, changeLog] =
    await Promise.all([
      database.accounts.toArray(),
      database.companies.toArray(),
      database.tags.toArray(),
      database.accountTags.toArray(),
      database.folders.toArray(),
      database.folderAccounts.toArray(),
      database.notes.toArray(),
      database.bookmarks.toArray(),
      database.searchPresets.toArray(),
      database.searchHistory.toArray(),
      database.backups.toArray(),
      database.changeLog.toArray(),
    ]);

  return {
    app: 'Contexto',
    formatVersion: 2,
    exportedAt: nowIso(),
    data: { accounts, companies, tags, accountTags, folders, folderAccounts, notes, bookmarks, searchPresets, searchHistory, backups, changeLog },
  };
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`Backup field ${label} must be an array`);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateImportedBookmarks(
  records: unknown[],
  accounts: Account[],
): asserts records is Bookmark[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  for (const value of records) {
    if (!value || typeof value !== 'object') throw new Error('Backup bookmark must be an object');
    const bookmark = value as Partial<Bookmark>;
    const account = typeof bookmark.accountId === 'string' ? accountsById.get(bookmark.accountId) : undefined;
    if (!account) throw new Error('Backup bookmark owning account was not found');
    const parsed = typeof bookmark.postUrl === 'string' ? parseXPostUrl(bookmark.postUrl) : null;
    if (
      typeof bookmark.id !== 'string'
      || bookmark.platform !== 'x'
      || !parsed
      || parsed.postUrl !== bookmark.postUrl
      || parsed.postId !== bookmark.postId
      || parsed.handle !== normalizeXHandle(account.normalizedHandle)
      || account.platform !== 'x'
      || !validTimestamp(bookmark.createdAt)
      || !validTimestamp(bookmark.updatedAt)
      || !validTimestamp(bookmark.capturedAt)
      || (bookmark.completedAt !== undefined && !validTimestamp(bookmark.completedAt))
      || (bookmark.deletedAt !== undefined && !validTimestamp(bookmark.deletedAt))
    ) {
      throw new Error('Backup bookmark is invalid');
    }
    normalizeBookmarkExcerpt(bookmark.excerpt);
    normalizeBookmarkReminder(bookmark.reminder);
  }
}

export async function importBackup(envelope: BackupImportEnvelope, database = db): Promise<void> {
  if (envelope.app !== 'Contexto' || ![1, 2].includes(envelope.formatVersion)) {
    throw new Error('Unsupported Contexto backup format');
  }

  const data = envelope.data;
  for (const [key, value] of Object.entries(data)) {
    assertArray(value, key);
  }
  const bookmarks: unknown[] = envelope.formatVersion === 2 ? envelope.data.bookmarks : [];
  assertArray(bookmarks, 'bookmarks');
  validateImportedBookmarks(bookmarks, data.accounts);

  await database.transaction(
    'rw',
    [
      database.accounts,
      database.companies,
      database.tags,
      database.accountTags,
      database.folders,
      database.folderAccounts,
      database.notes,
      database.bookmarks,
      database.searchPresets,
      database.searchHistory,
      database.backups,
      database.changeLog,
    ],
    async () => {
      await Promise.all([
        database.accounts.bulkPut(data.accounts),
        database.companies.bulkPut(data.companies),
        database.tags.bulkPut(data.tags),
        database.accountTags.bulkPut(data.accountTags),
        database.folders.bulkPut(data.folders),
        database.folderAccounts.bulkPut(data.folderAccounts),
        database.notes.bulkPut(data.notes),
        database.bookmarks.bulkPut(bookmarks),
        database.searchPresets.bulkPut(data.searchPresets),
        database.searchHistory.bulkPut(data.searchHistory),
        database.backups.bulkPut(data.backups),
        database.changeLog.bulkPut(data.changeLog),
      ]);

      const backupRecord: BackupRecord = {
        id: createId('backup'),
        createdAt: nowIso(),
        formatVersion: envelope.formatVersion,
        itemCounts: {
          ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length])),
          bookmarks: bookmarks.length,
        },
      };
      await database.backups.put(backupRecord);
      await database.changeLog.add({
        id: createId('change'),
        entityType: 'account',
        entityId: backupRecord.id,
        operation: 'import',
        changedAt: nowIso(),
      });
    },
  );
}

export async function resetDatabaseForTests(database: ContextoDatabase): Promise<void> {
  await database.delete();
  await database.open();
}
