# Feature: Contact Catch-Up

Contact catch-up gives each saved X account an explicit review checkpoint. It is available from the saved-contact feed panel and the selected-contact dashboard detail.

## Catch up on X

**Catch up on X** opens a safe new tab with X live results for the saved author's posts. When a checkpoint exists, the query is `from:contact since:YYYY-MM-DD`, using the checkpoint's UTC date. X search is date-granular, so previously reviewed posts from that same day can appear again.

Before the first checkpoint, the action opens `from:contact` without a date constraint. Invalid handles or checkpoint timestamps do not produce a search URL.

Opening the search is read-only. It does not change the account, advance the checkpoint, or add a Contexto search-history record.

## Mark caught up

**Mark caught up** explicitly stores the current time as `Account.lastCatchUpAt`. The account becomes pending sync, its update timestamp advances, and the mutation is added to the change log. Feed state updates from the authoritative account returned by the background service worker; dashboard state updates through its live IndexedDB query.

While the write is pending, the action is disabled. Success shows a confirmation and changes subsequent catch-up searches. Failure preserves the existing checkpoint and relationship context.

## Persistence and backup

`lastCatchUpAt` is an optional ISO timestamp on the existing account record. It needs no Dexie index or schema migration. Existing accounts behave as not-yet-reviewed until explicitly marked.

Backup format 2 already exports and imports complete account records, so the checkpoint round-trips without a format bump. Legacy backups and account records without the field remain valid.
