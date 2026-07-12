# Contact Post Bookmarks Design

**Date:** 2026-07-12

## Summary

Contexto will let a user capture an X post as a first-class bookmark belonging to an already-saved contact. A bookmark keeps the canonical post URL, a short text excerpt, an optional personal reminder, and capture metadata. Capture happens inline in the existing saved-contact feed panel; review and removal happen in the selected contact's dashboard detail.

Bookmarks are separate from notes. Notes remain relationship history, while bookmarks represent source material the user wants to revisit for a specific person. This slice completes a small capture-to-review loop without creating unknown contacts, downloading media, or introducing a new application surface.

## Goals

- Capture useful X posts without leaving the feed.
- Preserve why the post matters through an optional personal reminder.
- Give each saved contact a one-to-many bookmark collection.
- Make captured items recognizable through a bounded post-text excerpt.
- Let users revisit and remove bookmarks from the existing dashboard contact detail.
- Preserve local-first storage, backup completeness, and the current content-script/background boundary.
- Fail closed when X post identity, URL, or text evidence is inconsistent.

## Non-goals

- Capturing posts by unknown authors or implicitly creating contacts.
- Treating a bookmark as a note or mixing bookmarks into relationship history.
- Editing bookmark reminders after capture.
- Listing bookmarks in the X full-profile editor or compact feed panel.
- Capturing media, quoted-post text, replies, engagement counts, external link previews, or post threads.
- Bookmark folders, tags, search, ranking, summarization, or reminders with due dates.
- Supporting non-X links or other platforms in this slice.
- Restoring a removed bookmark through dashboard UI. Recapture from X is the restore path.

## Data Model

Add a `Bookmark` record:

```ts
interface Bookmark extends TimestampedRecord {
  accountId: RecordId;
  platform: 'x';
  postId: string;
  postUrl: string;
  excerpt?: string;
  reminder?: string;
  capturedAt: string;
}
```

`capturedAt` is the user-visible capture timestamp. `createdAt` preserves the record's original creation, `updatedAt` tracks its latest mutation, and `deletedAt` implements soft deletion. Recapturing a removed bookmark refreshes `capturedAt` and `updatedAt` while preserving `createdAt`.

Dexie advances to schema version 3 and adds a `bookmarks` table with indexes for `accountId`, `createdAt`, `deletedAt`, and a unique compound `[accountId+postUrl]` key. The compound key makes a post unique within one contact while allowing a future cross-contact reference if needed. Recapturing a soft-deleted bookmark restores and updates that record instead of inserting another row.

`bookmark` is added to `ChangeEntityType`. Creating, restoring, and deleting a bookmark adds a corresponding change-log entry and updates the owning account's `updatedAt` and `syncState`.

Bookmarks do not become part of `AccountSummary`. They have a focused query path so ordinary account lists and saved-contact feed lookups do not load every captured item.

## Canonical X Post Snapshot

Feed extraction will return a separate post snapshot alongside the existing primary-author `ProfileSnapshot`:

```ts
interface XPostSnapshot {
  platform: 'x';
  authorHandle: string;
  postId: string;
  postUrl: string;
  excerpt?: string;
}
```

The feed extractor must:

- Continue validating the primary author through one coherent identity subtree.
- Find a top-level status link whose path is exactly `/<primary-handle>/status/<numeric-id>` with an optional trailing slash.
- Accept only `x.com`, `www.x.com`, `twitter.com`, or `www.twitter.com` as source hosts.
- Normalize the stored URL to `https://x.com/<normalized-handle>/status/<id>` and discard query strings, fragments, and alternate hosts.
- Read at most one top-level `[data-testid="tweetText"]` whose closest tweet root is the candidate post.
- Normalize excerpt whitespace and truncate it to 280 Unicode code points.
- Exclude quoted-post status links and text, nested cards, reply targets, mentions, and promoted content.
- Return no post snapshot when the primary status URL is missing, ambiguous, or inconsistent with the validated author.

The existing saved-contact relationship marker may still render when a post snapshot cannot be extracted. Only the capture action is omitted in that case.

The background repeats URL validation before persistence. It verifies that the account exists, is an X account, and has the same normalized handle as the canonical status URL. Content-script evidence is never trusted as authoritative input.

## Repository and Message Boundaries

Add focused repository operations:

- `captureBookmark(accountId, input)` validates and creates, returns an existing active duplicate unchanged, or restores a soft-deleted duplicate.
- `findBookmarkByPost(accountId, postUrl)` returns an active matching bookmark when present.
- `listBookmarks(accountId)` returns active bookmarks newest first by `capturedAt`.
- `removeBookmark(bookmarkId)` soft-deletes the bookmark.

The message boundary adds:

- `contexto:bookmark:lookup` with `accountId` and canonical `postUrl`.
- `contexto:bookmark:capture` with `accountId`, `authorHandle`, `postUrl`, optional `excerpt`, and optional `reminder`.

Capture returns the authoritative bookmark. Lookup returns a dedicated optional bookmark result. The dashboard runs in the extension origin and continues to call repositories directly, following its existing pattern.

The reminder is trimmed, internal whitespace is normalized without removing deliberate line breaks, and its maximum length is 500 Unicode code points. Empty reminders are stored as `undefined`. Excerpts are normalized to a single line and bounded to 280 code points. Oversized or malformed message input is rejected rather than silently accepting an unbounded payload.

## Feed Capture Interaction

The existing `ContextoFeedContext` continues to appear only after `contexto:account:lookup` returns an already-saved account. When a valid post snapshot is available, it also performs a bookmark lookup for that account and post URL.

For an uncaptured post, the relationship panel includes **Capture this post**. Activating it reveals an inline composer containing:

- A textarea labeled **Why are you saving this? (optional)**.
- **Save bookmark**.
- **Cancel**.

The textarea receives focus. Save is allowed with an empty reminder because the URL and excerpt still form a useful bookmark. Cancel collapses the composer and clears the draft. Closing the compact relationship panel also clears an unsaved bookmark reminder.

While saving, the textarea and actions are disabled and the save label communicates progress. A successful response clears and collapses the composer, updates local state to bookmarked, and announces **Bookmark saved** through a polite status region. The action then reads **Bookmarked** and is disabled.

A failed save keeps the composer and reminder intact, displays a local error, and allows retry. It does not close the relationship panel or open the full editor. Bookmark lookup failure keeps the relationship context usable but hides the capture action, preferring a silent unavailable state over an action whose duplicate state is unknown.

Existing outside-pointer and Escape behavior still closes the compact feed panel. The persistent close contract for the Contexto-owned full editor is unchanged.

## Dashboard Bookmark Collection

The selected contact detail gains a **Bookmarks** section. It queries that account's active bookmarks and displays them newest first.

Each bookmark card shows:

- The reminder, when present.
- The excerpt, when present.
- The capture date.
- An **Open on X** link using the canonical URL and safe new-tab attributes.
- A **Remove** button.

An item with neither reminder nor excerpt still shows its date and source link. Removing an item is immediate and does not show a confirmation dialog in this slice. The local collection updates after the repository operation succeeds. A failed removal leaves the card in place and shows an actionable local error. The empty state explains that bookmarks can be captured from saved contacts' posts on X.

Reminder editing is deferred. Users may remove and recapture a post to supply a different reminder until an explicit edit workflow is designed.

## Backup and Import Compatibility

Bookmarks are included in JSON backup and restore from their introduction.

- Export advances `BackupEnvelope.formatVersion` to 2 and includes `data.bookmarks`.
- Import accepts legacy version 1 envelopes by treating bookmarks as an empty list.
- Import accepts version 2 envelopes only when `bookmarks` is an array and every bookmark has a valid ID, existing owning account, X platform, canonical post URL, matching account handle, numeric post ID, valid record and capture timestamps, and bounded optional text.
- Version 2 import writes bookmarks in the same transaction as the other records.
- Malformed version 2 bookmark data rejects the complete import rather than partially restoring it.
- Backup metadata item counts include bookmarks.

This compatibility rule preserves existing user backups while keeping new exports complete.

## Error and Lifecycle Behavior

- Unknown author: no Contexto marker and no capture action.
- Saved author with invalid or ambiguous post source: relationship context renders without capture.
- Promoted or nested quoted post: no capture snapshot.
- Bookmark lookup failure: hide capture while preserving relationship context.
- Duplicate active bookmark: show **Bookmarked**; storage also returns the existing record to close races.
- Recapture after soft deletion: restore the existing bookmark with the new excerpt and reminder.
- Capture failure: preserve composer state and allow retry.
- Dashboard list failure: show a local section error without breaking other contact details.
- Remove failure: preserve the item and allow retry.
- Recycled or disconnected X post host: existing surface cleanup unmounts the capture UI and discards memory-only drafts.
- Extension navigation or reload: all open composers and statuses are ephemeral and reset through existing lifecycle cleanup.

## Testing

### Extraction fixtures

Add or extend minimal X fixtures and assertions for:

- A primary-author post with canonical status link and top-level text.
- Query-string and alternate-host normalization.
- A quoted post, proving nested URL and text are excluded.
- A reply target or mention, proving it cannot become the bookmark author.
- Ambiguous, mismatched, nonnumeric, and missing status URLs, proving capture fails closed while profile extraction can still succeed.
- A promoted post, proving no capture snapshot is returned.

### Repository, schema, and backup tests

Assert:

- Capture creates one bookmark with normalized bounded fields.
- Active duplicate capture returns the existing record without duplication.
- Remove soft-deletes and excludes the bookmark from active lists.
- Recapture restores the same record and replaces its excerpt and reminder.
- Cross-account, mismatched-handle, malformed URL, and oversized input are rejected.
- Lists are account-scoped and newest first.
- Change-log and owning-account mutation metadata are updated.
- Version 2 backup round-trips bookmarks.
- Version 1 backup import remains supported with no bookmarks.
- Malformed or orphaned version 2 bookmarks reject the transaction.

### Message and component tests

Assert:

- Background lookup and capture messages delegate correctly and return typed results.
- The capture action appears only for a saved contact with a valid post snapshot and successful duplicate lookup.
- The composer opens, focuses, cancels, and clears on panel close.
- Empty reminders can be saved.
- Saving disables controls; success announces and becomes **Bookmarked**.
- Failure preserves the reminder and allows retry.
- Existing **Open full context** behavior remains intact.
- Dashboard lists multiple bookmarks newest first, renders sparse items, opens canonical links safely, removes successfully, and preserves items on removal failure.

### Regression and manual verification

Run `npm run compile`, the complete Vitest suite, `npm run build`, and `npm run verify:popup`. Manually verify Home, Following, profile timelines, and search results in Chrome and Vivaldi, including standard, reply, quoted, promoted, duplicate, empty-reminder, failed-save, virtualized-scroll, extension-reload, light-theme, and dark-theme cases.

## Delivery Boundaries

This slice is complete when a user can capture a supported post by an already-saved contact with an optional reminder, see duplicate state in the feed, review all active bookmarks for that contact in the dashboard, open the source post, remove a bookmark, and preserve bookmarks through export/import.

Editing reminders, capturing unknown authors, non-X bookmarks, media and link previews, bookmark organization, search, and automated insights remain follow-up work.
