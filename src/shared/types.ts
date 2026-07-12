export type Platform = 'x' | 'linkedin' | 'reddit';

export type RecordId = string;

export interface TimestampedRecord {
  id: RecordId;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Account extends TimestampedRecord {
  platform: Platform;
  handle: string;
  normalizedHandle: string;
  displayName: string;
  profileUrl: string;
  avatarUrl?: string;
  bioSnapshot?: string;
  role?: string;
  companyId?: RecordId;
  location?: string;
  relationshipSource?: string;
  syncState: 'local-only' | 'pending-sync' | 'synced' | 'conflict';
}

export interface Company extends TimestampedRecord {
  name: string;
  normalizedName: string;
  website?: string;
  notes?: string;
}

export interface Tag extends TimestampedRecord {
  name: string;
  normalizedName: string;
  color?: string;
}

export interface AccountTag {
  id: RecordId;
  accountId: RecordId;
  tagId: RecordId;
  createdAt: string;
}

export interface Folder extends TimestampedRecord {
  name: string;
  normalizedName: string;
  description?: string;
}

export interface FolderAccount {
  id: RecordId;
  folderId: RecordId;
  accountId: RecordId;
  createdAt: string;
}

export interface Note extends TimestampedRecord {
  accountId: RecordId;
  body: string;
  source?: 'manual' | 'import' | 'x-profile';
}

export type SearchDirection =
  | 'me-to-them'
  | 'them-to-me'
  | 'from-profile'
  | 'to-profile'
  | 'mentions';

export interface XSearchFilters {
  viewerHandle?: string;
  targetHandle?: string;
  keyword?: string;
  since?: string;
  until?: string;
  direction: SearchDirection;
}

export interface SearchPreset extends TimestampedRecord {
  name: string;
  platform: Platform;
  filters: XSearchFilters;
}

export interface SearchHistory {
  id: RecordId;
  platform: Platform;
  accountId?: RecordId;
  query: string;
  url: string;
  filters: XSearchFilters;
  createdAt: string;
}

export interface BackupRecord {
  id: RecordId;
  createdAt: string;
  formatVersion: number;
  itemCounts: Record<string, number>;
}

export type ChangeEntityType =
  | 'account'
  | 'company'
  | 'tag'
  | 'folder'
  | 'note'
  | 'searchPreset';

export interface ChangeLogEntry {
  id: RecordId;
  entityType: ChangeEntityType;
  entityId: RecordId;
  operation: 'create' | 'update' | 'delete' | 'import';
  changedAt: string;
}

export interface ProfileSnapshot {
  platform: Platform;
  handle: string;
  displayName?: string;
  profileUrl: string;
  avatarUrl?: string;
  bioSnapshot?: string;
  location?: string;
  capturedAt?: string;
}

export interface XPostSnapshot {
  platform: 'x';
  authorHandle: string;
  postId: string;
  postUrl: string;
  excerpt?: string;
}

export interface AccountSummary extends Account {
  company?: Company;
  tags: Tag[];
  folders: Folder[];
  latestNote?: Note;
}

export interface AccountFilters {
  query?: string;
  tagId?: RecordId;
  folderId?: RecordId;
  companyId?: RecordId;
  location?: string;
}

export interface AccountUpdateInput {
  displayName?: string;
  role?: string;
  companyName?: string;
  companyId?: RecordId;
  location?: string;
  relationshipSource?: string;
  bioSnapshot?: string;
}

export interface AccountContextSaveInput {
  profile: ProfileSnapshot;
  metadata: AccountUpdateInput;
  tagNames: string[];
  folderNames: string[];
}

export interface ContextoSettings {
  myXHandle: string;
  lastDashboardView: 'accounts' | 'search' | 'settings';
}

export interface PopupSearchState {
  targetHandle: string;
  keyword: string;
  since: string;
  until: string;
}

export interface LookupData {
  companies: Company[];
  tags: Tag[];
  folders: Folder[];
}

export interface BackupEnvelope {
  app: 'Contexto';
  formatVersion: 1;
  exportedAt: string;
  data: {
    accounts: Account[];
    companies: Company[];
    tags: Tag[];
    accountTags: AccountTag[];
    folders: Folder[];
    folderAccounts: FolderAccount[];
    notes: Note[];
    searchPresets: SearchPreset[];
    searchHistory: SearchHistory[];
    backups: BackupRecord[];
    changeLog: ChangeLogEntry[];
  };
}
