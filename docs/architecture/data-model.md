# Data Model

The current schema lives in `src/data/db.ts` and is versioned as Dexie version `1`.

## Core Records

- `accounts`: platform-neutral social accounts. Important fields include `platform`, `handle`, `normalizedHandle`, `displayName`, `profileUrl`, `profession`, `position`, `companyId`, `location`, `relationshipSource`, `syncState`, timestamps, and soft-delete metadata.
- `companies`: normalized company records referenced by accounts.
- `tags` and `accountTags`: many-to-many account labels.
- `folders` and `folderAccounts`: many-to-many relationship groups.
- `notes`: timestamped account notes.
- `searchPresets`: saved search filters for future expansion.
- `searchHistory`: generated X search URLs and filter payloads.
- `backups`: local record of import events and backup metadata.
- `changeLog`: append-only local mutation log for future sync.

## Indexes

The important uniqueness constraints are:

- `accounts`: unique compound `[platform+normalizedHandle]`.
- `companies`: unique `normalizedName`.
- `tags`: unique `normalizedName`.
- `folders`: unique `normalizedName`.
- `accountTags`: unique compound `[accountId+tagId]`.
- `folderAccounts`: unique compound `[folderId+accountId]`.

## Sync Readiness

Every user-edited core record uses stable UUID-based IDs and timestamps. Deletes should remain soft deletes when remote sync is introduced so another client can converge without losing intent.
