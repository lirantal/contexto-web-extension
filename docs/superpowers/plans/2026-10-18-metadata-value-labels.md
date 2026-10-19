# Metadata Value Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible, canonical labels to every saved metadata value currently displayed in Contexto's compact read-only UI surfaces.

**Architecture:** Keep label/value markup explicit in each existing surface because X Shadow DOM summaries, dashboard rows, and toolbar-popup suggestions have different layout constraints. Reuse canonical copy and small local CSS conventions without adding a cross-surface renderer or changing persistence, messages, X extraction, or editor behavior.

**Tech Stack:** React 19, TypeScript, WXT, Vitest, Testing Library, CSS.

## Global Constraints

- Canonical visible labels are exactly `Role`, `Company`, `How you know them`, `Tags`, `Folders`, and `Latest note`, followed by a colon in compact inline presentation.
- Names, X handles, saved/unsaved state, `Recent`, checkpoint text, status messages, and actions remain unchanged.
- Omit the complete label/value field when its metadata value is empty.
- Do not add metadata to a surface that does not currently display it.
- Keep visible labels in document text and before their values in DOM order; do not generate them with CSS or replace them with aria-only text.
- Do not change storage, messaging, editor behavior, X DOM extraction, selectors, mounting, or placement.
- Preserve the unrelated uncommitted sidebar-search work in the main checkout.

---

## File Structure

- `src/ui/ContextoFeedContext.tsx`: render individually labeled feed-panel metadata fields.
- `src/ui/ContextoHoverLauncher.tsx`: render labeled role, company, and tags in the X hover summary.
- `src/ui/contexto-profile-surface.css`: provide wrapping label/value styles for compact X surfaces.
- `tests/contexto-feed-context.test.tsx`: protect all six feed-panel labels and empty-field omission.
- `tests/contexto-hover-launcher.test.tsx`: protect hover labels and empty-field omission.
- `tests/contexto-surface-layout.test.ts`: protect compact label wrapping and visible styling contracts.
- `src/ui/Dashboard.tsx`: label company in account rows and latest note in the detail pane.
- `entrypoints/options/style.css`: preserve dashboard density and wrapping for labeled values.
- `tests/dashboard-settings.test.tsx`: protect dashboard company and latest-note labels.
- `src/ui/TargetHandleCombobox.tsx`: label saved company values in toolbar-popup suggestions.
- `entrypoints/popup/TargetHandleCombobox.css`: distinguish the popup label while preserving compact layout.
- `tests/target-handle-combobox.test.tsx`: protect popup suggestion company labels.
- `docs/features/feed-saved-contact-context.md`: document canonical feed summary labels.
- `docs/features/profile-metadata.md`: document the cross-surface read-only label convention.

### Task 1: Label compact X feed and hover metadata

**Files:**
- Modify: `tests/contexto-feed-context.test.tsx`
- Modify: `tests/contexto-hover-launcher.test.tsx`
- Modify: `tests/contexto-surface-layout.test.ts`
- Modify: `src/ui/ContextoFeedContext.tsx`
- Modify: `src/ui/ContextoHoverLauncher.tsx`
- Modify: `src/ui/contexto-profile-surface.css`

**Interfaces:**
- Consumes: the existing `AccountSummary` fields `role`, `company`, `relationshipSource`, `tags`, `folders`, and `latestNote`.
- Produces: visible `.contexto-metadata-label` and `.contexto-metadata-value` markup inside existing hover and feed surfaces; no exported API changes.

- [ ] **Step 1: Write failing feed and hover assertions**

Replace the unlabeled combined-value expectations in `tests/contexto-feed-context.test.tsx` with assertions scoped to the existing panel:

```tsx
const panel = screen.getByRole('dialog', { name: 'Contexto relationship context' });
expect(within(panel).getByText('Role:')).toBeVisible();
expect(within(panel).getByText('Developer')).toBeVisible();
expect(within(panel).getByText('Company:')).toBeVisible();
expect(within(panel).getByText('Ping Labs')).toBeVisible();
expect(within(panel).getByText('How you know them:')).toBeVisible();
expect(within(panel).getByText('Conference friend')).toBeVisible();
expect(within(panel).getByText('Tags:')).toBeVisible();
expect(within(panel).getByText('Folders:')).toBeVisible();
expect(within(panel).getByText('Latest note:')).toBeVisible();
expect(within(panel).getByText('Invite Theo to the security roundtable.')).toBeVisible();
expect(within(panel).queryByText('Developer · Ping Labs')).not.toBeInTheDocument();
```

Import `within` from Testing Library. Extend the empty-metadata test to assert that `Role:`, `Company:`, `How you know them:`, `Tags:`, `Folders:`, and `Latest note:` are all absent.

In `tests/contexto-hover-launcher.test.tsx`, replace the combined organization assertion with:

```tsx
expect(screen.getByText('Role:')).toBeVisible();
expect(screen.getByText('Developer')).toBeVisible();
expect(screen.getByText('Company:')).toBeVisible();
expect(screen.getByText('Ping Labs')).toBeVisible();
expect(screen.getByText('Tags:')).toBeVisible();
expect(screen.getByText('Founder')).toBeVisible();
expect(screen.getByText('Security')).toBeVisible();
expect(screen.queryByText('Developer · Ping Labs')).not.toBeInTheDocument();
```

Extend the empty-metadata test to assert all three labels are absent.

Add this contract to `tests/contexto-surface-layout.test.ts`:

```ts
it('keeps compact metadata labels visible and associated when values wrap', () => {
  const field = ruleBody('.contexto-metadata-field');
  expect(field).toContain('display:flex;');
  expect(field).toContain('flex-wrap:wrap;');

  const label = ruleBody('.contexto-metadata-label');
  expect(label).toContain('font-weight:650;');

  const value = ruleBody('.contexto-metadata-value');
  expect(value).toContain('overflow-wrap:anywhere;');
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run tests/contexto-feed-context.test.tsx tests/contexto-hover-launcher.test.tsx tests/contexto-surface-layout.test.ts
```

Expected: FAIL because canonical labels and the new CSS rules do not yet exist.

- [ ] **Step 3: Implement separate semantic fields in both X surfaces**

Remove the `organization` constant from `ContextoFeedContext`. Replace its unlabeled metadata block with explicit fields shaped as follows:

```tsx
{account.role && <div className="contexto-metadata-field" data-testid="contexto-feed-role">
  <span className="contexto-metadata-label">Role:</span>
  <span className="contexto-metadata-value">{account.role}</span>
</div>}
{account.company?.name && <div className="contexto-metadata-field" data-testid="contexto-feed-company">
  <span className="contexto-metadata-label">Company:</span>
  <span className="contexto-metadata-value">{account.company.name}</span>
</div>}
{account.relationshipSource && <div className="contexto-metadata-field" data-testid="contexto-feed-relationship">
  <span className="contexto-metadata-label">How you know them:</span>
  <span className="contexto-metadata-value">{account.relationshipSource}</span>
</div>}
{account.tags.length > 0 && <div className="contexto-metadata-field" data-testid="contexto-feed-tags">
  <span className="contexto-metadata-label">Tags:</span>
  <div className="contexto-feed-values contexto-metadata-value">
    {account.tags.map((tag) => <span className="chip" key={tag.id}>{tag.name}</span>)}
  </div>
</div>}
{account.folders.length > 0 && <div className="contexto-metadata-field" data-testid="contexto-feed-folders">
  <span className="contexto-metadata-label">Folders:</span>
  <div className="contexto-feed-values contexto-metadata-value">
    {account.folders.map((folder) => <span className="chip folder-chip" key={folder.id}>{folder.name}</span>)}
  </div>
</div>}
{account.latestNote && <p className="contexto-metadata-field" data-testid="contexto-feed-note">
  <span className="contexto-metadata-label">Latest note:</span>
  <span className="contexto-metadata-value">{account.latestNote.body}</span>
</p>}
```

Replace the hover combined organization line and unlabeled tags with the same field classes and canonical `Role:`, `Company:`, and `Tags:` text. Use field-specific `data-testid="contexto-hover-role"`, `data-testid="contexto-hover-company"`, and the existing `data-testid="contexto-hover-tags"`; update the omission assertions to use those identifiers.

Add these one-line rules to `src/ui/contexto-profile-surface.css` so the existing `ruleBody` parser can inspect them:

```css
.contexto-metadata-field { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px; min-width:0; margin:0; }
.contexto-metadata-label { color:var(--ctx-muted); font-weight:650; }
.contexto-metadata-value { min-width:0; color:var(--ctx-text); overflow-wrap:anywhere; }
.contexto-feed-values { display:flex; flex-wrap:wrap; gap:4px; }
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/contexto-feed-context.test.tsx tests/contexto-hover-launcher.test.tsx tests/contexto-surface-layout.test.ts
```

Expected: all focused tests PASS with no warnings.

- [ ] **Step 5: Commit the compact X surfaces**

```bash
git add tests/contexto-feed-context.test.tsx tests/contexto-hover-launcher.test.tsx tests/contexto-surface-layout.test.ts src/ui/ContextoFeedContext.tsx src/ui/ContextoHoverLauncher.tsx src/ui/contexto-profile-surface.css
git commit -m "feat: label compact X metadata"
```

### Task 2: Label dashboard read-only metadata

**Files:**
- Modify: `tests/dashboard-settings.test.tsx`
- Modify: `src/ui/Dashboard.tsx`
- Modify: `entrypoints/options/style.css`

**Interfaces:**
- Consumes: `AccountSummary.company` and `AccountSummary.latestNote` already rendered by the dashboard.
- Produces: visible `Company:` in account-row metadata and `Latest note:` in the Notes section; no exported API changes.

- [ ] **Step 1: Write a failing dashboard regression test**

Add one test account with company and latest-note records to `tests/dashboard-settings.test.tsx`, render `Dashboard`, and assert:

```tsx
const accountRow = await screen.findByRole('button', { name: /Founder/ });
expect(within(accountRow).getByText('Company:')).toBeVisible();
expect(within(accountRow).getByText('OpenAI')).toBeVisible();

const details = screen.getByRole('region', { name: 'Account details' });
expect(within(details).getByText('Latest note:')).toBeVisible();
expect(within(details).getByText('Follow up after the launch.')).toBeVisible();
```

Also assert the row still contains `@founder` so identity text is unchanged.

- [ ] **Step 2: Run the dashboard test and verify RED**

Run:

```bash
npx vitest run tests/dashboard-settings.test.tsx
```

Expected: FAIL because `Company:` and `Latest note:` are not rendered.

- [ ] **Step 3: Implement labeled dashboard metadata**

Change the account-row secondary content in `src/ui/Dashboard.tsx` to separate identity from company metadata:

```tsx
<span className="account-row-content">
  <strong>{account.displayName}</strong>
  <small className="account-row-metadata">
    <span>@{account.handle}</span>
    {account.company && <span className="account-row-company">
      <span className="metadata-label">Company:</span>
      <span>{account.company.name}</span>
    </span>}
  </small>
</span>
```

Change the latest note to:

```tsx
{account.latestNote && <p className="latest-note">
  <strong className="metadata-label">Latest note:</strong>
  <span>{account.latestNote.body}</span>
</p>}
```

Add dashboard-local layout rules:

```css
.account-row > .account-row-content { display: flex; min-width: 0; flex-direction: column; }
.account-row-metadata,
.account-row-company,
.latest-note { display: flex; gap: 4px; min-width: 0; }
.account-row-metadata,
.latest-note { flex-wrap: wrap; }
.account-row-metadata { overflow: visible; white-space: normal; }
.metadata-label { color: #667066; font-weight: 650; }
```

Retain the existing latest-note margin, padding, border, and background declarations.

- [ ] **Step 4: Run the dashboard test and verify GREEN**

Run:

```bash
npx vitest run tests/dashboard-settings.test.tsx
```

Expected: all dashboard tests PASS.

- [ ] **Step 5: Commit the dashboard change**

```bash
git add tests/dashboard-settings.test.tsx src/ui/Dashboard.tsx entrypoints/options/style.css
git commit -m "feat: label dashboard metadata values"
```

### Task 3: Label toolbar-popup suggestion metadata

**Files:**
- Modify: `tests/target-handle-combobox.test.tsx`
- Modify: `src/ui/TargetHandleCombobox.tsx`
- Modify: `entrypoints/popup/TargetHandleCombobox.css`

**Interfaces:**
- Consumes: `TargetHandleSuggestion.companyName`.
- Produces: visible `Company:` before a populated company suggestion; input and listbox behavior remain unchanged.

- [ ] **Step 1: Write the failing popup suggestion assertion**

Replace the broad company text assertion in `tests/target-handle-combobox.test.tsx` with:

```tsx
const option = screen.getByRole('option', { name: /Alice Example/ });
expect(option).toHaveTextContent('@alice_dev');
expect(within(option).getByText('Company:')).toBeVisible();
expect(within(option).getByText('Acme')).toBeVisible();
```

Import `within` from Testing Library. Keep the `Recent` and keyboard/mouse interaction assertions unchanged.

- [ ] **Step 2: Run the popup component test and verify RED**

Run:

```bash
npx vitest run tests/target-handle-combobox.test.tsx
```

Expected: FAIL because the suggestion has no `Company:` label.

- [ ] **Step 3: Implement the popup company label**

Replace the company `<small>` in `src/ui/TargetHandleCombobox.tsx` with:

```tsx
{suggestion.companyName && <small className="target-handle-company">
  <span className="target-handle-metadata-label">Company:</span>
  <span>{suggestion.companyName}</span>
</small>}
```

Add compact wrapping styles to `entrypoints/popup/TargetHandleCombobox.css`:

```css
.target-handle-company {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 3px;
}

.target-handle-metadata-label {
  color: #667066;
  font-weight: 650;
}
```

- [ ] **Step 4: Run the popup component and popup-layout tests**

Run:

```bash
npx vitest run tests/target-handle-combobox.test.tsx tests/popup-layout.test.ts tests/popup.test.tsx
```

Expected: all focused popup tests PASS.

- [ ] **Step 5: Commit the popup suggestion change**

```bash
git add tests/target-handle-combobox.test.tsx src/ui/TargetHandleCombobox.tsx entrypoints/popup/TargetHandleCombobox.css
git commit -m "feat: label popup suggestion metadata"
```

### Task 4: Synchronize canonical feature documentation

**Files:**
- Modify: `docs/features/feed-saved-contact-context.md`
- Modify: `docs/features/profile-metadata.md`

**Interfaces:**
- Consumes: the canonical label rule from `docs/superpowers/specs/2026-10-18-metadata-value-labels-design.md`.
- Produces: current feature documentation that describes the implemented visible-label behavior.

- [ ] **Step 1: Update the feed summary contract**

Under `## Summary contents` in `docs/features/feed-saved-contact-context.md`, replace the generic field list with:

```markdown
Every populated saved metadata value has a visible field label. The summary may show:

- `Role` and `Company` as separate fields.
- `How you know them` for the relationship source.
- `Tags` and `Folders` before their chip collections.
- `Latest note` before the saved note text.

The display name remains an unlabeled identity heading. Empty metadata fields and their labels are omitted.
```

- [ ] **Step 2: Document the cross-surface convention**

Append this section to `docs/features/profile-metadata.md`:

```markdown
## Read-only metadata labels

Compact read-only summaries use visible labels for every saved metadata value they display. The canonical labels are **Role**, **Company**, **How you know them**, **Tags**, **Folders**, and **Latest note**. Empty fields omit both label and value. Display names, X handles, saved state, timestamps, and action/status text retain their existing identity or status presentation.

This convention applies to the X feed panel, X hover summary, dashboard read-only account metadata, and toolbar-popup account suggestions. It does not cause a surface to display metadata that the surface previously omitted.
```

- [ ] **Step 3: Verify documentation consistency**

Run:

```bash
rg -n "Role|Company|How you know them|Tags|Folders|Latest note|read-only" docs/features/feed-saved-contact-context.md docs/features/profile-metadata.md
```

Expected: both documents describe the canonical labels, empty-field omission, and read-only scope without contradicting the design spec.

- [ ] **Step 4: Commit the documentation**

```bash
git add docs/features/feed-saved-contact-context.md docs/features/profile-metadata.md
git commit -m "docs: document metadata value labels"
```

### Task 5: Complete verification and integrate

**Files:**
- Verify only; do not modify unrelated files.

**Interfaces:**
- Consumes: all prior task commits.
- Produces: a verified feature branch ready to merge into `main`.

- [ ] **Step 1: Run all required automated checks**

Run:

```bash
npm run compile
npm test
npm run build
npm run verify:popup
```

Expected: TypeScript succeeds, all Vitest files pass, the Chrome MV3 production build succeeds, and popup bundle verification passes.

- [ ] **Step 2: Inspect branch scope and whitespace**

Run:

```bash
git diff --check main...HEAD
git status --short --branch
git log --oneline main..HEAD
```

Expected: no whitespace errors; the worktree is clean; commits are limited to the design, plan, X summaries, dashboard, popup suggestions, tests, and feature documentation.

- [ ] **Step 3: Perform the available manual QA**

Build output inspection must confirm that the options page and popup bundles include their updated styles. If an interactive Chrome/Vivaldi session is available, verify X feed and hover summaries in light/dark themes and narrow/wide layouts, the dashboard account list and note, and the popup suggestion list. If browser driving is unavailable, report that manual browser QA remains outstanding without weakening the automated result.

- [ ] **Step 4: Integrate through the branch-finishing workflow**

Invoke `superpowers:finishing-a-development-branch`. The user has already requested a local merge into `main`, so select that workflow after confirming the main checkout still has only its pre-existing sidebar-search edits. Merge `work/metadata-value-labels` without discarding or overwriting those edits, rerun the relevant verification on merged `main`, then remove the feature worktree and branch only when safe.
