import Dexie, { type EntityTable } from 'dexie';
import type {
  Account,
  AccountTag,
  BackupRecord,
  ChangeLogEntry,
  Company,
  Folder,
  FolderAccount,
  Note,
  SearchHistory,
  SearchPreset,
  Tag,
} from '../shared/types';

export class ContextoDatabase extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  companies!: EntityTable<Company, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  accountTags!: EntityTable<AccountTag, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  folderAccounts!: EntityTable<FolderAccount, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  searchPresets!: EntityTable<SearchPreset, 'id'>;
  searchHistory!: EntityTable<SearchHistory, 'id'>;
  backups!: EntityTable<BackupRecord, 'id'>;
  changeLog!: EntityTable<ChangeLogEntry, 'id'>;

  constructor(name = 'ContextoDatabase') {
    super(name);

    this.version(1).stores({
      accounts:
        'id, &[platform+normalizedHandle], platform, normalizedHandle, displayName, companyId, profession, position, location, updatedAt, deletedAt',
      companies: 'id, &normalizedName, name, updatedAt, deletedAt',
      tags: 'id, &normalizedName, name, updatedAt, deletedAt',
      accountTags: 'id, &[accountId+tagId], accountId, tagId',
      folders: 'id, &normalizedName, name, updatedAt, deletedAt',
      folderAccounts: 'id, &[folderId+accountId], folderId, accountId',
      notes: 'id, accountId, createdAt, updatedAt, deletedAt',
      searchPresets: 'id, platform, name, updatedAt, deletedAt',
      searchHistory: 'id, platform, accountId, createdAt',
      backups: 'id, createdAt',
      changeLog: 'id, entityType, entityId, changedAt',
    });

    this.version(2).stores({
      accounts:
        'id, &[platform+normalizedHandle], platform, normalizedHandle, displayName, companyId, role, location, updatedAt, deletedAt',
      companies: 'id, &normalizedName, name, updatedAt, deletedAt',
      tags: 'id, &normalizedName, name, updatedAt, deletedAt',
      accountTags: 'id, &[accountId+tagId], accountId, tagId',
      folders: 'id, &normalizedName, name, updatedAt, deletedAt',
      folderAccounts: 'id, &[folderId+accountId], folderId, accountId',
      notes: 'id, accountId, createdAt, updatedAt, deletedAt',
      searchPresets: 'id, platform, name, updatedAt, deletedAt',
      searchHistory: 'id, platform, accountId, createdAt',
      backups: 'id, createdAt',
      changeLog: 'id, entityType, entityId, changedAt',
    }).upgrade(async (transaction) => {
      await transaction.table('accounts').toCollection().modify((account: Record<string, unknown>) => {
        delete account.profession;
        delete account.position;
      });
    });
  }
}

export const db = new ContextoDatabase();
