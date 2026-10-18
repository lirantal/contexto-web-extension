# Location Fuzzy Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suggest distinct previously saved locations with fuzzy matching in both the X metadata editor and dashboard while preserving free-text location entry.

**Architecture:** Extend the existing shared lookup payload with derived location strings, rank those strings in a pure shared helper, and render them through one controlled accessible combobox used by both editors. No database migration is needed because locations remain account fields and the dashboard's existing live query will refresh the derived suggestions.

**Tech Stack:** TypeScript, React 19, Dexie, Vitest, Testing Library, WXT.

## Global Constraints

- Location remains free text; suggestions never prevent saving a new value.
- Suggestions come only from non-deleted accounts with nonblank saved locations.
- Values are trimmed, deduplicated case-insensitively, and sorted alphabetically.
- Matching ranks exact, prefix, substring, then ordered-character fuzzy matches.
- The X profile editor and dashboard use the same component and interaction contract.
- Existing Save, failed Save, Cancel, and editor-close behavior must not change.

---

### Task 1: Saved Location Lookup Data

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/data/repositories.ts`
- Modify: `tests/repositories.test.ts`
- Modify: tests containing inline `LookupData` fixtures

**Interfaces:**
- Produces: `LookupData.locations: string[]`
- Consumes: active `Account.location` values from `database.accounts`

- [ ] **Step 1: Write the failing repository test**

Add a test that saves `" Berlin "`, `"berlin"`, `"San Francisco"`, a blank location, and a location on a soft-deleted account, then asserts:

```ts
expect((await getLookups(database)).locations).toEqual(['Berlin', 'San Francisco']);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/repositories.test.ts`

Expected: FAIL because `LookupData` and `getLookups` do not expose `locations`.

- [ ] **Step 3: Implement the lookup extension**

Add the field:

```ts
export interface LookupData {
  companies: Company[];
  tags: Tag[];
  folders: Folder[];
  locations: string[];
}
```

In `getLookups`, load accounts with the other tables and derive locations by filtering active accounts, trimming values, deduplicating with a lowercase key, and sorting with `localeCompare`.

- [ ] **Step 4: Update typed lookup fixtures**

Add `locations: []` to inline lookup responses and mocked `LookupData` values across tests so compile-time fixtures match the production contract.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- tests/repositories.test.ts && npm run compile`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/data/repositories.ts tests
git commit -m "feat: expose saved location lookups"
```

### Task 2: Fuzzy Location Ranking

**Files:**
- Create: `src/shared/location-suggestions.ts`
- Create: `tests/location-suggestions.test.ts`

**Interfaces:**
- Produces: `rankLocationSuggestions(suggestions: string[], query: string): string[]`
- Consumes: already deduplicated saved location strings and a raw input query

- [ ] **Step 1: Write failing ranking tests**

Cover empty queries, case-insensitive exact/prefix/substring order, ordered-character fuzzy matching such as `sfr` → `San Francisco`, rejection when characters are out of order, and deterministic alphabetical tie-breaking.

```ts
expect(rankLocationSuggestions(
  ['San Francisco', 'France', 'Frankfurt', 'Berlin'],
  'sfr',
)).toEqual(['San Francisco']);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/location-suggestions.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal scoring**

Normalize with `trim().toLocaleLowerCase()`. Score exact as `0`, prefix as `1`, substring as `2`, and ordered-character matches as `3 + gapCount / 1000`; omit nonmatches. Sort by score and then `localeCompare`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/location-suggestions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/location-suggestions.ts tests/location-suggestions.test.ts
git commit -m "feat: rank fuzzy location suggestions"
```

### Task 3: Shared Single-Value Location Combobox

**Files:**
- Create: `src/ui/LocationCombobox.tsx`
- Create: `tests/location-combobox.test.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `entrypoints/options/style.css`

**Interfaces:**
- Consumes: `{ value: string; suggestions: string[]; onChange(value: string): void; disabled?: boolean }`
- Produces: a controlled input labeled `Location` with accessible combobox/listbox behavior

- [ ] **Step 1: Write failing component tests**

Use a stateful harness to assert fuzzy results, Arrow Up/Down wrapping, Enter selection, pointer selection, Escape without clearing typed text, free-text updates when no option is selected, and list closure when disabled.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/location-combobox.test.tsx`

Expected: FAIL because `LocationCombobox` does not exist.

- [ ] **Step 3: Implement the controlled combobox**

Use `rankLocationSuggestions`, `useId`, local `open` and `highlighted` state, `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`. Selection calls `onChange(suggestion)` without transforming free text.

- [ ] **Step 4: Add cross-surface styles**

Reuse `.value-options` and `.value-option` in the Shadow DOM stylesheet. Add corresponding dashboard rules under a `.location-combobox` wrapper so the list is readable and keyboard highlighting is visible on the options page.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- tests/location-combobox.test.tsx tests/contexto-surface-layout.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/LocationCombobox.tsx src/ui/contexto-profile-surface.css entrypoints/options/style.css tests/location-combobox.test.tsx tests/contexto-surface-layout.test.ts
git commit -m "feat: add shared location combobox"
```

### Task 4: Integrate Both Metadata Editors

**Files:**
- Modify: `src/ui/ContextoProfileSurface.tsx`
- Modify: `src/ui/Dashboard.tsx`
- Modify: `tests/contexto-profile-surface.test.tsx`
- Modify: `tests/dashboard-settings.test.tsx`

**Interfaces:**
- Consumes: `lookups.locations` and `LocationCombobox`
- Produces: identical Location suggestion behavior in the X editor and dashboard

- [ ] **Step 1: Write failing surface tests**

In the X editor test, return `locations: ['San Francisco']`, type `sfr`, select the fuzzy option, save, and assert the save message contains `metadata.location: 'San Francisco'`.

In the dashboard test, make the live lookup mock return `locations: ['San Francisco']`, type `sfr`, select the option, save metadata, and assert `updateAccount` receives `location: 'San Francisco'`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/contexto-profile-surface.test.tsx tests/dashboard-settings.test.tsx`

Expected: FAIL because both surfaces still render plain inputs.

- [ ] **Step 3: Replace both Location inputs**

Import `LocationCombobox` in both components. Pass the existing draft location, `lookups.locations`, the existing draft setter, and `saving` as `disabled` in the X surface. Pass `lookups?.locations ?? []` in the dashboard.

- [ ] **Step 4: Verify GREEN and regressions**

Run: `npm test -- tests/contexto-profile-surface.test.tsx tests/dashboard-settings.test.tsx tests/location-combobox.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ContextoProfileSurface.tsx src/ui/Dashboard.tsx tests/contexto-profile-surface.test.tsx tests/dashboard-settings.test.tsx
git commit -m "feat: suggest locations in metadata editors"
```

### Task 5: Canonical Documentation And Full Verification

**Files:**
- Modify: `docs/features/profile-metadata.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: completed feature behavior
- Produces: durable behavior and verification requirements

- [ ] **Step 1: Update canonical documentation**

Document that Location is free text with fuzzy suggestions derived from distinct saved account locations in both metadata editors. Add repository, ranking, component, and cross-surface regression expectations to testing documentation.

- [ ] **Step 2: Run complete verification**

Run:

```bash
npm run compile
npm test
npm run build
npm run verify:popup
```

Expected: all commands exit successfully without warnings introduced by this change.

- [ ] **Step 3: Review the diff**

Run: `git diff --check && git status --short && git diff --stat HEAD~4..HEAD`

Expected: no whitespace errors and only Location suggestion code, tests, and documentation are changed.

- [ ] **Step 4: Commit**

```bash
git add docs/features/profile-metadata.md docs/testing.md
git commit -m "docs: describe location suggestions"
```
