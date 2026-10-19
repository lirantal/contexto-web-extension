# Embedded X Quick Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Contexto's complete Quick X search builder as an always-expanded section in the existing X right-sidebar surface while retaining the toolbar popup.

**Architecture:** Extract the popup's search state and form into a shared `QuickXSearch` component with injected account-loading and launch adapters. Keep popup and content-script wrappers thin; the content wrapper uses typed background messages and the existing Shadow DOM sidebar mount. Share extension-local settings, form state, and recent-target history across both surfaces.

**Tech Stack:** React 19, TypeScript, WXT MV3, WXT storage, Vitest, Testing Library, Shadow DOM CSS.

## Global Constraints

- Keep the toolbar popup and its complete search behavior.
- Keep the X sidebar Quick X search always expanded; do not add a collapse control or preference.
- Mount only inside the existing Contexto-owned Shadow DOM host immediately before X's validated native search form.
- Preserve X's native search field and the existing native-sidebar-widget visibility and cleanup policy.
- Open generated X searches in a new tab and record target history only after a successful launch.
- Keep free-form target entry usable when suggestions or history cannot load.
- Keep direct Dexie access out of the content script; load saved accounts through the typed background sender.
- Treat X DOM as transient and fail closed when the validated native search form is absent.
- Add or update minimal regression tests and canonical documentation for every changed behavior or operational assumption.

---

### Task 1: Extract the reusable Quick X search workflow

**Files:**
- Create: `src/ui/QuickXSearch.tsx`
- Create: `src/ui/quick-x-search.css`
- Create: `tests/quick-x-search.test.tsx`
- Modify: `entrypoints/popup/App.tsx`
- Modify: `entrypoints/popup/App.css`
- Delete: `entrypoints/popup/TargetHandleCombobox.css`
- Modify: `tests/popup.test.tsx`
- Modify: `tests/popup-autosuggest.test.tsx`
- Modify: `tests/popup-layout.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface QuickXSearchProps {
    loadAccountSuggestions: () => Promise<TargetAccountSuggestion[]>;
    launchSearch: (filters: XSearchFilters) => Promise<void>;
    surface: 'popup' | 'sidebar';
  }

  export function QuickXSearch(props: QuickXSearchProps): React.JSX.Element;
  ```
- `QuickXSearch` owns settings, persisted `PopupSearchState`, target history, suggestion construction, field updates, validation, query previews, launch ordering, and best-effort post-launch history recording.
- The popup supplies `listTargetAccountSuggestions` and a launcher that calls `browser.tabs.create({ url: buildXSearchUrl(filters) })`.

- [ ] **Step 1: Write failing shared-workflow tests**

Create `tests/quick-x-search.test.tsx` with mocked storage items and these behavioral tests:

```tsx
render(<QuickXSearch
  surface="sidebar"
  loadAccountSuggestions={loadAccountSuggestions}
  launchSearch={launchSearch}
/>);

expect(await screen.findByLabelText('My X handle')).toHaveValue('@me');
expect(screen.getByLabelText(/Other person/)).toHaveValue('@them');
expect(screen.getByLabelText('Keyword')).toHaveValue('security');
expect(screen.getByLabelText('Since')).toHaveValue('2026-01-01');
expect(screen.getByLabelText('Until')).toHaveValue('2026-02-01');
```

Also assert separately that:

```tsx
fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'typescript' } });
await waitFor(() => expect(setSearchState).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'typescript' })));

fireEvent.click(await screen.findByRole('button', { name: /Posts by other person/ }));
await waitFor(() => expect(launchSearch).toHaveBeenCalledWith(expect.objectContaining({
  direction: 'from-profile', targetHandle: 'them', keyword: 'security',
})));
await waitFor(() => expect(recordTarget).toHaveBeenCalledWith('them'));
expect(launchSearch.mock.invocationCallOrder[0]).toBeLessThan(recordTarget.mock.invocationCallOrder[0]);
```

Add a failed-launch case proving `recordTarget` is not called, a partial-load-failure case proving every field remains usable, a disabled-action case for missing required handles, and a storage-watch case proving an externally updated `popupSearchStateItem` refreshes an already-mounted sidebar form.

- [ ] **Step 2: Run the shared test and verify RED**

Run: `npm test -- tests/quick-x-search.test.tsx`

Expected: FAIL because `src/ui/QuickXSearch.tsx` does not exist.

- [ ] **Step 3: Implement the shared component and shared styles**

Create `src/ui/QuickXSearch.tsx` using the existing popup logic. Keep the four actions exactly:

```ts
const actions: Array<{ direction: SearchDirection; label: string }> = [
  { direction: 'me-to-them', label: 'Posts by me' },
  { direction: 'them-to-me', label: 'Posts to me' },
  { direction: 'from-profile', label: 'Posts by other person' },
  { direction: 'mentions', label: 'Mentions of other person' },
];
```

Render a root `<div className="contexto-quick-search" data-surface={surface}>`, the current search fields, and the current action section. Initialize each source independently with `Promise.allSettled`. Register and clean up `settingsItem.watch`, `popupSearchStateItem.watch`, and `targetHandleHistoryItem.watch`; apply watched values only while mounted. On launch:

```ts
await Promise.all([
  settingsItem.setValue(settings),
  popupSearchStateItem.setValue(searchState),
]);
await launchSearch(filters);
if (filters.targetHandle) {
  try {
    setTargetHistory(await recordTargetHandleSearch(filters.targetHandle));
  } catch {
    // Launch already succeeded; history remains best-effort.
  }
}
```

Move reusable form, action, and target-combobox rules from `entrypoints/popup/App.css` and `entrypoints/popup/TargetHandleCombobox.css` into `src/ui/quick-x-search.css`. Scope them to `.contexto-quick-search`, use `--ctx-*` color variables, and retain one-line ellipsis previews. Leave popup header/footer/fixed-shell rules in `App.css`; define the popup color variables on `.popup-shell`.

- [ ] **Step 4: Refactor the popup into a thin wrapper**

Replace popup-owned search state and form markup with:

```tsx
<QuickXSearch
  surface="popup"
  loadAccountSuggestions={listTargetAccountSuggestions}
  launchSearch={(filters) => browser.tabs.create({ url: buildXSearchUrl(filters) }).then(() => undefined)}
/>
```

Retain the existing Contexto header and Dashboard/X/Settings footer. Import `@/src/ui/quick-x-search.css` and remove the deleted combobox stylesheet import. Update popup test mocks to expose no-op `watch` functions returning cleanup callbacks, but preserve their existing behavior assertions.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- tests/quick-x-search.test.tsx tests/popup.test.tsx tests/popup-autosuggest.test.tsx tests/popup-layout.test.ts tests/target-handle-combobox.test.tsx`

Expected: all focused tests PASS with no React warnings.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/ui/QuickXSearch.tsx src/ui/quick-x-search.css entrypoints/popup/App.tsx entrypoints/popup/App.css tests/quick-x-search.test.tsx tests/popup.test.tsx tests/popup-autosuggest.test.tsx tests/popup-layout.test.ts entrypoints/popup/TargetHandleCombobox.css
git commit -m "refactor: share quick X search workflow"
```

---

### Task 2: Add the content-safe search launcher and sidebar workspace

**Files:**
- Create: `src/ui/ContextoSidebarWorkspace.tsx`
- Create: `tests/contexto-sidebar-workspace.test.tsx`
- Modify: `src/shared/messages.ts`
- Modify: `entrypoints/background.ts`
- Modify: `tests/background.test.ts`
- Modify: `src/x/mount-contexto-sidebar-search.tsx`
- Modify: `tests/content-mount.test.tsx`

**Interfaces:**
- Adds request:
  ```ts
  | { type: 'contexto:search:open'; filters: XSearchFilters }
  ```
- Produces:
  ```ts
  export function ContextoSidebarWorkspace({
    send,
  }: { send: (message: ContextoRequest) => Promise<ContextoResponse> }): React.JSX.Element;
  ```
- `ContextoSidebarWorkspace` renders `ContextoSidebarAccountSearch` and `QuickXSearch` as sibling sections in one existing Shadow DOM host.

- [ ] **Step 1: Write failing background launch tests**

Extend `tests/background.test.ts` with an injected `openTab` function:

```ts
const openTab = vi.fn().mockResolvedValue({ id: 7 });
await expect(handleRequest({
  type: 'contexto:search:open',
  filters: {
    viewerHandle: 'me', targetHandle: 'them', keyword: 'security',
    since: '', until: '', direction: 'from-profile',
  },
}, openTab)).resolves.toEqual({ ok: true });

expect(openTab).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/x\.com\/search\?/));
```

Add cases proving invalid filters return `{ ok: false, error: 'Invalid X search filters' }` without opening a tab and a rejected opener returns `{ ok: false, error: 'Tabs unavailable' }`.

- [ ] **Step 2: Run the background test and verify RED**

Run: `npm test -- tests/background.test.ts`

Expected: FAIL because `contexto:search:open` and the opener dependency do not exist.

- [ ] **Step 3: Implement the typed background launch boundary**

Add the request union member in `src/shared/messages.ts`. Change the handler signature compatibly:

```ts
type OpenTab = (url: string) => Promise<unknown>;

export async function handleRequest(
  message: ContextoRequest,
  openTab: OpenTab = (url) => browser.tabs.create({ url }),
): Promise<ContextoResponse> {
```

Handle the message with existing adapter functions:

```ts
case 'contexto:search:open': {
  if (!canRunXSearch(message.filters)) {
    return { ok: false, error: 'Invalid X search filters' };
  }
  await openTab(buildXSearchUrl(message.filters));
  return { ok: true };
}
```

Let the existing outer catch translate opener failures.

- [ ] **Step 4: Write failing sidebar-workspace tests**

Create `tests/contexto-sidebar-workspace.test.tsx`. Mock shared storage as in Task 1 and make `send` resolve `contexto:account:list` with an X account containing company metadata. Assert:

```tsx
expect(await screen.findByRole('region', { name: 'Contexto account search' })).toBeVisible();
expect(screen.getByRole('region', { name: 'Quick X search' })).toBeVisible();
expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();

await user.click(screen.getByRole('combobox', { name: "Other person's X handle" }));
expect(await screen.findByRole('option', { name: /Alice Example.*@alice_dev.*Acme/i })).toBeVisible();
```

Click `Posts by other person` and assert `send` receives `{ type: 'contexto:search:open', filters: expect.objectContaining({ direction: 'from-profile', targetHandle: 'alice_dev' }) }`. Add a failed account-list response case proving free-form target input remains enabled and can still launch.

- [ ] **Step 5: Run the sidebar test and verify RED**

Run: `npm test -- tests/contexto-sidebar-workspace.test.tsx`

Expected: FAIL because `ContextoSidebarWorkspace` does not exist.

- [ ] **Step 6: Implement and mount the composed sidebar workspace**

Create `ContextoSidebarWorkspace.tsx`. Its `loadAccountSuggestions` adapter calls `send({ type: 'contexto:account:list' })`, rejects unsuccessful responses, filters to X accounts, and maps:

```ts
{
  id: account.id,
  handle: account.handle,
  displayName: account.displayName,
  companyName: account.company?.name,
  updatedAt: account.updatedAt,
}
```

Its launch adapter calls `send({ type: 'contexto:search:open', filters })` and throws the response error when `ok` is false. Render:

```tsx
<div className="contexto-sidebar-workspace">
  <ContextoSidebarAccountSearch send={send} />
  <QuickXSearch surface="sidebar" loadAccountSuggestions={loadAccountSuggestions} launchSearch={launchSearch} />
</div>
```

Change `mountContextoSidebarSearch` to render `ContextoSidebarWorkspace`. Update the mount test mock and assertions so the single host contains both labels and cleanup still removes it.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `npm test -- tests/background.test.ts tests/contexto-sidebar-workspace.test.tsx tests/sidebar-account-search.test.tsx tests/content-mount.test.tsx tests/x-sidebar-search-observer.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/shared/messages.ts entrypoints/background.ts src/ui/ContextoSidebarWorkspace.tsx src/x/mount-contexto-sidebar-search.tsx tests/background.test.ts tests/contexto-sidebar-workspace.test.tsx tests/content-mount.test.tsx
git commit -m "feat: embed quick search in X sidebar"
```

---

### Task 3: Integrate responsive Shadow DOM styling and lifecycle coverage

**Files:**
- Modify: `entrypoints/content.ts`
- Modify: `src/ui/quick-x-search.css`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `tests/contexto-surface-layout.test.ts`
- Modify: `tests/x-sidebar-search-observer.test.ts`

**Interfaces:**
- Content startup supplies the sidebar host with both `contexto-profile-surface.css` and `quick-x-search.css` as inline Shadow DOM CSS.
- The existing observer and mount cleanup interfaces do not change.

- [ ] **Step 1: Write failing sidebar styling assertions**

Extend `tests/contexto-surface-layout.test.ts` to read both CSS files and assert the sidebar variant contains:

```ts
expect(sidebarQuickSearch).toContain('width:100%;');
expect(sidebarQuickSearch).not.toContain('width:400px;');
expect(sidebarQuickSearch).not.toContain('min-height:480px;');
expect(sidebarWorkspace).toContain('display:grid;');
```

Assert the sidebar quick-search section has a separating top border/padding, the date row permits wrapping or stacking, shared inputs use the host variables, and action previews retain `text-overflow:ellipsis` plus `white-space:nowrap`.

Extend the observer fixture assertion so the single mounted Contexto host remains immediately before the native form even when its mocked contents represent both account search and Quick X search.

- [ ] **Step 2: Run layout and observer tests and verify RED**

Run: `npm test -- tests/contexto-surface-layout.test.ts tests/x-sidebar-search-observer.test.ts`

Expected: FAIL because sidebar-workspace and sidebar-variant rules are absent.

- [ ] **Step 3: Add responsive sidebar styles and inline them**

In `contexto-profile-surface.css`, make `.contexto-sidebar-workspace` a full-width grid and keep the existing account-search card as the outer visual container. Remove any nested duplicate card background/border if necessary, and add a visually distinct separator before `.contexto-quick-search[data-surface="sidebar"]`.

In `quick-x-search.css`, use `width:100%`, `min-width:0`, host variables, and sidebar-specific compact spacing. Keep the popup fixed sizing only in `entrypoints/popup/App.css`. Allow `.contexto-quick-search[data-surface="sidebar"] .date-row` to wrap and give each label a usable minimum width.

Import the stylesheet inline in `entrypoints/content.ts`:

```ts
import quickSearchCss from '@/src/ui/quick-x-search.css?inline';
const sidebarCss = `${surfaceCss}\n${quickSearchCss}`;
```

Pass `sidebarCss` only to `mountContextoSidebarSearch`; keep profile and hover surfaces on `surfaceCss`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/contexto-surface-layout.test.ts tests/contexto-sidebar-workspace.test.tsx tests/content-mount.test.tsx tests/x-sidebar-search-observer.test.ts tests/popup-layout.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add entrypoints/content.ts src/ui/quick-x-search.css src/ui/contexto-profile-surface.css tests/contexto-surface-layout.test.ts tests/x-sidebar-search-observer.test.ts
git commit -m "style: fit quick search in X sidebar"
```

---

### Task 4: Synchronize documentation and verify the complete feature

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/architecture/platform-adapters.md`
- Modify: `docs/features/x-search-builder.md`
- Modify: `docs/development/browser-workflow.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Canonical documentation describes one persisted Quick X search workflow exposed by both the popup and the always-expanded X sidebar section.

- [ ] **Step 1: Update canonical documentation**

Document all of the following explicitly:

- The complete Quick X search builder is available in both the toolbar popup and X right sidebar.
- The X version is always expanded and shares persisted handles, keyword, dates, autosuggest history, validation, and new-tab launch behavior with the popup.
- The form lives in the existing Contexto-owned Shadow DOM host before the validated native X search form.
- Missing native-form evidence fails closed; X's native search and widget policy remain separate and usable.
- Manual QA covers both Chrome and Vivaldi, light and dark themes, saved-account suggestions, free-form targets, successful and failed launches, popup/sidebar state restoration, X rerenders, and extension reload.

- [ ] **Step 2: Run focused regression tests**

Run:

```bash
npm test -- tests/quick-x-search.test.tsx tests/popup.test.tsx tests/popup-autosuggest.test.tsx tests/background.test.ts tests/contexto-sidebar-workspace.test.tsx tests/sidebar-account-search.test.tsx tests/contexto-surface-layout.test.ts tests/content-mount.test.tsx tests/x-sidebar-search-observer.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 3: Run complete verification**

Run in order:

```bash
npm run compile
npm test
npm run build
npm run verify:popup
git diff --check
```

Expected: TypeScript emits no errors; all Vitest files pass; the Chrome MV3 production build succeeds; popup bundle verification succeeds; diff check prints nothing.

- [ ] **Step 4: Commit Task 4**

```bash
git add README.md docs/architecture/overview.md docs/architecture/platform-adapters.md docs/features/x-search-builder.md docs/development/browser-workflow.md docs/testing.md
git commit -m "docs: document embedded X quick search"
```

- [ ] **Step 5: Record manual QA handoff**

Report that automated verification is complete and that real-browser Chrome/Vivaldi checks remain for the documented manual matrix. Do not claim those manual checks were run unless a real signed-in X browser session was exercised.
