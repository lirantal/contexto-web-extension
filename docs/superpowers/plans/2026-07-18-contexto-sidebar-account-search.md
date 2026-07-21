# Contexto Sidebar Account Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Shadow-DOM Contexto account search immediately above X's native right-sidebar search that fuzzy-matches saved display names and handles and navigates the current tab to the selected profile.

**Architecture:** A pure shared matcher ranks saved X account summaries without a new dependency. A focused React component loads summaries through the existing content-runtime sender; a dedicated X sidebar observer mounts it before the native search form and safely remounts it when X replaces that form. The existing content script owns observer startup/teardown and the shared surface stylesheet owns the component's isolated appearance.

**Tech Stack:** WXT, React 19, TypeScript, Vitest, Testing Library, JSDOM, Shadow DOM, existing Contexto runtime messages.

## Global Constraints

- Query only saved `x` accounts, and match only `displayName`, `handle`, and `normalizedHandle`.
- Normalize case-insensitively, tolerate one leading `@`, and retain only letters, numbers, and underscores.
- Show at most five ranked matches; do not add a fuzzy-search package.
- Mount only from native X DOM evidence: `input[data-testid="SearchBox_Search_Input"]` inside a `form`; fail closed when the form is absent.
- Insert a Contexto-owned Shadow DOM host immediately before the native form; do not alter X-owned nodes, styles, or event handlers.
- Result selection uses `window.location.assign`, never `window.open`.
- Preserve the existing content-script invalidation contract and update manual QA/testing docs.

---

## File Structure

- Create: `src/shared/sidebar-account-search.ts` — pure normalization, eligibility, scoring, ranking, and limit functions.
- Create: `src/ui/ContextoSidebarAccountSearch.tsx` — local controlled input, account load/error/result states, and selection behavior.
- Create: `src/x/sidebar-search-observer.ts` — native-search discovery plus duplicate-safe lifecycle.
- Create: `src/x/mount-contexto-sidebar-search.tsx` — Shadow DOM root creation, pre-form placement, React render, and cleanup.
- Create: `tests/sidebar-account-search.test.tsx` — matcher and component tests.
- Create: `tests/x-sidebar-search-observer.test.ts` — discovery, placement, replacement/remount, and cleanup tests.
- Create: `tests/fixtures/x/sidebar-native-search.html` — minimal current native-search structure.
- Modify: `entrypoints/content.ts`, `src/ui/contexto-profile-surface.css`, `docs/features/account-search.md`, `docs/architecture/platform-adapters.md`, `docs/development/browser-workflow.md`, and `docs/testing.md`.

### Task 1: Create the deterministic saved-account matcher

**Files:**
- Create: `src/shared/sidebar-account-search.ts`
- Create: `tests/sidebar-account-search.test.tsx`

**Interfaces:**
- Consumes: `AccountSummary` from `src/shared/types.ts`.
- Produces: `normalizeSidebarAccountSearchText(value: string): string` and `searchSidebarAccounts(accounts: AccountSummary[], query: string, limit?: number): AccountSummary[]`.
- Used by: `ContextoSidebarAccountSearch` in Task 2.

- [ ] **Step 1: Write the failing matcher tests**

```ts
import { describe, expect, it } from 'vitest';
import { searchSidebarAccounts } from '@/src/shared/sidebar-account-search';
import type { AccountSummary } from '@/src/shared/types';

const account = (handle: string, displayName: string): AccountSummary => ({
  id: handle, platform: 'x', handle, normalizedHandle: handle.toLowerCase(),
  displayName, profileUrl: `https://x.com/${handle}`, syncState: 'local-only',
  createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z',
  tags: [], folders: [],
});

describe('searchSidebarAccounts', () => {
  const accounts = [
    account('liran_tal', 'Liran Tal'),
    account('lirandev', 'Liran Developer'),
    account('alex', 'Alicia Example'),
    { ...account('outside', 'Liran in company only'), platform: 'linkedin' as const },
  ];

  it('ranks exact and prefix handle matches before display-name matches', () => {
    expect(searchSidebarAccounts(accounts, '@liran').map(({ handle }) => handle))
      .toEqual(['lirandev', 'liran_tal']);
  });

  it('matches ordered characters and ignores non-X accounts', () => {
    expect(searchSidebarAccounts(accounts, 'aex').map(({ handle }) => handle)).toEqual(['alex']);
  });

  it('does not match metadata outside display names and handles', () => {
    const onlyCompany = { ...account('theo', 'Theo'), company: {
      name: 'Liran', id: 'company', normalizedName: 'liran', createdAt: '', updatedAt: '',
    } };
    expect(searchSidebarAccounts([onlyCompany], 'liran')).toEqual([]);
  });

  it('limits results to five by default', () => {
    expect(searchSidebarAccounts(Array.from({ length: 6 }, (_, index) =>
      account(`person${index}`, `Person ${index}`)), 'person')).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- tests/sidebar-account-search.test.tsx`

Expected: FAIL with module-resolution error for `@/src/shared/sidebar-account-search`.

- [ ] **Step 3: Implement the minimal matcher**

```ts
import type { AccountSummary } from './types';

export function normalizeSidebarAccountSearchText(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function scoreCandidate(candidate: string, query: string): number | null {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;
  let cursor = 0;
  let first = -1;
  for (const character of query) {
    const index = candidate.indexOf(character, cursor);
    if (index === -1) return null;
    if (first === -1) first = index;
    cursor = index + 1;
  }
  return 3_000 + cursor - first;
}

export function searchSidebarAccounts(accounts: AccountSummary[], query: string, limit = 5): AccountSummary[] {
  const normalizedQuery = normalizeSidebarAccountSearchText(query);
  if (!normalizedQuery) return [];
  return accounts.filter((account) => account.platform === 'x').map((account) => {
    const handle = normalizeSidebarAccountSearchText(account.normalizedHandle || account.handle);
    const name = normalizeSidebarAccountSearchText(account.displayName);
    const score = Math.min(
      scoreCandidate(handle, normalizedQuery) ?? Number.POSITIVE_INFINITY,
      scoreCandidate(name, normalizedQuery) ?? Number.POSITIVE_INFINITY,
    );
    return { account, score };
  }).filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score
      || left.account.displayName.localeCompare(right.account.displayName)
      || left.account.normalizedHandle.localeCompare(right.account.normalizedHandle))
    .slice(0, limit).map(({ account }) => account);
}
```

- [ ] **Step 4: Run the matcher test to verify GREEN**

Run: `npm test -- tests/sidebar-account-search.test.tsx`

Expected: PASS with four matcher assertions.

- [ ] **Step 5: Commit the matcher**

```sh
git add src/shared/sidebar-account-search.ts tests/sidebar-account-search.test.tsx
git commit -m "feat: rank saved accounts for sidebar search"
```

### Task 2: Render the isolated Contexto search component

**Files:**
- Modify: `tests/sidebar-account-search.test.tsx`
- Create: `src/ui/ContextoSidebarAccountSearch.tsx`
- Modify: `src/ui/contexto-profile-surface.css`

**Interfaces:**
- Consumes: `searchSidebarAccounts`, `AccountSummary`, and `ContextoRequest`/`ContextoResponse`.
- Produces: `ContextoSidebarAccountSearch({ send, navigate? })`.
- Used by: `mountContextoSidebarSearch` in Task 3.

- [ ] **Step 1: Add failing component tests**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ContextoSidebarAccountSearch } from '@/src/ui/ContextoSidebarAccountSearch';

it('shows a fuzzy saved-account match and navigates in the current tab', async () => {
  const navigate = vi.fn();
  render(<ContextoSidebarAccountSearch navigate={navigate}
    send={vi.fn().mockResolvedValue({ ok: true, accounts: [account('liran_tal', 'Liran Tal')] })} />);
  fireEvent.change(await screen.findByLabelText('Search Contexto accounts'), { target: { value: 'lir' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Liran Tal @liran_tal' }));
  expect(navigate).toHaveBeenCalledWith('https://x.com/liran_tal');
});

it('reports an unavailable local index without touching native X search', async () => {
  render(<ContextoSidebarAccountSearch send={vi.fn().mockRejectedValue(new Error('offline'))} />);
  expect(await screen.findByText('Contexto accounts are unavailable.')).toBeVisible();
  expect(screen.getByLabelText('Search Contexto accounts')).toBeDisabled();
});

it('shows no results only for an unmatched non-empty query', async () => {
  render(<ContextoSidebarAccountSearch
    send={vi.fn().mockResolvedValue({ ok: true, accounts: [account('theo', 'Theo')] })} />);
  fireEvent.change(await screen.findByLabelText('Search Contexto accounts'), { target: { value: 'missing' } });
  await waitFor(() => expect(screen.getByText('No saved accounts found.')).toBeVisible());
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- tests/sidebar-account-search.test.tsx`

Expected: FAIL with module-resolution error for `@/src/ui/ContextoSidebarAccountSearch`.

- [ ] **Step 3: Implement the component and scoped styles**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { searchSidebarAccounts } from '@/src/shared/sidebar-account-search';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { AccountSummary } from '@/src/shared/types';

type Send = (message: ContextoRequest) => Promise<ContextoResponse>;

export function ContextoSidebarAccountSearch({
  send, navigate = (url) => window.location.assign(url),
}: { send: Send; navigate?: (url: string) => void }) {
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void send({ type: 'contexto:account:list' }).then((response) => {
      if (!active) return;
      if (response.ok && 'accounts' in response) setAccounts(response.accounts);
      else setError(true);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [send]);

  const results = useMemo(() => accounts ? searchSidebarAccounts(accounts, query) : [], [accounts, query]);
  return <section className="contexto-sidebar-search" aria-label="Contexto account search">
    <label htmlFor="contexto-sidebar-account-query">Search Contexto accounts</label>
    <input id="contexto-sidebar-account-query" value={query} disabled={!accounts || error}
      onChange={(event) => setQuery(event.target.value)} placeholder="Name or @handle" />
    {error && <p role="status">Contexto accounts are unavailable.</p>}
    {!error && accounts && query && results.length === 0 && <p role="status">No saved accounts found.</p>}
    {results.length > 0 && <div className="contexto-sidebar-search-results">{results.map((account) =>
      <button key={account.id} type="button"
        onClick={() => navigate(account.profileUrl || `https://x.com/${account.normalizedHandle}`)}>
        {account.displayName} @{account.handle}
      </button>)}</div>}
  </section>;
}
```

Append these rules to `src/ui/contexto-profile-surface.css`:

```css
:host([data-contexto-surface="sidebar-search"]) { display:block; width:100%; margin:0 0 12px; }
.contexto-sidebar-search { display:grid; gap:7px; box-sizing:border-box; padding:10px 12px; border:1px solid var(--ctx-border); border-radius:16px; background:var(--ctx-bg); color:var(--ctx-text); }
.contexto-sidebar-search > p { margin:0; color:var(--ctx-muted); font-size:12px; }
.contexto-sidebar-search-results { display:grid; overflow:hidden; border:1px solid var(--ctx-border); border-radius:9px; }
.contexto-sidebar-search-results button { border:0; border-radius:0; padding:8px 10px; color:var(--ctx-text); text-align:left; }
.contexto-sidebar-search-results button:hover { background:color-mix(in srgb,var(--ctx-accent) 12%,var(--ctx-bg)); }
```

- [ ] **Step 4: Run the component and matcher tests to verify GREEN**

Run: `npm test -- tests/sidebar-account-search.test.tsx`

Expected: PASS with matcher, result, unavailable, and no-result assertions.

- [ ] **Step 5: Commit the component**

```sh
git add src/ui/ContextoSidebarAccountSearch.tsx src/ui/contexto-profile-surface.css tests/sidebar-account-search.test.tsx
git commit -m "feat: add Contexto sidebar account search"
```

### Task 3: Mount above native X search and wire lifecycle

**Files:**
- Create: `tests/fixtures/x/sidebar-native-search.html`
- Create: `tests/x-sidebar-search-observer.test.ts`
- Create: `src/x/sidebar-search-observer.ts`
- Create: `src/x/mount-contexto-sidebar-search.tsx`
- Modify: `entrypoints/content.ts`

**Interfaces:**
- Consumes: `ContextoSidebarAccountSearch`, `detectXTheme`, existing `XSurfaceCleanup`, and content runtime sender.
- Produces: `createXSidebarSearchObserver({ root, mount })` and `mountContextoSidebarSearch({ nativeForm, send, css, theme })`.
- Used by: the X/Twitter content script only.

- [ ] **Step 1: Add the fixture and failing lifecycle tests**

Create `tests/fixtures/x/sidebar-native-search.html`:

```html
<aside aria-label="Timeline: Trending now">
  <form role="search" action="/search">
    <label>Search<input data-testid="SearchBox_Search_Input" type="text" /></label>
  </form>
</aside>
```

Write tests that read this fixture, start the observer, and prove:

```ts
expect(nativeForm.previousElementSibling).toMatch('[data-contexto-surface="sidebar-search"]');
expect(nativeInput.getAttribute('data-testid')).toBe('SearchBox_Search_Input');
expect(mount).toHaveBeenCalledTimes(1);
nativeForm.replaceWith(replacementForm);
await flushMutations();
expect(cleanup).toHaveBeenCalledTimes(1);
expect(mount).toHaveBeenCalledTimes(2);
observer.disconnect();
expect(secondCleanup).toHaveBeenCalledTimes(1);
```

Add a negative test with a native-test-id input outside a form and expect no mount.

- [ ] **Step 2: Run the lifecycle test to verify RED**

Run: `npm test -- tests/x-sidebar-search-observer.test.ts`

Expected: FAIL with module-resolution error for `@/src/x/sidebar-search-observer`.

- [ ] **Step 3: Implement observer, Shadow DOM mount, and content-script wiring**

Use this observer core:

```ts
import type { XSurfaceCleanup } from './surface-observer';

export function createXSidebarSearchObserver({
  root, mount,
}: { root: HTMLElement; mount: (nativeForm: HTMLFormElement) => XSurfaceCleanup }) {
  let cleanup: XSurfaceCleanup | undefined;
  let mountedForm: HTMLFormElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scan = () => {
    timer = undefined;
    const input = root.querySelector<HTMLInputElement>('input[data-testid="SearchBox_Search_Input"]');
    const form = input?.closest('form') ?? undefined;
    if (form === mountedForm && (cleanup?.isConnected?.() ?? Boolean(cleanup))) return;
    cleanup?.();
    cleanup = undefined;
    mountedForm = form;
    if (form) cleanup = mount(form);
  };
  const queue = () => { if (timer === undefined) timer = setTimeout(scan, 100); };
  const observer = new MutationObserver(queue);
  observer.observe(root, { childList: true, subtree: true });
  queue();
  return { disconnect() {
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
    cleanup?.();
    cleanup = undefined;
    mountedForm = undefined;
  } };
}
```

In `src/x/mount-contexto-sidebar-search.tsx`, create a `mountHost` with `data-contexto-surface="sidebar-search"` and `data-theme={theme}`; attach open Shadow DOM; append a style containing the passed CSS and an app element; insert the host immediately before `nativeForm`; render `<ContextoSidebarAccountSearch send={send} />`; and return cleanup that unmounts/removes it. `isConnected` must require both `mountHost.isConnected` and `nativeForm.isConnected`.

In `entrypoints/content.ts`, instantiate the sidebar observer after the existing surface observer:

```ts
const sidebarSearchObserver = createXSidebarSearchObserver({
  root: document.body,
  mount: (nativeForm) => mountContextoSidebarSearch({
    nativeForm, send, css: surfaceCss, theme: detectXTheme(nativeForm),
  }),
});
```

Disconnect it inside `ctx.onInvalidated` before clearing drafts.

- [ ] **Step 4: Run focused lifecycle checks to verify GREEN**

Run: `npm test -- tests/x-sidebar-search-observer.test.ts tests/content-mount.test.tsx tests/x-surface-observer.test.ts`

Expected: PASS; native input stays untouched, a replacement produces one cleanup and one remount, and existing X surfaces still pass.

- [ ] **Step 5: Commit X mount integration**

```sh
git add entrypoints/content.ts src/x/sidebar-search-observer.ts src/x/mount-contexto-sidebar-search.tsx tests/x-sidebar-search-observer.test.ts tests/fixtures/x/sidebar-native-search.html
git commit -m "feat: mount account search above X search"
```

### Task 4: Synchronize docs and verify the release build

**Files:**
- Modify: `docs/features/account-search.md`
- Modify: `docs/architecture/platform-adapters.md`
- Modify: `docs/development/browser-workflow.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: the completed behavior from Tasks 1–3.
- Produces: canonical user, DOM-boundary, fixture, and manual-QA documentation.

- [ ] **Step 1: Document exact supported behavior**

Add this to `docs/features/account-search.md`:

```md
On X, Contexto also provides a local saved-account search directly above X's native right-sidebar search. It fuzzy-matches only saved X display names and handles, shows up to five results, and opens a selected profile in the current tab. It never changes or searches X's native field.
```

Add this invariant to `docs/architecture/platform-adapters.md`:

```md
The sidebar account search mounts only when `input[data-testid="SearchBox_Search_Input"]` is contained by a native `form`; it inserts a Contexto-owned Shadow DOM host before that form and fails closed when the evidence is incomplete.
```

Add a Browser Workflow table row that checks appearance above X search, exact/prefix/fuzzy results, current-tab selection, independent no-result/error states, and exactly one mount after resize/navigation. Add Testing guidance requiring the minimal native-search fixture to assert pre-form placement, native-input preservation, and replacement/remount cleanup.

- [ ] **Step 2: Run complete automated verification**

Run: `npm run compile && npm test && npm run build && npm run verify:popup`

Expected: every command exits 0, Vitest reports zero failures, and production bundle verification succeeds.

- [ ] **Step 3: Run manual browser QA**

Run: `npm run dev`

Expected: In a signed-in X session, test exact/prefix/fuzzy/empty matches, choose a result and confirm same-tab navigation, confirm X native search still works, then navigate/resize and confirm exactly one Contexto field.

- [ ] **Step 4: Commit documentation after verification**

```sh
git add docs/features/account-search.md docs/architecture/platform-adapters.md docs/development/browser-workflow.md docs/testing.md
git commit -m "docs: document sidebar account search"
```

## Plan Self-Review

- Spec coverage: Tasks 1–3 cover saved-X-only fuzzy ranking, five-result limit, Shadow DOM isolation, native-form placement, current-tab navigation, error containment, and lifecycle. Task 4 covers fixture coverage, required docs, automated checks, and browser QA.
- Placeholder scan: every task has exact files, interfaces, test-first commands, implementation content, expected outcomes, and commit scope.
- Type consistency: `AccountSummary`, `ContextoRequest`/`ContextoResponse`, `XSurfaceCleanup`, `searchSidebarAccounts`, `ContextoSidebarAccountSearch`, `createXSidebarSearchObserver`, and `mountContextoSidebarSearch` use the same names throughout.

## Approved Implementation Updates

- The X-only matcher excludes the LinkedIn fixture account and breaks equal scores by display name, then normalized handle.
- The search component shows `Loading saved accounts…` while the saved-account request is pending and disables its query field until it completes.
