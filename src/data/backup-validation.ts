import type { BackupEnvelope } from '../shared/types';
import { normalizeXHandle, parseXProfileUrl } from '../shared/platforms/x';
import { preserveLegacyAccountFields } from './legacy-account';

export const backupTables = ['accounts', 'companies', 'tags', 'accountTags', 'folders', 'folderAccounts',
  'notes', 'bookmarks', 'searchPresets', 'searchHistory', 'backups', 'changeLog'] as const;
export type BackupTable = typeof backupTables[number];
type Row = Record<string, unknown>;

function object(value: unknown, label: string): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Row;
}
function text(row: Row, field: string, label: string, required = true) {
  if (row[field] === undefined && !required) return;
  if (typeof row[field] !== 'string') throw new Error(`${label}.${field} must be text`);
}
function timestamp(row: Row, field: string, label: string, required = true) {
  if (row[field] === undefined && !required) return;
  if (typeof row[field] !== 'string' || Number.isNaN(Date.parse(row[field] as string))) {
    throw new Error(`${label}.${field} must be a valid timestamp`);
  }
}
function oneOf(row: Row, field: string, values: string[], label: string, required = true) {
  if (row[field] === undefined && !required) return;
  if (!values.includes(row[field] as string)) throw new Error(`${label}.${field} is invalid`);
}
function filters(value: unknown, label: string) {
  const row = object(value, label);
  oneOf(row, 'direction', ['me-to-them', 'them-to-me', 'from-profile', 'to-profile', 'mentions'], label);
  for (const field of ['viewerHandle', 'targetHandle', 'keyword', 'since', 'until']) text(row, field, label, false);
}

/** Validate the whole document before opening a write transaction. Keep every unknown record field. */
export function validateBackup(value: unknown): BackupEnvelope {
  const envelope = object(value, 'Backup');
  if (envelope.app !== 'Contexto' || ![1, 2].includes(envelope.formatVersion as number)) {
    throw new Error('Unsupported Contexto backup format');
  }
  timestamp(envelope, 'exportedAt', 'Backup');
  const source = object(envelope.data, 'Backup data');
  for (const key of Object.keys(source)) {
    if (!(backupTables as readonly string[]).includes(key)) throw new Error(`Unknown backup table ${key}; update Contexto before importing`);
  }
  const data = {} as Record<BackupTable, Row[]>;
  const ids = {} as Record<BackupTable, Set<string>>;
  for (const table of backupTables) {
    const rows = table === 'bookmarks' && envelope.formatVersion === 1 && source[table] === undefined ? [] : source[table];
    if (!Array.isArray(rows)) throw new Error(`Backup field ${table} must be an array`);
    ids[table] = new Set();
    data[table] = rows.map((value, index) => {
      const label = `${table}[${index}]`;
      const row = { ...object(value, label) };
      text(row, 'id', label);
      if (!(row.id as string).trim() || ids[table].has(row.id as string)) throw new Error(`${label} has a blank or duplicate ID`);
      ids[table].add(row.id as string);
      if (table !== 'changeLog') timestamp(row, 'createdAt', label);
      if (['accounts', 'companies', 'tags', 'folders', 'notes', 'bookmarks', 'searchPresets'].includes(table)) {
        timestamp(row, 'updatedAt', label);
        timestamp(row, 'deletedAt', label, false);
      }
      return row;
    });
  }
  function ref(row: Row, field: string, table: BackupTable, label: string, required = true) {
    if (row[field] === undefined && !required) return;
    if (typeof row[field] !== 'string' || !ids[table].has(row[field] as string)) {
      throw new Error(`${label}.${field} references a missing ${table} record`);
    }
  }
  function unique(table: BackupTable, key: (row: Row) => string) {
    const seen = new Set<string>();
    for (const row of data[table]) {
      const value = key(row);
      if (seen.has(value)) throw new Error(`Duplicate ${table} identity in backup`);
      seen.add(value);
    }
  }
  for (const row of data.accounts) {
    const label = `Account ${row.id}`;
    oneOf(row, 'platform', ['x', 'linkedin', 'reddit'], label);
    oneOf(row, 'syncState', ['local-only', 'pending-sync', 'synced', 'conflict'], label);
    for (const f of ['handle', 'normalizedHandle', 'displayName', 'profileUrl']) text(row, f, label);
    for (const f of ['avatarUrl', 'bioSnapshot', 'website', 'role', 'location', 'relationshipSource', 'profession', 'position']) text(row, f, label, false);
    timestamp(row, 'lastCatchUpAt', label, false);
    ref(row, 'companyId', 'companies', label, false);
    if (row.xUserId !== undefined && (row.platform !== 'x' || typeof row.xUserId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(row.xUserId))) {
      throw new Error('X user ID must be a positive numeric string of up to 19 digits on an X account');
    }
    if (row.platform === 'x') {
      const parsed = parseXProfileUrl(row.profileUrl as string);
      if (!parsed || normalizeXHandle(row.handle as string) !== row.normalizedHandle || parsed.handle !== row.normalizedHandle) {
        throw new Error(`${label} has inconsistent X identity`);
      }
    } else if (!row.normalizedHandle || (row.handle as string).trim().toLowerCase() !== row.normalizedHandle) {
      throw new Error(`${label} has inconsistent identity`);
    }
    preserveLegacyAccountFields(row);
  }
  unique('accounts', (row) => JSON.stringify([row.platform, row.normalizedHandle]));
  // A stable X ID cannot identify two contacts, even when handles differ.
  const xIds = data.accounts.filter((row) => row.xUserId !== undefined).map((row) => row.xUserId);
  if (new Set(xIds).size !== xIds.length) throw new Error('Duplicate X user ID in backup');
  for (const table of ['companies', 'tags', 'folders'] as const) {
    for (const row of data[table]) {
      text(row, 'name', table); text(row, 'normalizedName', table);
      if (!(row.name as string).trim() || (row.name as string).trim().replace(/\s+/g, ' ').toLowerCase() !== row.normalizedName) {
        throw new Error(`${table} has inconsistent normalized name`);
      }
      for (const f of table === 'companies' ? ['website', 'notes'] : table === 'tags' ? ['color'] : ['description']) text(row, f, table, false);
    }
    unique(table, (row) => row.normalizedName as string);
  }
  for (const row of data.accountTags) {
    ref(row, 'accountId', 'accounts', 'Tag assignment'); ref(row, 'tagId', 'tags', 'Tag assignment');
  }
  unique('accountTags', (row) => JSON.stringify([row.accountId, row.tagId]));
  for (const row of data.folderAccounts) {
    ref(row, 'accountId', 'accounts', 'Circle assignment'); ref(row, 'folderId', 'folders', 'Circle assignment');
  }
  unique('folderAccounts', (row) => JSON.stringify([row.folderId, row.accountId]));
  for (const row of data.notes) {
    ref(row, 'accountId', 'accounts', 'Note'); text(row, 'body', 'Note');
    oneOf(row, 'source', ['manual', 'import', 'x-profile'], 'Note', false);
  }
  // Detailed bookmark URL, ownership, text, and timestamp checks run in the repository.
  for (const row of data.bookmarks) {
    if (!ids.accounts.has(row.accountId as string)) throw new Error('Backup bookmark owning account was not found');
  }
  unique('bookmarks', (row) => JSON.stringify([row.accountId, row.postUrl]));
  for (const row of data.searchPresets) {
    text(row, 'name', 'Search preset'); oneOf(row, 'platform', ['x', 'linkedin', 'reddit'], 'Search preset'); filters(row.filters, 'Search preset filters');
  }
  for (const row of data.searchHistory) {
    oneOf(row, 'platform', ['x', 'linkedin', 'reddit'], 'Search history');
    ref(row, 'accountId', 'accounts', 'Search history', false);
    text(row, 'query', 'Search history'); text(row, 'url', 'Search history'); filters(row.filters, 'Search history filters');
  }
  for (const row of data.backups) {
    if (!Number.isInteger(row.formatVersion) || (row.formatVersion as number) < 1) throw new Error('Invalid backup metadata version');
    const counts = object(row.itemCounts, 'Backup item counts');
    if (Object.values(counts).some((count) => !Number.isSafeInteger(count) || (count as number) < 0)) throw new Error('Invalid backup item counts');
  }
  for (const row of data.changeLog) {
    text(row, 'entityId', 'Change log'); timestamp(row, 'changedAt', 'Change log');
    oneOf(row, 'entityType', ['account', 'company', 'tag', 'folder', 'note', 'bookmark', 'searchPreset', 'groupingCatalog'], 'Change log');
    oneOf(row, 'operation', ['create', 'update', 'delete', 'import'], 'Change log');
  }
  return { app: 'Contexto', formatVersion: 2, exportedAt: envelope.exportedAt as string, data } as unknown as BackupEnvelope;
}
