# Role Field Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace account `profession` and `position` metadata with one optional `role` field across storage, search, editors, summaries, tests, and current documentation.

**Architecture:** Keep `role` on the existing `Account` record beside `companyId`, pass it through the existing `AccountUpdateInput` and draft flows, and render it as `Role · Company`. Add Dexie schema version 2 so current records retain unrelated data while the two obsolete properties are deleted without migration.

**Tech Stack:** TypeScript 5.9, React 19, Dexie 4, Vitest 4, Testing Library, WXT.

## Global Constraints

- The only user-facing occupational field is labeled **Role**.
- Do not infer or migrate a role from historic `profession` or `position` values.
- Preserve unrelated account and company data during the Dexie version upgrade.
- Leave historical files under `docs/superpowers/specs/` and `docs/superpowers/plans/` unchanged.
- Do not alter CSS declarations that use the layout property `position`.

---

### Task 1: Account role contract, persistence, schema, and search

**Files:**
- Modify: `tests/repositories.test.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/data/db.ts`
- Modify: `src/data/repositories.ts`

**Interfaces:**
- Consumes: existing `Account`, `AccountUpdateInput`, `updateAccount`, `saveAccountContext`, `listAccountSummaries`, and `exportBackup` interfaces.
- Produces: `Account.role?: string`, `AccountUpdateInput.role?: string`, a version-2 accounts schema indexed by `role`, and role-aware persistence/search/backup results.

- [ ] **Step 1: Write failing repository tests**

Replace old test metadata with `role`, assert that whitespace is trimmed, assert a role-specific query finds the saved account, and assert the exported account contains `role` but neither obsolete property:

```ts
const updated = await updateAccount(account.id, {
  role: '  Security engineer  ',
  companyName: 'Example Corp',
}, database);
expect(updated.role).toBe('Security engineer');
expect(await listAccountSummaries({ query: 'security engineer' }, database)).toHaveLength(1);

const exported = (await exportBackup(database)).data.accounts[0];
expect(exported).toMatchObject({ role: 'Security engineer' });
expect(exported).not.toHaveProperty('profession');
expect(exported).not.toHaveProperty('position');
```

Add a Dexie upgrade test that seeds a version-1 account containing `profession` and `position`, opens it through `ContextoDatabase`, and expects the unrelated account fields to remain while both legacy properties are absent.

- [ ] **Step 2: Run repository tests to verify RED**

Run: `npm test -- tests/repositories.test.ts`

Expected: FAIL because `role` is absent from the TypeScript data contract and repository behavior.

- [ ] **Step 3: Implement the minimal data-layer change**

Change the account contracts to:

```ts
export interface Account extends TimestampedRecord {
  // existing identity fields
  role?: string;
  companyId?: RecordId;
  // existing context fields
}

export interface AccountFilters {
  query?: string;
  tagId?: RecordId;
  folderId?: RecordId;
  companyId?: RecordId;
  location?: string;
}

export interface AccountUpdateInput {
  displayName?: string;
  role?: string;
  // existing update fields
}
```

Keep version 1 registered and add version 2 with the accounts index string:

```ts
'id, &[platform+normalizedHandle], platform, normalizedHandle, displayName, companyId, role, location, updatedAt, deletedAt'
```

Its upgrade callback must delete `profession` and `position` from every account object and must not populate `role`. Update `updateAccount` to trim `input.role`, update the search haystack to use `summary.role`, and remove the obsolete profession filter.

- [ ] **Step 4: Run repository tests to verify GREEN**

Run: `npm test -- tests/repositories.test.ts`

Expected: all repository tests PASS.

- [ ] **Step 5: Commit the data-layer change**

```bash
git add tests/repositories.test.ts src/shared/types.ts src/data/db.ts src/data/repositories.ts
git commit -m "refactor: consolidate account metadata into role"
```

### Task 2: Role editors, draft behavior, and hover summary

**Files:**
- Modify: `tests/draft-store.test.ts`
- Modify: `tests/contexto-profile-surface.test.tsx`
- Modify: `tests/contexto-hover-launcher.test.tsx`
- Modify: `tests/page-editor-controller-real.test.tsx`
- Modify: `src/ui/ContextoProfileSurface.tsx`
- Modify: `src/ui/ContextoHoverLauncher.tsx`
- Modify: `src/ui/Dashboard.tsx`

**Interfaces:**
- Consumes: `Account.role`, `AccountUpdateInput.role`, `AccountContextDraft`, and the existing profile-surface save request.
- Produces: one **Role** editor input in both editors, role-preserving draft/save/cancel behavior, and a `Role · Company` hover summary.

- [ ] **Step 1: Write failing UI and draft tests**

Update fixtures to use `role: 'CTO'` or `role: 'Developer'`. Require the editor to expose `Role`, reject both obsolete labels, and assert role values survive save, remount, and cancel:

```ts
expect(screen.getByLabelText('Role')).toBeVisible();
expect(screen.queryByLabelText('Profession')).not.toBeInTheDocument();
expect(screen.queryByLabelText('Position')).not.toBeInTheDocument();
```

Update the hover test to assert `Developer · Ping Labs` is rendered from `role` and company.

- [ ] **Step 2: Run focused UI tests to verify RED**

Run: `npm test -- tests/draft-store.test.ts tests/contexto-profile-surface.test.tsx tests/contexto-hover-launcher.test.tsx tests/page-editor-controller-real.test.tsx`

Expected: FAIL because the components still render and consume `profession` and `position`.

- [ ] **Step 3: Implement the minimal UI change**

Initialize drafts with `role: account?.role ?? ''`, render one controlled input:

```tsx
<label>Role<input value={draft.metadata.role ?? ''} disabled={saving}
  onChange={(event) => updateMetadata('role', event.target.value)} /></label>
```

Replace the two dashboard state properties and inputs with `role`. Render the hover organization line from `[account.role, account.company?.name]`.

- [ ] **Step 4: Run focused UI tests to verify GREEN**

Run: `npm test -- tests/draft-store.test.ts tests/contexto-profile-surface.test.tsx tests/contexto-hover-launcher.test.tsx tests/page-editor-controller-real.test.tsx`

Expected: all focused UI tests PASS.

- [ ] **Step 5: Commit the UI change**

```bash
git add tests/draft-store.test.ts tests/contexto-profile-surface.test.tsx tests/contexto-hover-launcher.test.tsx tests/page-editor-controller-real.test.tsx src/ui/ContextoProfileSurface.tsx src/ui/ContextoHoverLauncher.tsx src/ui/Dashboard.tsx
git commit -m "refactor: use one role field in account editors"
```

### Task 3: Current documentation and complete verification

**Files:**
- Modify: `docs/architecture/data-model.md`
- Modify: `docs/features/profile-metadata.md`
- Modify: `docs/features/account-search.md`
- Modify if required by compilation: current non-historical tests containing account metadata fixtures.

**Interfaces:**
- Consumes: the completed role data and UI behavior from Tasks 1 and 2.
- Produces: current documentation and a repository that contains no active metadata references to the obsolete fields.

- [ ] **Step 1: Update current documentation**

Describe `role` as the single occupational field, list it in search coverage, and remove current references to profession and position. Do not rewrite dated historical specs or plans.

- [ ] **Step 2: Scan active code and tests**

Run:

```bash
rg -n -S "profession|Profession" src tests docs/architecture docs/features
rg -n -S "\.position|Position" src tests docs/architecture docs/features -g '*.ts' -g '*.tsx' -g '*.md'
```

Expected: no occupational metadata references. Layout-related CSS and DOM `position` references outside this scoped scan are allowed.

- [ ] **Step 3: Run complete verification**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run compile`

Expected: TypeScript exits successfully with no errors.

Run: `npm run build`

Expected: the production extension build exits successfully.

- [ ] **Step 4: Commit documentation and final cleanup**

```bash
git add docs/architecture/data-model.md docs/features/profile-metadata.md docs/features/account-search.md
git commit -m "docs: document unified account role"
```

- [ ] **Step 5: Confirm branch scope**

Run: `git status --short`

Expected: no changes except any pre-existing untracked user files intentionally left outside the worktree.

Run: `git log --oneline main..HEAD`

Expected: only the role consolidation implementation commits.
