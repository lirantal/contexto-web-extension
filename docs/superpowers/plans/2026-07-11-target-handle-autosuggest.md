# Target Handle Autosuggest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rich free-text target-handle combobox backed by saved X account metadata and a clearable 20-handle recent-search history.

**Architecture:** Keep suggestion ranking and history updates as pure shared functions, query only the account fields needed from Dexie, and isolate ARIA/listbox behavior in a controlled React component. The popup composes those units and records history only after tab creation succeeds; the dashboard clears the separate WXT local-storage history item.

**Tech Stack:** React 19, TypeScript 5.9, Dexie 4, WXT storage, Lucide React, Vitest, React Testing Library.

## Global Constraints

- Match saved X accounts only by handle, display name, and company.
- Accept arbitrary typed or pasted target text without forced selection.
- Show recent searched handles first and then recently updated saved accounts when the input is empty.
- Keep the 20 most recently searched unique normalized handles; a repeat moves to the top.
- Record a nonempty target only after `browser.tabs.create()` succeeds.
- Show at most eight suggestion rows and overlay them without increasing the popup's normal height.
- Clearing history must not remove saved accounts or general Dexie search-history records.
- Add no dependencies and do not change backup formats.

---

### Task 1: Pure history and suggestion model

**Files:**
- Create: `src/shared/target-handle-suggestions.ts`
- Create: `tests/target-handle-suggestions.test.ts`

**Interfaces:**
- Produces: `TargetHandleHistoryEntry`, `TargetAccountSuggestion`, `TargetHandleSuggestion`, `promoteTargetHandleHistory(entries, handle, searchedAt)`, and `buildTargetHandleSuggestions(accounts, history, query, limit?)`.
- Consumes: `normalizeXHandle(value)` from `src/shared/platforms/x.ts`.

- [ ] **Step 1: Write failing pure-function tests**

Create tests that assert normalization, case-insensitive repeat promotion, a 20-entry cap, duplicate account/history merging, recent-first empty results, handle-before-name-before-company matching, exclusion of unrelated metadata, and an eight-row default limit. Use concrete account fixtures such as:

```ts
const accounts: TargetAccountSuggestion[] = [
  { id: 'account_1', handle: 'alice_dev', displayName: 'Alice Example', companyName: 'Acme', updatedAt: '2026-07-10T10:00:00Z' },
  { id: 'account_2', handle: 'bob_sec', displayName: 'Bob Builder', companyName: 'Secure Co', updatedAt: '2026-07-11T10:00:00Z' },
];

expect(promoteTargetHandleHistory([{ handle: 'Alice_Dev', searchedAt: '2026-07-01' }], '@alice_dev', '2026-07-11'))
  .toEqual([{ handle: 'alice_dev', searchedAt: '2026-07-11' }]);
expect(buildTargetHandleSuggestions(accounts, [], 'acme')[0]).toMatchObject({ handle: 'alice_dev', matchField: 'company' });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/target-handle-suggestions.test.ts`

Expected: FAIL because `src/shared/target-handle-suggestions.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

Implement these exact public shapes:

```ts
export interface TargetHandleHistoryEntry { handle: string; searchedAt: string }
export interface TargetAccountSuggestion {
  id: string; handle: string; displayName: string; companyName?: string; updatedAt: string;
}
export interface TargetHandleSuggestion {
  id?: string; handle: string; displayName?: string; companyName?: string; updatedAt?: string;
  source: 'account' | 'history'; recent: boolean; searchedAt?: string;
  matchField?: 'handle' | 'displayName' | 'company';
}
export const TARGET_HANDLE_HISTORY_LIMIT = 20;
export const TARGET_HANDLE_SUGGESTION_LIMIT = 8;
```

`promoteTargetHandleHistory` normalizes with `normalizeXHandle`, drops an empty handle, removes the previous normalized match, prepends the timestamped entry, and slices to 20. `buildTargetHandleSuggestions` merges by normalized handle, enriches overlaps with account data, scores query matches as handle `0`, display name `1`, and company `2`, sorts empty results by recent-history timestamp before account `updatedAt`, sorts query results by match score then recency, and slices to the requested limit.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/target-handle-suggestions.test.ts`

Expected: all pure-model tests PASS.

- [ ] **Step 5: Commit the model**

```bash
git add src/shared/target-handle-suggestions.ts tests/target-handle-suggestions.test.ts
git commit -m "feat: add target handle suggestion model"
```

---

### Task 2: History persistence and lightweight account query

**Files:**
- Modify: `src/shared/settings.ts`
- Modify: `src/data/repositories.ts`
- Modify: `tests/repositories.test.ts`
- Create: `tests/target-handle-history.test.ts`

**Interfaces:**
- Consumes: `TargetHandleHistoryEntry`, `TargetAccountSuggestion`, and `promoteTargetHandleHistory` from Task 1.
- Produces: `targetHandleHistoryItem`, `recordTargetHandleSearch(handle, searchedAt?)`, `clearTargetHandleHistory()`, and `listTargetAccountSuggestions(database?)`.

- [ ] **Step 1: Write failing persistence and repository tests**

In `tests/repositories.test.ts`, create X, LinkedIn, and soft-deleted accounts and assert `listTargetAccountSuggestions(database)` returns only active X records with company names, ordered by descending `updatedAt`. In `tests/target-handle-history.test.ts`, mock `targetHandleHistoryItem.getValue/setValue` and assert recording promotes/deduplicates while clearing writes `[]`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/repositories.test.ts tests/target-handle-history.test.ts`

Expected: FAIL because the new exports are missing.

- [ ] **Step 3: Add storage and repository implementations**

In `settings.ts`, define:

```ts
export const targetHandleHistoryItem = storage.defineItem<TargetHandleHistoryEntry[]>('local:contexto-target-handle-history', { fallback: [] });
export async function recordTargetHandleSearch(handle: string, searchedAt = new Date().toISOString()) {
  const current = await targetHandleHistoryItem.getValue();
  const next = promoteTargetHandleHistory(current, handle, searchedAt);
  await targetHandleHistoryItem.setValue(next);
  return next;
}
export async function clearTargetHandleHistory() { await targetHandleHistoryItem.setValue([]); }
```

In `repositories.ts`, read active `platform === 'x'` accounts, fetch only each live company when present, map to `TargetAccountSuggestion`, and sort newest `updatedAt` first. Do not call `getAccountSummary`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- tests/repositories.test.ts tests/target-handle-history.test.ts`

Expected: all persistence and repository tests PASS.

- [ ] **Step 5: Commit persistence/query support**

```bash
git add src/shared/settings.ts src/data/repositories.ts tests/repositories.test.ts tests/target-handle-history.test.ts
git commit -m "feat: persist recent target handles"
```

---

### Task 3: Accessible target-handle combobox

**Files:**
- Create: `src/ui/TargetHandleCombobox.tsx`
- Create: `tests/target-handle-combobox.test.tsx`

**Interfaces:**
- Consumes: `TargetHandleSuggestion[]` from Task 1.
- Produces: `TargetHandleCombobox({ value, suggestions, onChange })` controlled component.

- [ ] **Step 1: Write failing interaction tests**

Render the component with saved and history-only rows. Assert focus opens an ARIA listbox, typing calls `onChange` with unchanged arbitrary text, Arrow Down updates `aria-activedescendant`, Enter chooses `@handle`, mouse selection chooses `@handle`, Escape closes the list, and company/recent labels render.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm test -- tests/target-handle-combobox.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement controlled combobox behavior**

Use `useId`, `useRef`, and `useState`. Render an input with the existing accessible name plus:

```tsx
role="combobox"
aria-autocomplete="list"
aria-expanded={open && suggestions.length > 0}
aria-controls={listboxId}
aria-activedescendant={highlighted >= 0 ? `${listboxId}-option-${highlighted}` : undefined}
```

Open on focus/change, wrap Arrow navigation, select with Enter, close with Escape/blur, and use `onMouseDown={event => event.preventDefault()}` before mouse selection. Render options with `role="option"`, `aria-selected`, display name/handle/company, and a **Recent** marker.

- [ ] **Step 4: Run the component test and verify GREEN**

Run: `npm test -- tests/target-handle-combobox.test.tsx`

Expected: all combobox interaction tests PASS.

- [ ] **Step 5: Commit the component**

```bash
git add src/ui/TargetHandleCombobox.tsx tests/target-handle-combobox.test.tsx
git commit -m "feat: add target handle combobox"
```

---

### Task 4: Popup and dashboard integration

**Files:**
- Modify: `entrypoints/popup/App.tsx`
- Modify: `entrypoints/popup/App.css`
- Modify: `src/ui/Dashboard.tsx`
- Modify: `entrypoints/options/style.css`
- Modify: `tests/popup.test.tsx`
- Create: `tests/dashboard-settings.test.tsx`

**Interfaces:**
- Consumes: `listTargetAccountSuggestions`, `targetHandleHistoryItem`, `recordTargetHandleSearch`, `clearTargetHandleHistory`, `buildTargetHandleSuggestions`, and `TargetHandleCombobox`.
- Produces: end-to-end popup autosuggest/history behavior and dashboard clear control.

- [ ] **Step 1: Write failing popup/dashboard integration tests**

Mock the account query and history item in `popup.test.tsx`. Assert saved suggestions load, input text remains free-form, selecting a row persists `@handle`, successful `browser.tabs.create` records the normalized target, and rejected tab creation does not record it. In `dashboard-settings.test.tsx`, mock dashboard repositories and history clearing, click **Clear target handle history**, then assert the helper was called and **Target handle history cleared** appears.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npm test -- tests/popup.test.tsx tests/dashboard-settings.test.tsx`

Expected: FAIL because popup composition and dashboard clearing are absent.

- [ ] **Step 3: Integrate the popup**

Load saved suggestions and history independently with `Promise.allSettled` so either source can fail without disabling the input. Derive rows with `buildTargetHandleSuggestions(accounts, history, searchState.targetHandle)`. Replace only the target input with `TargetHandleCombobox`. After `await browser.tabs.create({ url })`, call `recordTargetHandleSearch(filters.targetHandle)` in a guarded `try/catch` and update in-memory history from its returned list; never record before tab creation.

Add `.target-handle-combobox`, `.target-handle-options`, `.target-handle-option`, highlighted, metadata, company, and recent-marker rules. Position the option list absolutely below the input with `z-index`, `max-height`, and `overflow-y: auto` so it overlays existing popup content.

- [ ] **Step 4: Integrate dashboard clearing**

Add an async handler that calls `clearTargetHandleHistory()`, sets `Target handle history cleared` on success, and sets `Could not clear target handle history` on failure. Add the button below the X-handle setting and style it as a full-width secondary settings action.

- [ ] **Step 5: Run integration tests and verify GREEN**

Run: `npm test -- tests/popup.test.tsx tests/dashboard-settings.test.tsx`

Expected: all popup/dashboard integration tests PASS.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm test
npm run compile
npm run build
git diff --check
git status --short
```

Expected: 0 test failures, TypeScript exits 0, Chrome build exits 0, no whitespace errors, and only planned files are changed.

- [ ] **Step 7: Commit integration**

```bash
git add entrypoints/popup/App.tsx entrypoints/popup/App.css src/ui/Dashboard.tsx entrypoints/options/style.css tests/popup.test.tsx tests/dashboard-settings.test.tsx
git commit -m "feat: add target handle autosuggest"
```
