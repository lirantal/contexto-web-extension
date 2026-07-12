# Feed Saved-Contact Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quiet, read-only Contexto marker and compact relationship summary to saved authors on X feed posts, with a path into the existing full context editor.

**Architecture:** Extend the existing X surface observer with a `feed-post` surface kind and a fail-closed feed identity extractor. Feed mounts remain Shadow DOM isolated and are inserted in normal flow relative to the validated primary-author identity. A dedicated React feed-context component performs a local account lookup, renders only for saved accounts, and delegates full editing to the existing page editor controller.

**Tech Stack:** WXT, React 19, TypeScript, Vitest, Testing Library, jsdom, Shadow DOM, Dexie-backed background lookup.

## Global Constraints

- Treat X DOM as transient, untrusted, and versionless input.
- Scope identity extraction to one candidate post and an exact normalized profile path.
- Do not read or persist post body text, post URLs, unknown accounts, quoted authors, reply targets, mentions, or promoted content.
- Keep feed UI in a Contexto-owned Shadow DOM host and in normal document flow.
- Successful **Open full context** uses the existing page editor controller; the feed summary itself is read-only.
- Run focused tests after each red-green cycle and the complete `npm run compile`, `npm test`, `npm run build`, and `npm run verify:popup` checks before handoff.

---

### Task 1: Add fail-closed feed identity extraction and placement

**Files:**
- Create: `src/x/feed-post-extraction.ts`
- Create: `src/x/feed-post-placement.ts`
- Create: `tests/feed-post-extraction.test.ts`
- Modify: `src/x/extract-profile.ts:3` to include `feed-post` in `XSurfaceKind`

**Interfaces:**
- `extractFeedPostProfile(post: HTMLElement): ProfileSnapshot | null` returns the top-level post author only when a coherent `[data-testid="User-Name"]` or `[data-testid="UserName"]` identity subtree contains an exact `/<normalizedHandle>` anchor and matching `@handle`; it rejects nested tweet identities and promoted posts.
- `FeedPostInsertion` is `{ parent: HTMLElement; before: ChildNode | null }`.
- `resolveFeedPostInsertion(post: HTMLElement, handle: string): FeedPostInsertion | null` resolves an in-flow insertion point inside the validated primary-author identity subtree.

- [ ] **Step 1: Write failing extractor and placement tests**

Add tests covering a standard post, quoted post exclusion, reply-target exclusion, promoted-post rejection, inconsistent handle/link rejection, and placement next to the primary author. Use fixture-like minimal markup with a top-level `[data-testid="tweet"]`, a `[data-testid="User-Name"]` author block, and nested quoted/reply blocks where needed.

```ts
it('extracts only the top-level post author', () => {
  const post = document.createElement('article');
  post.setAttribute('data-testid', 'tweet');
  post.innerHTML = `<div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>
    <div data-testid="tweet"><div data-testid="User-Name"><a href="/quoted"><span>Quoted</span><span>@quoted</span></a></div></div>`;
  expect(extractFeedPostProfile(post)).toMatchObject({ handle: 'theo', profileUrl: 'https://x.com/theo' });
});

it('fails closed for promoted or inconsistent posts', () => {
  const post = document.createElement('article');
  post.setAttribute('data-testid', 'tweet');
  post.dataset.testid = 'placementTracking';
  expect(extractFeedPostProfile(post)).toBeNull();
});
```

- [ ] **Step 2: Run the focused tests and verify the expected red failure**

Run: `npm test -- tests/feed-post-extraction.test.ts`

Expected: FAIL because the new extractor and placement functions are not defined yet.

- [ ] **Step 3: Implement minimal extraction and placement helpers**

Implement scoped helpers that normalize a handle from the identity subtree, locate an anchor whose parsed pathname is exactly `/<handle>`, read the display name from that same subtree while skipping button/action text, reject any candidate under a nested `[data-testid="tweet"]`, reject promotion markers such as `[data-testid="placementTracking"]`, `[data-testid="promotedIndicator"]`, or an `aria-label` containing `Promoted`, and return `null` for missing/inconsistent evidence. `resolveFeedPostInsertion` must use the same exact-path anchor and return its identity parent, or `null` if the identity boundary cannot be resolved.

- [ ] **Step 4: Run focused tests and verify green**

Run: `npm test -- tests/feed-post-extraction.test.ts`

Expected: all new extractor and placement tests pass.

- [ ] **Step 5: Commit the extraction unit**

```bash
git add src/x/feed-post-extraction.ts src/x/feed-post-placement.ts src/x/extract-profile.ts tests/feed-post-extraction.test.ts
git commit -m "feat: extract saved authors from X feed posts"
```

### Task 2: Extend the X observer with feed-post lifecycle handling

**Files:**
- Modify: `src/x/surface-observer.ts`
- Modify: `tests/x-surface-observer.test.ts`

**Interfaces:**
- `ObservedXSurface.kind` accepts `'feed-post'`.
- `XSurfaceObserverOptions.mount` continues to accept `(surface: ObservedXSurface) => XSurfaceCleanup`.
- Feed candidates are discovered from `[data-testid="tweet"]` and pass through `extractFeedPostProfile` before `mount` is called.

- [ ] **Step 1: Write failing observer lifecycle tests**

Add tests asserting that a saved-candidate feed post is mounted once with `kind: 'feed-post'`, repeated mutations do not duplicate a connected mount, a recycled post host with a changed author cleans up the old mount and remounts, disconnected posts clean up, and ambiguous/quoted/promoted posts never mount. Update the debounce query-count assertion to allow the additional feed scan while still asserting that scanning is debounced.

```ts
it('mounts and remounts a feed post by primary-author identity', async () => {
  document.body.innerHTML = `<article data-testid="tweet"><div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div></article>`;
  const cleanup = vi.fn();
  const mount = vi.fn(() => cleanup);
  const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/home', mount });
  await flushMutations();
  expect(mount).toHaveBeenCalledWith(expect.objectContaining({ kind: 'feed-post', profile: expect.objectContaining({ handle: 'theo' }) }));
  document.querySelector('[data-testid="User-Name"]')!.innerHTML = '<a href="/other"><span>Other</span><span>@other</span></a>';
  await flushMutations();
  expect(cleanup).toHaveBeenCalledOnce();
  expect(mount).toHaveBeenCalledTimes(2);
  observer.disconnect();
});
```

- [ ] **Step 2: Run the focused observer tests and verify the expected red failure**

Run: `npm test -- tests/x-surface-observer.test.ts`

Expected: FAIL because feed posts are not yet scanned or mounted.

- [ ] **Step 3: Implement the feed scan with idempotent cleanup**

Add the feed scan to `createXSurfaceObserver` using a separate map keyed by host. Reuse the existing surface identity pattern (`kind`, normalized handle, profile URL), call the extractor only for each candidate post root, clean disconnected or stale mounts, and keep the existing hover-card/full-profile behavior unchanged. Do not persist or call account creation from the observer.

- [ ] **Step 4: Run focused observer tests and verify green**

Run: `npm test -- tests/x-surface-observer.test.ts`

Expected: all existing surface tests and new feed lifecycle tests pass.

- [ ] **Step 5: Commit the observer unit**

```bash
git add src/x/surface-observer.ts tests/x-surface-observer.test.ts
git commit -m "feat: observe X feed post authors"
```

### Task 3: Build the read-only feed context component

**Files:**
- Create: `src/ui/ContextoFeedContext.tsx`
- Create: `tests/contexto-feed-context.test.tsx`
- Modify: `src/ui/contexto-profile-surface.css`

**Interfaces:**
- `ContextoFeedContextProps` is `{ profile: ProfileSnapshot; send: ContextoProfileSurfaceProps['send']; onEdit(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void }`.
- The component performs `contexto:account:lookup`, renders `null` for loading, unsaved, rejected, or thrown lookups, and renders a button/panel only for a saved `AccountSummary`.

- [ ] **Step 1: Write failing component tests**

Test saved lookup rendering, omission of empty fields, read-only behavior, keyboard-accessible disclosure with `aria-expanded`, outside pointer/Escape close, inside interaction retention, and **Open full context** delegating the profile and marker button to `onEdit`. Also test that unsaved and failed lookups render no Contexto UI.

```tsx
it('shows saved context and opens the existing editor from the marker', async () => {
  const user = userEvent.setup();
  const onEdit = vi.fn();
  render(<ContextoFeedContext profile={profile} send={vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved })} onEdit={onEdit} />);
  const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
  expect(marker).toHaveAttribute('aria-expanded', 'false');
  await user.click(marker);
  expect(screen.getByText('Developer · Ping Labs')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Open full context' }));
  expect(onEdit).toHaveBeenCalledWith(profile, marker);
});
```

- [ ] **Step 2: Run the focused component tests and verify the expected red failure**

Run: `npm test -- tests/contexto-feed-context.test.tsx`

Expected: FAIL because the feed component and styles do not exist.

- [ ] **Step 3: Implement the minimal saved-only component and styles**

Use a cancelled lookup effect and render no host-visible content unless a saved account is returned. Render display name, role/company, relationship source, tags, folders, latest note, and one **Open full context** button. Attach document-level pointer and keydown listeners that close only for outside pointer paths or Escape. Keep the marker/panel read-only and retain focus target through the marker ref. Add compact feed-post Shadow DOM styles without changing existing hover/profile selectors.

- [ ] **Step 4: Run focused component tests and verify green**

Run: `npm test -- tests/contexto-feed-context.test.tsx`

Expected: all new component behavior tests pass.

- [ ] **Step 5: Commit the component unit**

```bash
git add src/ui/ContextoFeedContext.tsx src/ui/contexto-profile-surface.css tests/contexto-feed-context.test.tsx
git commit -m "feat: show saved context on X feed posts"
```

### Task 4: Mount feed context in content scripts and document the feature

**Files:**
- Modify: `src/x/mount-contexto-surface.tsx`
- Modify: `tests/content-mount.test.tsx`
- Modify: `entrypoints/content.ts`
- Modify: `docs/README.md`
- Create: `docs/features/feed-saved-contact-context.md`

**Interfaces:**
- `mountContextoSurface` routes `kind: 'feed-post'` through `resolveFeedPostInsertion` and renders `ContextoFeedContext` with the existing `send` and `openPageEditor` callbacks.
- Content scripts use one observer and one cleanup path for hover cards, full profiles, and feed posts.

- [ ] **Step 1: Write failing mount/integration tests**

Add a mount test that mocks `ContextoFeedContext`, asserts a `feed-post` host uses the feed insertion point and renders the feed component rather than the hover launcher or full editor, and verifies cleanup. Add an entrypoint-oriented observer test or update existing content mounting coverage to assert `mountContextoSurface` receives feed-post surfaces through `entrypoints/content.ts` wiring.

- [ ] **Step 2: Run focused mount tests and verify the expected red failure**

Run: `npm test -- tests/content-mount.test.tsx`

Expected: FAIL because the mount function does not yet recognize `feed-post`.

- [ ] **Step 3: Implement feed mounting and content wiring**

Import the feed component and feed placement helper, add the `feed-post` render branch, return a safe disconnected cleanup when placement cannot be resolved, and pass `mountContextoSurface` as the observer’s single mount callback. Ensure page navigation and invalidation continue to close the page editor and clear all observer mounts.

- [ ] **Step 4: Add current feature documentation**

Document eligibility, silent behavior for unknown/ambiguous/promoted authors, local-only lookup, panel controls, lifecycle, and current non-goals in `docs/features/feed-saved-contact-context.md`; link it from `docs/README.md`.

- [ ] **Step 5: Run focused integration tests and verify green**

Run: `npm test -- tests/content-mount.test.tsx tests/x-surface-observer.test.ts tests/contexto-feed-context.test.tsx`

Expected: all focused integration, observer, and component tests pass.

- [ ] **Step 6: Commit integration and documentation**

```bash
git add src/x/mount-contexto-surface.tsx tests/content-mount.test.tsx entrypoints/content.ts docs/README.md docs/features/feed-saved-contact-context.md
git commit -m "feat: integrate saved context into X feed posts"
```

### Task 5: Complete verification and branch handoff

**Files:**
- Modify only if verification exposes an implementation regression.

- [ ] **Step 1: Run the complete automated and build checks**

Run:

```bash
npm run compile
npm test
npm run build
npm run verify:popup
```

Expected: all commands exit successfully; the test suite reports no failures; WXT produces `.output/chrome-mv3`; popup bundle verification passes.

- [ ] **Step 2: Review the final diff and worktree state**

Run: `git diff main...HEAD --check && git status --short && git log --oneline --decorate -6`

Expected: no whitespace errors, only intentional feature/spec/plan/docs changes, and the branch contains the implementation commits.

- [ ] **Step 3: Run the finishing workflow**

Use `superpowers:finishing-a-development-branch` to present the available handoff options for this isolated branch. Do not merge or delete the worktree without the user’s choice.
