# Contact Post Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users capture supported X posts by saved contacts with an optional reminder, then review, open, and remove those bookmarks from the dashboard.

**Architecture:** Stable X status URL parsing lives in the shared X adapter; transient post URL/text extraction stays in the X DOM boundary. A focused `bookmarks` Dexie table and repository API sit behind typed background messages for content-script capture, while a small dashboard component reads repositories directly. Bookmarks remain separate from notes and from `AccountSummary`.

**Tech Stack:** TypeScript 5.9, React 19, WXT MV3, Dexie 4, Vitest 4, Testing Library, jsdom, fake-indexeddb.

## Global Constraints

- Capture is available only for already-saved X contacts; it must never create an unknown account.
- Accept only canonicalizable `x.com`/`twitter.com` status URLs whose numeric post ID and author handle match the saved account.
- Store at most 280 Unicode code points of single-line excerpt and 500 Unicode code points of optional reminder text.
- Exclude promoted posts, quoted-post URL/text, reply targets, mentions, media, engagement data, and external previews.
- Active bookmarks are unique by `[accountId+postUrl]`; recapture restores a soft-deleted record and refreshes `capturedAt`.
- Keep bookmarks out of `AccountSummary`; use focused bookmark lookup/list operations.
- Export backup format 2 with bookmarks and continue importing format 1 with an empty bookmark collection.
- Update a minimal X DOM fixture for every new captured DOM shape.
- Preserve existing saved-contact panel and owned-editor lifecycle contracts.
- No new runtime dependency or browser permission.

---

### Task 1: Canonical X Post Parsing and Feed Snapshot Extraction

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/platforms/x.ts`
- Modify: `src/x/feed-post-extraction.ts`
- Modify: `tests/feed-post-extraction.test.ts`
- Modify: `tests/fixtures/x/feed-post-primary-author.html`
- Modify: `tests/feed-post-fixture.test.ts`
- Modify: `tests/x-search.test.ts`

**Interfaces:**
- Produces: `XPostSnapshot` with `platform`, `authorHandle`, `postId`, `postUrl`, and optional `excerpt`.
- Produces: `parseXPostUrl(value: string): { handle: string; postId: string; postUrl: string } | null`.
- Produces: `extractFeedPostSnapshot(post: HTMLElement): XPostSnapshot | null` while retaining `extractFeedPostProfile`.

- [ ] **Step 1: Write failing stable-parser and DOM-extraction tests**

Add assertions equivalent to:

```ts
expect(parseXPostUrl('https://twitter.com/Theo/status/123?ref=home#x')).toEqual({
  handle: 'theo', postId: '123', postUrl: 'https://x.com/theo/status/123',
});
expect(parseXPostUrl('https://example.com/theo/status/123')).toBeNull();
expect(parseXPostUrl('https://x.com/theo/status/not-numeric')).toBeNull();

const snapshot = extractFeedPostSnapshot(createPost(`
  <div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>
  <a href="/theo/status/123"><time>2h</time></a>
  <div data-testid="tweetText">  A useful   release update. </div>
  <div data-testid="tweet">
    <a href="/quoted/status/456"><time>1h</time></a>
    <div data-testid="tweetText">Quoted text</div>
  </div>`));
expect(snapshot).toEqual({
  platform: 'x', authorHandle: 'theo', postId: '123',
  postUrl: 'https://x.com/theo/status/123', excerpt: 'A useful release update.',
});
```

Also assert that mismatched primary-author links, two distinct valid top-level status links, quoted-only links/text, and promoted posts return no snapshot. Update the fixture with one primary status link/text plus nested quoted status link/text and assert only the primary snapshot.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/x-search.test.ts tests/feed-post-extraction.test.ts tests/feed-post-fixture.test.ts`

Expected: FAIL because `parseXPostUrl`, `XPostSnapshot`, and `extractFeedPostSnapshot` do not exist.

- [ ] **Step 3: Implement the shared parser and bounded DOM snapshot**

Add the shared type:

```ts
export interface XPostSnapshot {
  platform: 'x';
  authorHandle: string;
  postId: string;
  postUrl: string;
  excerpt?: string;
}
```

In the X adapter, parse with `new URL(value, 'https://x.com')`, require an allowed lowercase hostname, match exactly `^/([A-Za-z0-9_]{1,15})/status/(\d+)/?$`, normalize the handle with `normalizeXHandle`, and return the query/fragment-free `https://x.com/${handle}/status/${postId}` URL.

In the DOM extractor, reuse `findFeedPostIdentity`, filter every status anchor and tweet-text node with `node.closest('[data-testid="tweet"]') === post`, parse status anchors through `parseXPostUrl`, retain only snapshots whose handle equals the validated identity, deduplicate identical canonical URLs, require exactly one distinct canonical URL, collapse excerpt whitespace, and truncate with `[...text].slice(0, 280).join('')`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx vitest run tests/x-search.test.ts tests/feed-post-extraction.test.ts tests/feed-post-fixture.test.ts`

Expected: all selected test files pass.

- [ ] **Step 5: Commit the extraction boundary**

```bash
git add src/shared/types.ts src/shared/platforms/x.ts src/x/feed-post-extraction.ts tests/feed-post-extraction.test.ts tests/feed-post-fixture.test.ts tests/fixtures/x/feed-post-primary-author.html tests/x-search.test.ts
git commit -m "feat: extract canonical X post snapshots"
```

---

### Task 2: Bookmark Schema, Repository Operations, and Backup Compatibility

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/data/db.ts`
- Modify: `src/data/repositories.ts`
- Modify: `tests/repositories.test.ts`

**Interfaces:**
- Consumes: `parseXPostUrl` from Task 1.
- Produces: `Bookmark` and `BookmarkCaptureInput`.
- Produces: `captureBookmark(accountId, input, database?)`, `findBookmarkByPost(accountId, postUrl, database?)`, `listBookmarks(accountId, database?)`, and `removeBookmark(bookmarkId, database?)`.
- Produces: backup format 2 with legacy format 1 import support.

- [ ] **Step 1: Write failing repository, migration, and backup tests**

Cover these concrete outcomes:

```ts
const created = await captureBookmark(account.id, {
  authorHandle: 'theo', postUrl: 'https://twitter.com/Theo/status/123?ref=home',
  excerpt: 'Release   update', reminder: ' Possible podcast guest\nFollow up ',
}, database);
expect(created).toMatchObject({
  accountId: account.id, platform: 'x', postId: '123',
  postUrl: 'https://x.com/theo/status/123', excerpt: 'Release update',
  reminder: 'Possible podcast guest\nFollow up',
});
expect(await listBookmarks(account.id, database)).toEqual([created]);
expect(await findBookmarkByPost(account.id, created.postUrl, database)).toEqual(created);
```

Assert active duplicate capture returns the same ID and does not replace reminder; remove hides but does not physically delete; recapture restores the same ID, replaces excerpt/reminder, and refreshes `capturedAt`; another account cannot capture a mismatched author URL; malformed URLs and text beyond the exact limits reject; change-log entries use entity type `bookmark`; account mutation timestamps update; lists are account-scoped and `capturedAt` descending.

Extend the backup test to assert version 2 exports `bookmarks`, round-trips them, accepts a version 1 envelope without `bookmarks`, and rolls back a version 2 import containing an orphaned or malformed bookmark.

- [ ] **Step 2: Run repository tests and confirm RED**

Run: `npx vitest run tests/repositories.test.ts`

Expected: FAIL because the bookmark table, types, and functions do not exist and exports remain format 1.

- [ ] **Step 3: Implement schema version 3 and bookmark repository validation**

Add:

```ts
export interface Bookmark extends TimestampedRecord {
  accountId: RecordId;
  platform: 'x';
  postId: string;
  postUrl: string;
  excerpt?: string;
  reminder?: string;
  capturedAt: string;
}

export interface BookmarkCaptureInput {
  authorHandle: string;
  postUrl: string;
  excerpt?: string;
  reminder?: string;
}
```

Add `bookmarks!: EntityTable<Bookmark, 'id'>` and Dexie version 3 with `bookmarks: 'id, &[accountId+postUrl], accountId, postId, capturedAt, createdAt, updatedAt, deletedAt'`, repeating unchanged table declarations required by Dexie versioning.

Implement one validation helper that canonicalizes the URL, checks the existing X account and matching normalized handles, collapses excerpt whitespace, preserves reminder newlines while trimming/collapsing horizontal whitespace per line, counts Unicode code points, and rejects values over 280/500. Wrap create/restore/remove plus account/change-log updates in Dexie transactions. Active duplicate capture returns the existing record unchanged.

Advance `BackupEnvelope` to runtime format 2 with `bookmarks`, while typing import input to accept format 1 data without bookmarks. Export every table including bookmarks. On version 2 import, validate the complete bookmark array and account ownership before opening the write transaction; add the table to the import/reset transaction. On version 1, use `[]`.

- [ ] **Step 4: Run repository tests and confirm GREEN**

Run: `npx vitest run tests/repositories.test.ts`

Expected: repository, schema-upgrade, backup v1, and backup v2 tests pass.

- [ ] **Step 5: Commit persistence and backup support**

```bash
git add src/shared/types.ts src/data/db.ts src/data/repositories.ts tests/repositories.test.ts
git commit -m "feat: persist contact post bookmarks"
```

---

### Task 3: Typed Background Bookmark Messages

**Files:**
- Modify: `src/shared/messages.ts`
- Modify: `entrypoints/background.ts`
- Modify: `tests/background.test.ts`

**Interfaces:**
- Consumes: repository bookmark functions and bookmark types from Task 2.
- Produces requests `contexto:bookmark:lookup` and `contexto:bookmark:capture`.
- Produces responses `{ ok: true; bookmarkLookup: true; lookupBookmark: Bookmark | undefined }` and `{ ok: true; bookmark: Bookmark }`.

- [ ] **Step 1: Write failing message-routing tests**

Mock and assert:

```ts
repositories.findBookmarkByPost.mockResolvedValue(existing);
await expect(handleRequest({
  type: 'contexto:bookmark:lookup', accountId: 'account_1',
  postUrl: 'https://x.com/theo/status/123',
})).resolves.toEqual({ ok: true, bookmarkLookup: true, lookupBookmark: existing });

repositories.captureBookmark.mockResolvedValue(created);
await expect(handleRequest({
  type: 'contexto:bookmark:capture', accountId: 'account_1',
  authorHandle: 'theo', postUrl: 'https://x.com/theo/status/123',
  excerpt: 'Release update', reminder: 'Possible podcast guest',
})).resolves.toEqual({ ok: true, bookmark: created });
```

Keep the existing isolated account lookup and context-save assertions.

- [ ] **Step 2: Run background tests and confirm RED**

Run: `npx vitest run tests/background.test.ts`

Expected: FAIL because the request variants and switch cases do not exist.

- [ ] **Step 3: Add request/response variants and background cases**

Add the two request variants with `RecordId` and the top-level `authorHandle`, `postUrl`, `excerpt`, and `reminder` fields from `BookmarkCaptureInput`; import `Bookmark`; and add the two response variants. Route lookup to `findBookmarkByPost(message.accountId, message.postUrl)` and capture to `captureBookmark(message.accountId, { authorHandle: message.authorHandle, postUrl: message.postUrl, excerpt: message.excerpt, reminder: message.reminder })`. Let the existing top-level error boundary produce `{ ok: false, error }` for validation failures.

- [ ] **Step 4: Run background tests and confirm GREEN**

Run: `npx vitest run tests/background.test.ts`

Expected: all background tests pass.

- [ ] **Step 5: Commit the message boundary**

```bash
git add src/shared/messages.ts entrypoints/background.ts tests/background.test.ts
git commit -m "feat: route bookmark capture messages"
```

---

### Task 4: Propagate Post Snapshots Through X Feed Mounting

**Files:**
- Modify: `src/x/surface-observer.ts`
- Modify: `src/x/mount-contexto-surface.tsx`
- Modify: `tests/feed-surface-observer.test.ts`
- Modify: `tests/feed-mount.test.tsx`

**Interfaces:**
- Consumes: `extractFeedPostProfile` and `extractFeedPostSnapshot` from Task 1.
- Produces: a discriminated feed surface carrying `post?: XPostSnapshot` without changing hover/full-profile surfaces.
- Supplies: `post` to `ContextoFeedContext`.

- [ ] **Step 1: Write failing observer and mount propagation tests**

Update feed test markup with a valid `/theo/status/123` time link and top-level tweet text. Assert the observer mounts:

```ts
expect(mount).toHaveBeenCalledWith(expect.objectContaining({
  kind: 'feed-post',
  profile: expect.objectContaining({ handle: 'theo' }),
  post: expect.objectContaining({ postId: '123', excerpt: 'Post text' }),
}));
```

Change the mocked `ContextoFeedContext` to render `post?.postUrl` and assert the feed mount passes `https://x.com/theo/status/123`. Add a case where valid identity but missing status URL still mounts relationship context with `post: undefined`.

- [ ] **Step 2: Run propagation tests and confirm RED**

Run: `npx vitest run tests/feed-surface-observer.test.ts tests/feed-mount.test.tsx`

Expected: FAIL because observed feed surfaces do not carry post data.

- [ ] **Step 3: Implement the discriminated surface and propagation**

Define:

```ts
type NonFeedKind = Exclude<XSurfaceKind, 'feed-post'>;
export type ObservedXSurface =
  | { kind: 'feed-post'; host: HTMLElement; profile: ProfileSnapshot; post?: XPostSnapshot }
  | { kind: NonFeedKind; host: HTMLElement; profile: ProfileSnapshot };
```

Let the observer extract the profile first, then pass `post: extractFeedPostSnapshot(host) ?? undefined` for eligible feed hosts. Include `post?.postUrl ?? 'no-post'` in the observer's mount identity so recycled content remounts when a connected X node changes posts by the same author. Pass `surface.post` into `ContextoFeedContext` from the mount.

- [ ] **Step 4: Run propagation tests and confirm GREEN**

Run: `npx vitest run tests/feed-surface-observer.test.ts tests/feed-mount.test.tsx`

Expected: both selected test files pass.

- [ ] **Step 5: Commit feed snapshot propagation**

```bash
git add src/x/surface-observer.ts src/x/mount-contexto-surface.tsx tests/feed-surface-observer.test.ts tests/feed-mount.test.tsx
git commit -m "feat: propagate X post context to feed UI"
```

---

### Task 5: Inline Feed Bookmark Composer

**Files:**
- Modify: `src/ui/ContextoFeedContext.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `tests/contexto-feed-context.test.tsx`

**Interfaces:**
- Consumes: optional `post?: XPostSnapshot` and the Task 3 background messages.
- Produces: saved/duplicate state and the inline reminder composer inside the existing relationship panel.

- [ ] **Step 1: Write failing component lifecycle tests**

Update `renderFeed` to answer account lookup and bookmark lookup independently. Assert:

- A saved account plus valid post plus successful missing-bookmark lookup shows **Capture this post**.
- Clicking it focuses **Why are you saving this? (optional)**.
- Cancel clears and collapses; closing the relationship panel also discards a draft.
- Empty reminder sends the canonical post input.
- While a deferred capture promise is pending, textarea/save/cancel are disabled and Save reads **Saving…**.
- Success announces **Bookmark saved**, collapses, and shows disabled **Bookmarked**.
- A pre-existing lookup result starts at **Bookmarked**.
- A rejected/error response preserves reminder text and offers retry.
- Missing post snapshot or failed bookmark lookup preserves relationship context but shows no capture action.
- Existing **Open full context**, outside pointer, and Escape assertions still pass.

- [ ] **Step 2: Run the component test and confirm RED**

Run: `npx vitest run tests/contexto-feed-context.test.tsx`

Expected: FAIL because there is no `post` prop, bookmark lookup, or composer.

- [ ] **Step 3: Implement lookup and composer state**

Add `post?: XPostSnapshot` to props and local states for bookmark lookup (`unavailable | loading | available | saved`), composer open, reminder, saving, error, and success. After a saved-account lookup succeeds, perform `contexto:bookmark:lookup`; guard both effects against unmount/profile/post changes. Do not expose capture until lookup succeeds.

On save, send:

```ts
{
  type: 'contexto:bookmark:capture',
  accountId: account.id,
  authorHandle: post.authorHandle,
  postUrl: post.postUrl,
  excerpt: post.excerpt,
  reminder,
}
```

Clear composer draft whenever the relationship panel transitions closed. Use `aria-live="polite"` for success, `role="alert"` for errors, explicit labels, and a disabled **Bookmarked** button. Add compact textarea/action/error/success styles inside the existing Shadow DOM stylesheet.

- [ ] **Step 4: Run component and feed regression tests**

Run: `npx vitest run tests/contexto-feed-context.test.tsx tests/feed-mount.test.tsx tests/page-editor-controller-real.test.tsx`

Expected: all selected files pass.

- [ ] **Step 5: Commit the feed composer**

```bash
git add src/ui/ContextoFeedContext.tsx src/ui/contexto-profile-surface.css tests/contexto-feed-context.test.tsx
git commit -m "feat: capture post bookmarks from X feed"
```

---

### Task 6: Dashboard Bookmark Collection

**Files:**
- Create: `src/ui/AccountBookmarks.tsx`
- Modify: `src/ui/Dashboard.tsx`
- Modify: `entrypoints/options/style.css`
- Create: `tests/account-bookmarks.test.tsx`

**Interfaces:**
- Consumes: `Bookmark`, `listBookmarks`, and `removeBookmark` from Task 2.
- Produces: `AccountBookmarks({ accountId, load?, remove? })`, a focused review/removal component with default repository dependencies.

- [ ] **Step 1: Write failing collection tests**

Render with injected async `load` and `remove` functions. Assert newest-first results render reminder, excerpt, formatted capture date, and safe canonical links with `target="_blank" rel="noreferrer"`; sparse items remain useful; empty state mentions capture from X; successful remove reloads or removes the card; rejected remove keeps the item and shows an alert; switching `accountId` discards stale results from a slower previous request.

Use bookmark fixtures like:

```ts
const bookmark: Bookmark = {
  id: 'bookmark_1', accountId: 'account_1', platform: 'x', postId: '123',
  postUrl: 'https://x.com/theo/status/123', excerpt: 'Release update',
  reminder: 'Possible podcast guest', capturedAt: '2026-07-12T12:00:00.000Z',
  createdAt: '2026-07-12T12:00:00.000Z', updatedAt: '2026-07-12T12:00:00.000Z',
};
```

- [ ] **Step 2: Run the collection test and confirm RED**

Run: `npx vitest run tests/account-bookmarks.test.tsx`

Expected: FAIL because `AccountBookmarks` does not exist.

- [ ] **Step 3: Implement the focused dashboard component and integrate it**

Build a component with loading, loaded, and error states; a cancellation flag on `accountId` changes; and an explicit reload after successful remove. Render reminder as the card heading when present, excerpt as body copy, `new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(capturedAt))`, safe **Open on X**, and **Remove**. Keep an item visible until removal succeeds.

Import and render `<AccountBookmarks accountId={account.id} />` as its own panel after Notes in `AccountDetail`. Add `.bookmark-list`, `.bookmark-card`, `.bookmark-meta`, and responsive action styles consistent with existing panels.

- [ ] **Step 4: Run component and dashboard tests**

Run: `npx vitest run tests/account-bookmarks.test.tsx tests/dashboard-settings.test.tsx tests/account-navigation.test.ts`

Expected: all selected files pass.

- [ ] **Step 5: Commit dashboard bookmark review**

```bash
git add src/ui/AccountBookmarks.tsx src/ui/Dashboard.tsx entrypoints/options/style.css tests/account-bookmarks.test.tsx
git commit -m "feat: review contact bookmarks in dashboard"
```

---

### Task 7: Durable Documentation and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/architecture/data-model.md`
- Modify: `docs/architecture/platform-adapters.md`
- Modify: `docs/architecture/storage-and-sync.md`
- Modify: `docs/features/feed-saved-contact-context.md`
- Create: `docs/features/contact-post-bookmarks.md`
- Modify: `docs/development/browser-workflow.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Documents the final shipped behavior, schema version, backup format compatibility, extraction invariants, lifecycle, and manual QA.

- [ ] **Step 1: Update canonical documentation**

Document bookmarks in the MVP and architecture flow; schema version 3 and the `bookmarks` table; backup format 2 with format 1 import; exact primary-author status URL/top-level text rules; feed capture states; dashboard collection/removal; and the Chrome/Vivaldi manual matrix. Link the new feature document from `docs/README.md`.

- [ ] **Step 2: Run documentation and diff hygiene checks**

Run: `rg -n "bookmarks|Bookmark|formatVersion" README.md docs src/shared/types.ts src/data/db.ts`

Expected: current docs identify schema 3, backup format 2, legacy import behavior, and the new feature document.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Run the complete automated test suite**

Run: `npm test`

Expected: all Vitest test files and tests pass with zero failures.

- [ ] **Step 4: Run typecheck and production packaging checks**

Run: `npm run compile`

Expected: TypeScript exits 0 with no diagnostics.

Run: `npm run build`

Expected: WXT exits 0 and produces `.output/chrome-mv3`.

Run: `npm run verify:popup`

Expected: popup bundle verification passes.

- [ ] **Step 5: Record manual QA status accurately**

If real Chrome and Vivaldi sessions are unavailable, do not claim the manual matrix passed. Report it as an explicit follow-up covering standard/quoted/reply/promoted posts, duplicate capture, empty reminders, failed save, removal, virtualized scrolling, navigation/reload, narrow layout, and light/dark themes.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md docs/README.md docs/architecture/overview.md docs/architecture/data-model.md docs/architecture/platform-adapters.md docs/architecture/storage-and-sync.md docs/features/feed-saved-contact-context.md docs/features/contact-post-bookmarks.md docs/development/browser-workflow.md docs/testing.md
git commit -m "docs: document contact post bookmarks"
```

- [ ] **Step 7: Verify final commit range and worktree state**

Run: `git status --short && git log --oneline --decorate main..HEAD && git diff --check main...HEAD`

Expected: clean worktree, the planned feature commits listed, and no diff-check errors.
