# Prior-interaction Shortcut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click saved-contact feed action that opens a live X search containing public posts sent in either direction between the configured viewer and the saved author.

**Architecture:** Keep handle validation and X query construction in the shared X adapter. Load settings independently from the existing saved-account and bookmark flows in `ContextoFeedContext`, then render a safe external link only when the adapter can produce a valid URL.

**Tech Stack:** TypeScript, React, WXT browser-extension messaging, Vitest, Testing Library, CSS in the content-script Shadow DOM.

## Global Constraints

- The shortcut copy is exactly **View our interactions**.
- The query is exactly `(from:viewer to:author) OR (from:author to:viewer)` after handle normalization.
- The X results URL uses `src=typed_query` and `f=live`.
- Missing, invalid, rejected, or unsuccessfully loaded viewer settings hide the shortcut without affecting saved context or bookmarks.
- The shortcut does not write search history or add persisted state.
- Do not infer the current X identity from X-owned DOM.
- External navigation uses `target="_blank"` and `rel="noopener noreferrer"`.

---

### Task 1: Two-way X interaction-search URL

**Files:**
- Modify: `src/shared/platforms/x.ts`
- Test: `tests/x-search.test.ts`

**Interfaces:**
- Consumes: existing `normalizeXHandle(handle: string): string` and `isValidXHandle(handle: string): boolean`.
- Produces: `buildXInteractionSearchUrl(viewerHandle: string, targetHandle: string): string | null`.

- [ ] **Step 1: Write the failing adapter tests**

Import `buildXInteractionSearchUrl` in `tests/x-search.test.ts` and add:

```ts
it('builds a normalized live search for interactions in both directions', () => {
  const url = buildXInteractionSearchUrl('@Liran_Tal', '@Example_Dev');

  expect(url).not.toBeNull();
  const parsed = new URL(url!);
  expect(parsed.origin + parsed.pathname).toBe('https://x.com/search');
  expect(parsed.searchParams.get('q')).toBe(
    '(from:liran_tal to:example_dev) OR (from:example_dev to:liran_tal)',
  );
  expect(parsed.searchParams.get('src')).toBe('typed_query');
  expect(parsed.searchParams.get('f')).toBe('live');
});

it('omits an interaction search when either handle is invalid', () => {
  expect(buildXInteractionSearchUrl('', 'example_dev')).toBeNull();
  expect(buildXInteractionSearchUrl('liran_tal', 'not-valid!')).toBeNull();
});
```

- [ ] **Step 2: Run the adapter tests and verify RED**

Run: `npm test -- tests/x-search.test.ts`

Expected: FAIL because `buildXInteractionSearchUrl` is not exported.

- [ ] **Step 3: Implement the minimal adapter helper**

Add to `src/shared/platforms/x.ts`:

```ts
export function buildXInteractionSearchUrl(viewerHandle: string, targetHandle: string): string | null {
  if (!isValidXHandle(viewerHandle) || !isValidXHandle(targetHandle)) return null;

  const viewer = normalizeXHandle(viewerHandle);
  const target = normalizeXHandle(targetHandle);
  const query = `(from:${viewer} to:${target}) OR (from:${target} to:${viewer})`;
  const params = new URLSearchParams({ q: query, src: 'typed_query', f: 'live' });
  return `https://x.com/search?${params.toString()}`;
}
```

- [ ] **Step 4: Run the adapter tests and verify GREEN**

Run: `npm test -- tests/x-search.test.ts`

Expected: all `tests/x-search.test.ts` tests PASS.

- [ ] **Step 5: Commit the adapter slice**

```bash
git add src/shared/platforms/x.ts tests/x-search.test.ts
git commit -m "feat: build two-way X interaction searches"
```

---

### Task 2: Saved-contact feed shortcut

**Files:**
- Modify: `src/ui/ContextoFeedContext.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Test: `tests/contexto-feed-context.test.tsx`

**Interfaces:**
- Consumes: `buildXInteractionSearchUrl(viewerHandle: string, targetHandle: string): string | null`, the existing `contexto:settings:get` request, and the existing saved-account/bookmark requests.
- Produces: a conditional external link named **View our interactions** in the saved-contact feed panel.

- [ ] **Step 1: Extend test senders and write the failing visibility/navigation test**

Update test senders so `contexto:settings:get` returns an explicit settings response. Add a focused renderer:

```ts
function renderWithSettings(settingsResponse: ContextoResponse | Error) {
  const send = vi.fn(async (message: ContextoRequest): Promise<ContextoResponse> => {
    if (message.type === 'contexto:account:lookup') {
      return { ok: true, lookup: true, lookupAccount: saved };
    }
    if (message.type === 'contexto:settings:get') {
      if (settingsResponse instanceof Error) throw settingsResponse;
      return settingsResponse;
    }
    if (message.type === 'contexto:bookmark:lookup') {
      return { ok: true, bookmarkLookup: true, lookupBookmark: undefined };
    }
    return { ok: false, error: 'Unexpected request' };
  });
  render(<ContextoFeedContext profile={profile} post={post} send={send} onEdit={vi.fn()} />);
  return send;
}
```

Add:

```ts
it('opens a safe two-way X interaction search when my handle is configured', async () => {
  renderWithSettings({
    ok: true,
    settings: { myXHandle: '@Liran_Tal', lastDashboardView: 'accounts' },
  });

  await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
  const link = await screen.findByRole('link', { name: 'View our interactions' });
  const url = new URL(link.getAttribute('href')!);

  expect(url.searchParams.get('q')).toBe('(from:liran_tal to:theo) OR (from:theo to:liran_tal)');
  expect(url.searchParams.get('f')).toBe('live');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

it.each([
  ['missing', { ok: true, settings: { myXHandle: '', lastDashboardView: 'accounts' } }],
  ['invalid', { ok: true, settings: { myXHandle: 'not-valid!', lastDashboardView: 'accounts' } }],
  ['unsuccessful', { ok: false, error: 'Settings unavailable' }],
] as const)('hides the shortcut for %s settings without hiding saved context', async (_name, response) => {
  cleanup();
  renderWithSettings(response as ContextoResponse);
  await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
  expect(screen.queryByRole('link', { name: 'View our interactions' })).not.toBeInTheDocument();
  expect(screen.getByText('Conference friend')).toBeVisible();
});

it('keeps saved context and bookmark capture available when settings reject', async () => {
  renderWithSettings(new Error('Settings unavailable'));
  await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

  expect(screen.queryByRole('link', { name: 'View our interactions' })).not.toBeInTheDocument();
  expect(screen.getByText('Conference friend')).toBeVisible();
  expect(await screen.findByRole('button', { name: 'Capture this post' })).toBeVisible();
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm test -- tests/contexto-feed-context.test.tsx`

Expected: FAIL on the configured-handle case because **View our interactions** is not rendered. The omission cases may already pass.

- [ ] **Step 3: Load settings independently and render the shortcut**

In `ContextoFeedContext`:

```ts
import { buildXInteractionSearchUrl } from '@/src/shared/platforms/x';

const [viewerHandle, setViewerHandle] = useState('');
```

At the start of the existing lookup effect, reset the viewer and issue the independent settings request with the same cancellation guard:

```ts
setViewerHandle('');
send({ type: 'contexto:settings:get' })
  .then((response) => {
    if (!cancelled && response.ok && 'settings' in response) {
      setViewerHandle(response.settings.myXHandle);
    }
  })
  .catch(() => undefined);
```

After the saved account guard, derive the URL:

```ts
const interactionUrl = buildXInteractionSearchUrl(viewerHandle, account.handle);
```

Render before **Open full context**:

```tsx
{interactionUrl && <a
  className="contexto-feed-interactions"
  href={interactionUrl}
  target="_blank"
  rel="noopener noreferrer"
>View our interactions</a>}
```

Add Shadow DOM styling that matches the compact panel and preserves visible keyboard focus:

```css
.contexto-feed-interactions { color:var(--ctx-link,#1d9bf0); font-weight:650; text-decoration:none; }
.contexto-feed-interactions:hover { text-decoration:underline; }
.contexto-feed-interactions:focus-visible { outline:2px solid var(--ctx-accent); outline-offset:2px; border-radius:4px; }
```

- [ ] **Step 4: Run the component test and verify GREEN**

Run: `npm test -- tests/contexto-feed-context.test.tsx`

Expected: all component tests PASS, including bookmark capture tests after their senders explicitly handle `contexto:settings:get`.

- [ ] **Step 5: Commit the feed shortcut slice**

```bash
git add src/ui/ContextoFeedContext.tsx src/ui/contexto-profile-surface.css tests/contexto-feed-context.test.tsx
git commit -m "feat: link saved contacts to prior X interactions"
```

---

### Task 3: Durable documentation and full verification

**Files:**
- Modify: `docs/features/feed-saved-contact-context.md`
- Modify: `docs/features/message-profile-search.md`
- Modify: `docs/development/browser-workflow.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: the completed adapter and feed-panel behavior.
- Produces: current feature documentation and an updated manual QA contract.

- [ ] **Step 1: Update canonical feature documentation**

Document that saved-contact panels show **View our interactions** only when `myXHandle` is configured and valid, and that it opens the combined two-way live query. State that missing/invalid settings hide the action and that the shortcut does not persist search history.

- [ ] **Step 2: Update testing and browser QA guidance**

Add a browser-workflow row covering configured versus missing viewer handles and confirming the link opens a live two-way query in a new tab. Add adapter/component coverage expectations to `docs/testing.md`.

- [ ] **Step 3: Run focused verification**

Run:

```bash
npm test -- tests/x-search.test.ts tests/contexto-feed-context.test.tsx
```

Expected: both test files PASS with zero failed tests.

- [ ] **Step 4: Run full release verification**

Run each command and require exit code 0:

```bash
npm run compile
npm test -- --maxWorkers=4 --reporter=dot
npm run build
npm run verify:popup
git diff --check
```

Expected: TypeScript compilation, the complete Vitest suite, the production MV3 build, popup verification, and whitespace checks all PASS.

- [ ] **Step 5: Review the implementation against the approved spec**

Confirm every requirement in `docs/superpowers/specs/2026-07-13-prior-interaction-shortcut-design.md` is represented in code, tests, or canonical docs. Confirm there is no database migration, search-history write, X DOM identity inference, disabled setup affordance, or unrelated refactor.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/features/feed-saved-contact-context.md docs/features/message-profile-search.md docs/development/browser-workflow.md docs/testing.md
git commit -m "docs: document prior-interaction shortcut"
```
