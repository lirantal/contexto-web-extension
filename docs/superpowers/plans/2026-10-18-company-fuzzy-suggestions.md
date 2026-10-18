# Company Fuzzy Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Company the same fuzzy, accessible, free-text suggestion experience as Location in both metadata editors.

**Architecture:** Generalize the existing Location ranking helper and combobox into field-neutral shared units, migrate Location without behavior changes, then supply active company names to the same component in the X editor and dashboard. Existing company lookup, normalization, uniqueness, and persistence remain unchanged.

**Tech Stack:** TypeScript, React 19, Dexie, Vitest, Testing Library, WXT.

## Global Constraints

- Company remains free text; explicit suggestion selection is optional.
- Company suggestions come from active records already returned by `LookupData.companies`.
- Exact, prefix, substring, and ordered-character fuzzy ranking remains deterministic.
- Company and Location must use one shared component and ranking helper.
- Existing Save, failed Save, Cancel, draft retention, and editor-close behavior must not change.
- No database migration or message-contract change is needed.

---

### Task 1: Generalize Fuzzy Suggestion Ranking

**Files:**
- Rename: `src/shared/location-suggestions.ts` to `src/shared/fuzzy-text-suggestions.ts`
- Rename: `tests/location-suggestions.test.ts` to `tests/fuzzy-text-suggestions.test.ts`
- Modify: `src/ui/LocationCombobox.tsx`

**Interfaces:**
- Produces: `rankFuzzyTextSuggestions(suggestions: string[], query: string): string[]`
- Replaces: `rankLocationSuggestions(suggestions: string[], query: string): string[]`

- [ ] **Step 1: Rename the test and change it to import the generic API**

Update all test calls to `rankFuzzyTextSuggestions` while preserving empty-query, exact/prefix/substring/fuzzy, out-of-order, and alphabetical tie tests.

- [ ] **Step 2: Run the renamed test and verify RED**

Run: `npm test -- tests/fuzzy-text-suggestions.test.ts`

Expected: FAIL because `src/shared/fuzzy-text-suggestions.ts` does not exist.

- [ ] **Step 3: Rename and generalize the implementation**

Rename the module and public function. Rename internal Location-specific identifiers to field-neutral text/candidate names without changing scoring behavior. Update `LocationCombobox` to import and call the generic ranker.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/fuzzy-text-suggestions.test.ts && npm run compile`

Expected: the focused ranking tests and compilation pass.

- [ ] **Step 5: Commit**

```bash
git add -A src/shared/location-suggestions.ts src/shared/fuzzy-text-suggestions.ts src/ui/LocationCombobox.tsx tests/location-suggestions.test.ts tests/fuzzy-text-suggestions.test.ts
git commit -m "refactor: generalize fuzzy text ranking"
```

### Task 2: Generalize The Shared Free-Text Combobox

**Files:**
- Rename: `src/ui/LocationCombobox.tsx` to `src/ui/FuzzyTextCombobox.tsx`
- Rename: `tests/location-combobox.test.tsx` to `tests/fuzzy-text-combobox.test.tsx`
- Modify: `src/ui/ContextoProfileSurface.tsx`
- Modify: `src/ui/Dashboard.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `entrypoints/options/style.css`

**Interfaces:**
- Produces: `FuzzyTextCombobox({ label, value, suggestions, onChange, disabled })`
- `label: string`
- `value: string`
- `suggestions: string[]`
- `onChange(value: string): void`
- `disabled?: boolean`

- [ ] **Step 1: Rename the component test and add a configurable-label assertion**

Change the harness to render `FuzzyTextCombobox label="Location"`. Add a focused test rendering `label="Company"` and assert the Company-labeled combobox supports fuzzy results.

- [ ] **Step 2: Run the renamed component test and verify RED**

Run: `npm test -- tests/fuzzy-text-combobox.test.tsx`

Expected: FAIL because `FuzzyTextCombobox` and its generic label prop do not exist.

- [ ] **Step 3: Rename and generalize the component**

Rename the component, props, selection function, candidate variables, CSS wrapper class, and ranker import. Generate the input label from the `label` prop. Migrate both existing Location call sites to `<FuzzyTextCombobox label="Location" ... />`.

- [ ] **Step 4: Verify GREEN and Location regressions**

Run: `npm test -- tests/fuzzy-text-combobox.test.tsx tests/contexto-profile-surface.test.tsx tests/dashboard-settings.test.tsx tests/contexto-surface-layout.test.ts && npm run compile`

Expected: all focused tests and compilation pass with unchanged Location behavior.

- [ ] **Step 5: Commit**

```bash
git add -A src/ui/LocationCombobox.tsx src/ui/FuzzyTextCombobox.tsx src/ui/ContextoProfileSurface.tsx src/ui/Dashboard.tsx src/ui/contexto-profile-surface.css entrypoints/options/style.css tests/location-combobox.test.tsx tests/fuzzy-text-combobox.test.tsx
git commit -m "refactor: generalize fuzzy text combobox"
```

### Task 3: Add Company Suggestions To The X Editor

**Files:**
- Modify: `src/ui/ContextoProfileSurface.tsx`
- Modify: `tests/contexto-profile-surface.test.tsx`

**Interfaces:**
- Consumes: `lookups.companies.map(company => company.name)`
- Produces: the Company draft through the existing `updateMetadata('companyName', value)` path

- [ ] **Step 1: Write the failing X editor test**

Return a company lookup containing `{ id: 'company_1', name: 'OpenAI' }`, enter `opi`, select the fuzzy `OpenAI` option, save, and assert the save request contains:

```ts
metadata: expect.objectContaining({ companyName: 'OpenAI' })
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/contexto-profile-surface.test.tsx`

Expected: FAIL because the native Company datalist does not perform ordered-character fuzzy matching.

- [ ] **Step 3: Replace the native Company datalist**

Render `FuzzyTextCombobox` with `label="Company"`, the company-name suggestion array, `saving` as disabled, and the existing metadata updater. Remove the Company datalist.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/contexto-profile-surface.test.tsx tests/fuzzy-text-combobox.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ContextoProfileSurface.tsx tests/contexto-profile-surface.test.tsx
git commit -m "feat: suggest companies in X editor"
```

### Task 4: Add Company Suggestions To The Dashboard

**Files:**
- Modify: `src/ui/Dashboard.tsx`
- Modify: `tests/dashboard-settings.test.tsx`

**Interfaces:**
- Consumes: `lookups.companies.map(company => company.name)`
- Produces: the Company draft through the existing `setDraft({ ...draft, companyName })` path

- [ ] **Step 1: Write the failing dashboard test**

Expose `OpenAI` from the live lookup mock, enter `opi`, select the fuzzy option, save metadata, and assert:

```ts
expect(mocks.updateAccount).toHaveBeenCalledWith('account-1', expect.objectContaining({
  companyName: 'OpenAI',
}));
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/dashboard-settings.test.tsx`

Expected: FAIL because the dashboard Company field is still a plain input.

- [ ] **Step 3: Pass and render Company suggestions**

Pass `companySuggestions={lookups?.companies.map(company => company.name) ?? []}` to `AccountDetail`. Replace the Company input with `FuzzyTextCombobox label="Company"`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/dashboard-settings.test.tsx tests/fuzzy-text-combobox.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Dashboard.tsx tests/dashboard-settings.test.tsx
git commit -m "feat: suggest companies in dashboard"
```

### Task 5: Canonical Documentation, Full Verification, And Review

**Files:**
- Modify: `docs/features/profile-metadata.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: completed Company and Location shared behavior
- Produces: durable feature and regression requirements

- [ ] **Step 1: Update canonical documentation**

Document that Company and Location both remain free text while fuzzy-suggesting active saved values, and that both use one shared interaction contract. Expand testing requirements to cover Company selection in both editors and Location regression coverage after generalization.

- [ ] **Step 2: Run complete verification**

Run:

```bash
npm run compile
npm test
npm run build
npm run verify:popup
```

Expected: all commands exit successfully with zero failing tests.

- [ ] **Step 3: Review the feature-only diff**

Run: `git diff --check && git status --short && git diff --stat f05663c..HEAD`

Expected: only Company suggestion implementation, tests, design/plan, and canonical documentation are changed.

- [ ] **Step 4: Commit**

```bash
git add docs/features/profile-metadata.md docs/testing.md
git commit -m "docs: describe company suggestions"
```

- [ ] **Step 5: Request independent code review**

Review `f05663c..HEAD` against the design and this plan. Fix all Critical and Important findings, rerun the complete verification chain, and commit any review fixes before handoff.
