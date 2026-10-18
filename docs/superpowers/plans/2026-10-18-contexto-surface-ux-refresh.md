# Contexto Surface UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Contexto's toolbar popup and embedded X surfaces easier to scan by grouping related information and actions, strengthening link affordances, and adding consistent spacing and labels without changing behavior.

**Architecture:** Keep each existing React surface responsible for its own semantic grouping, with embedded visual primitives centralized in `contexto-profile-surface.css` and toolbar-popup styling kept in its extension-page stylesheets. This is a presentation and information-architecture change only: existing message APIs, persistence, X extraction, placement, and lifecycle contracts remain unchanged.

**Tech Stack:** React 19, TypeScript 5.9, WXT 0.20, CSS, Vitest 4, Testing Library, jsdom.

## Global Constraints

- The approved direction is the **Grouped workflow**.
- In **Explore on X**, **Catch up on X** and **View our interactions** are consecutive blue link-actions; checkpoint content never separates them.
- The checkpoint line and **Mark caught up** sit directly below the outbound link group.
- Semantic anchors perform navigation; buttons perform writes, disclosure, and editor actions.
- Preserve all documented save, cancel, failure, dismissal, and owned-editor close behavior.
- Preserve X DOM extraction and mounting guardrails; add no selector fallback without a minimal fixture and regression test.
- Add no runtime dependency, message type, repository interface, database field, or browser permission.
- Keep the toolbar popup at 400 pixels wide and retain scrolling as a fallback below Chrome's 600-pixel height ceiling.
- Keep supporting text at least 12 pixels on content surfaces and interactive targets at least 36 pixels high.

---

## File Map

- `src/ui/ContextoFeedContext.tsx`: semantic feed-panel groups and conditional action order.
- `src/ui/ContextoProfileSurface.tsx`: labeled editor groups and paired field rows.
- `src/ui/ContextoHoverLauncher.tsx`: compact header/summary semantics.
- `src/ui/ContextoSidebarAccountSearch.tsx`: structured saved-account result rows.
- `src/ui/contexto-profile-surface.css`: embedded surface tokens, spacing, link-actions, grouped forms, responsive behavior, and focus treatment.
- `entrypoints/popup/App.tsx`: People, Filters, and search-action sections.
- `entrypoints/popup/App.css`: popup spacing and group hierarchy.
- `tests/contexto-feed-context.test.tsx`: feed grouping, order, and behavior regression coverage.
- `tests/contexto-profile-surface.test.tsx`: editor group semantics and existing lifecycle behavior.
- `tests/contexto-hover-launcher.test.tsx`: compact summary regression coverage.
- `tests/sidebar-account-search.test.tsx`: structured result and navigation coverage.
- `tests/contexto-surface-layout.test.ts`: embedded CSS contract coverage.
- `tests/popup.test.tsx`: popup section semantics and existing persistence behavior.
- `tests/popup-layout.test.ts`: popup CSS contract coverage.
- `docs/features/feed-saved-contact-context.md`, `docs/features/profile-metadata.md`, `docs/features/account-search.md`, `docs/features/x-search-builder.md`: canonical behavior documentation.

---

### Task 1: Group the saved-contact feed workflow

**Files:**
- Modify: `tests/contexto-feed-context.test.tsx`
- Modify: `tests/contexto-surface-layout.test.ts`
- Modify: `src/ui/ContextoFeedContext.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `docs/features/feed-saved-contact-context.md`

**Interfaces:**
- Consumes: existing `ContextoFeedContextProps`, `buildXCatchUpSearchUrl`, `buildXInteractionSearchUrl`, and all existing background messages.
- Produces: semantic containers `.contexto-feed-summary`, `.contexto-feed-local-actions`, `.contexto-feed-x-actions`, `.contexto-feed-x-links`, `.contexto-feed-checkpoint`, and `.contexto-feed-footer`; no exported TypeScript API changes.

- [ ] **Step 1: Write failing component tests for semantic groups and order**

Add a test after the existing interaction-search test:

```tsx
it('groups outbound X links together before the catch-up checkpoint', async () => {
  renderWithSettings({
    ok: true,
    settings: { myXHandle: '@liran_tal', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false },
  });

  await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
  const explore = screen.getByRole('group', { name: 'Explore on X' });
  const links = within(explore).getAllByRole('link');
  const checkpoint = within(explore).getByTestId('contexto-feed-checkpoint');

  expect(links.map((link) => link.textContent)).toEqual([
    expect.stringContaining('Catch up on X'),
    expect.stringContaining('View our interactions'),
  ]);
  expect(links[1].compareDocumentPosition(checkpoint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

Import `within` from Testing Library. Extend the existing summary test to expect visible group labels `Saved context` and `Add to Contexto`, and retain all safe-link, composer, checkpoint, and editor assertions.

- [ ] **Step 2: Run the focused component test and confirm RED**

Run: `npx vitest run tests/contexto-feed-context.test.tsx`

Expected: FAIL because there is no accessible `Explore on X` group or checkpoint test id, and the two links are separated by checkpoint markup.

- [ ] **Step 3: Write failing embedded-layout contract assertions**

Add assertions to `tests/contexto-surface-layout.test.ts`:

```ts
it('gives the feed panel readable grouped spacing and obvious X links', () => {
  const panel = ruleBody('.contexto-feed-panel');
  expect(panel).toContain('width:320px;');
  expect(panel).toContain('gap:0;');

  const section = ruleBody('.contexto-feed-section');
  expect(section).toContain('padding:12px 14px;');

  const xLink = ruleBody('.contexto-feed-x-link');
  expect(xLink).toContain('text-decoration:underline;');
  expect(xLink).toContain('min-height:44px;');
});
```

- [ ] **Step 4: Run the layout test and confirm RED**

Run: `npx vitest run tests/contexto-surface-layout.test.ts`

Expected: FAIL because the new grouped selectors and 320-pixel width do not exist.

- [ ] **Step 5: Implement the grouped feed markup**

Refactor only the returned JSX in `ContextoFeedContext.tsx` so it has this structure:

```tsx
<section className="contexto-feed-panel" role="dialog" aria-label="Contexto relationship context">
  <section className="contexto-feed-section contexto-feed-summary" aria-labelledby={`${panelId}-saved`}>
    <span className="contexto-feed-section-label" id={`${panelId}-saved`}>Saved context</span>
    {/* existing name, organization, relationship, tags, folders, latest note */}
  </section>
  <section className="contexto-feed-section contexto-feed-local-actions" aria-labelledby={`${panelId}-local`}>
    <span className="contexto-feed-section-label" id={`${panelId}-local`}>Add to Contexto</span>
    {/* existing quick-note and bookmark actions/composers */}
  </section>
  <section className="contexto-feed-section contexto-feed-x-actions" role="group" aria-labelledby={`${panelId}-x`}>
    <span className="contexto-feed-section-label" id={`${panelId}-x`}>Explore on X</span>
    <div className="contexto-feed-x-links">
      {/* Catch up anchor first; interaction anchor second when available */}
    </div>
    <div className="contexto-feed-checkpoint" data-testid="contexto-feed-checkpoint">
      {/* checkpoint date/first-use copy and Mark caught up */}
    </div>
    {/* catch-up success/error immediately after checkpoint */}
  </section>
  <footer className="contexto-feed-section contexto-feed-footer">
    <button className="primary-action" type="button" onClick={openEditor}>Open full context</button>
  </footer>
</section>
```

Give both anchors class `contexto-feed-x-link`; render concise supporting `<span>` copy and an `aria-hidden="true"` external-arrow glyph. Keep `target="_blank"` and `rel="noopener noreferrer"` unchanged.

- [ ] **Step 6: Implement the feed CSS**

Replace the compressed panel/action rules with grouped rules that include:

```css
.contexto-feed-panel { gap:0; width:320px; max-width:min(320px,calc(100vw - 24px)); padding:0; }
.contexto-feed-section { display:grid; gap:10px; padding:12px 14px; }
.contexto-feed-section + .contexto-feed-section { border-top:1px solid var(--ctx-border); }
.contexto-feed-section-label { color:var(--ctx-muted); font-size:11px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; }
.contexto-feed-local-actions > .contexto-feed-action-row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.contexto-feed-x-links { display:grid; gap:8px; }
.contexto-feed-x-link { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; min-height:44px; padding:8px 10px; border:1px solid color-mix(in srgb,var(--ctx-link) 35%,var(--ctx-border)); border-radius:10px; background:color-mix(in srgb,var(--ctx-link) 7%,var(--ctx-bg)); color:var(--ctx-link); font-weight:700; text-decoration:underline; text-underline-offset:2px; }
.contexto-feed-x-link > span { display:grid; gap:2px; }
.contexto-feed-x-link small { color:var(--ctx-muted); font-size:12px; font-weight:500; text-decoration:none; }
.contexto-feed-checkpoint { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.contexto-feed-footer .primary-action { width:100%; min-height:40px; }
```

Preserve light/dark tokens, composer styles, and visible focus rings.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run: `npx vitest run tests/contexto-feed-context.test.tsx tests/contexto-surface-layout.test.ts`

Expected: PASS with no unhandled errors.

- [ ] **Step 8: Update canonical feed documentation**

Add a **Panel organization** paragraph to `docs/features/feed-saved-contact-context.md` stating that saved context, local writes, outbound X links, checkpoint controls, and full context are separate groups, and that both X links are colocated before the checkpoint row.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/ui/ContextoFeedContext.tsx src/ui/contexto-profile-surface.css tests/contexto-feed-context.test.tsx tests/contexto-surface-layout.test.ts docs/features/feed-saved-contact-context.md
git commit -m "feat: clarify saved-contact feed actions"
```

---

### Task 2: Organize embedded editor, hover, and sidebar surfaces

**Files:**
- Modify: `tests/contexto-profile-surface.test.tsx`
- Modify: `tests/contexto-hover-launcher.test.tsx`
- Modify: `tests/sidebar-account-search.test.tsx`
- Modify: `tests/contexto-surface-layout.test.ts`
- Modify: `src/ui/ContextoProfileSurface.tsx`
- Modify: `src/ui/ContextoHoverLauncher.tsx`
- Modify: `src/ui/ContextoSidebarAccountSearch.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `docs/features/profile-metadata.md`
- Modify: `docs/features/account-search.md`

**Interfaces:**
- Consumes: existing props and account summaries; Task 1 CSS tokens and button primitives.
- Produces: semantic editor fieldsets `.contexto-form-section`, paired `.contexto-field-row`, and structured `.contexto-sidebar-result-*` spans; no exported API changes.

- [ ] **Step 1: Write failing semantic component tests**

Add to `tests/contexto-profile-surface.test.tsx`:

```tsx
it('groups editor fields by identity, work, and relationship', async () => {
  const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
    ? { ok: true, lookup: true, lookupAccount: undefined }
    : { ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } });
  renderSurface(send);

  const editor = await screen.findByRole('region', { name: 'Contexto profile editor' });
  expect(within(editor).getByRole('group', { name: 'Identity' })).toContainElement(screen.getByLabelText('Display name'));
  expect(within(editor).getByRole('group', { name: 'Work' })).toContainElement(screen.getByLabelText('Company'));
  expect(within(editor).getByRole('group', { name: 'Relationship' })).toContainElement(screen.getByLabelText('Tags'));
});
```

Import `within`. Update the sidebar navigation test to use the accessible name `Liran Tal, @liran_tal` and assert visible `@liran_tal`. Keep hover tests asserting that only the compact summary and Edit launcher appear.

- [ ] **Step 2: Run focused component tests and confirm RED**

Run: `npx vitest run tests/contexto-profile-surface.test.tsx tests/contexto-hover-launcher.test.tsx tests/sidebar-account-search.test.tsx`

Expected: FAIL because editor fieldsets and structured sidebar result names do not exist.

- [ ] **Step 3: Write failing CSS-contract tests**

Add assertions for `.contexto-form-section`, `.contexto-field-row`, `.contexto-sidebar-search-results button:focus-visible`, and a narrow media rule that changes `.contexto-field-row` to `display:grid`.

```ts
const formSection = ruleBody('.contexto-form-section');
expect(formSection).toContain('gap:10px;');
const fieldRow = ruleBody('.contexto-field-row');
expect(fieldRow).toContain('display:grid;');
expect(fieldRow).toContain('grid-template-columns:repeat(2,minmax(0,1fr));');
```

- [ ] **Step 4: Run layout tests and confirm RED**

Run: `npx vitest run tests/contexto-surface-layout.test.ts`

Expected: FAIL because the new grouped editor selectors do not exist.

- [ ] **Step 5: Implement editor fieldsets and paired rows**

In `ContextoProfileSurface.tsx`, replace the flat label list with:

```tsx
<fieldset className="contexto-form-section">
  <legend>Identity</legend>
  <div className="contexto-field-row">{/* Display name; X handle */}</div>
</fieldset>
<fieldset className="contexto-form-section">
  <legend>Work</legend>
  <div className="contexto-field-row">{/* Role; Company */}</div>
</fieldset>
<fieldset className="contexto-form-section">
  <legend>Relationship</legend>
  <div className="contexto-field-row">{/* Location; How you know them */}</div>
  <MultiValueField label="Tags" ... />
  <MultiValueField label="Folders" ... />
</fieldset>
```

Keep every value, change handler, disabled state, datalist, message, and action unchanged.

- [ ] **Step 6: Implement structured sidebar rows and compact hover spacing**

Render each sidebar result as:

```tsx
<button
  aria-label={`${account.displayName}, @${account.handle}`}
  key={account.id}
  type="button"
  onClick={() => navigate(account.profileUrl || `https://x.com/${account.normalizedHandle}`)}
>
  <strong className="contexto-sidebar-result-name">{account.displayName}</strong>
  <span className="contexto-sidebar-result-meta">
    @{account.handle}{[account.role, account.company?.name].filter(Boolean).length > 0
      ? ` · ${[account.role, account.company?.name].filter(Boolean).join(' · ')}` : ''}
  </span>
</button>
```

Retain the hover launcher markup and behavior; only add a class to its state text if needed for muted styling.

- [ ] **Step 7: Implement responsive embedded styles**

Add fieldset reset/spacing, two-column rows, structured sidebar result spacing, hover focus, and the existing `@media (max-width:360px)` collapse. Do not change page-editor positioning or close behavior.

- [ ] **Step 8: Run focused tests and confirm GREEN**

Run: `npx vitest run tests/contexto-profile-surface.test.tsx tests/contexto-hover-launcher.test.tsx tests/sidebar-account-search.test.tsx tests/contexto-surface-layout.test.ts`

Expected: PASS.

- [ ] **Step 9: Update canonical embedded-surface documentation**

Document the Identity/Work/Relationship editor groups in `docs/features/profile-metadata.md` and structured saved-account result rows in `docs/features/account-search.md`. Preserve all current lifecycle and X placement language.

- [ ] **Step 10: Commit Task 2**

```bash
git add src/ui/ContextoProfileSurface.tsx src/ui/ContextoHoverLauncher.tsx src/ui/ContextoSidebarAccountSearch.tsx src/ui/contexto-profile-surface.css tests/contexto-profile-surface.test.tsx tests/contexto-hover-launcher.test.tsx tests/sidebar-account-search.test.tsx tests/contexto-surface-layout.test.ts docs/features/profile-metadata.md docs/features/account-search.md
git commit -m "feat: organize embedded Contexto surfaces"
```

---

### Task 3: Clarify the toolbar quick-search popup

**Files:**
- Modify: `tests/popup.test.tsx`
- Modify: `tests/popup-layout.test.ts`
- Modify: `entrypoints/popup/App.tsx`
- Modify: `entrypoints/popup/App.css`
- Modify: `docs/features/x-search-builder.md`

**Interfaces:**
- Consumes: existing popup state, target-handle combobox, search action definitions, and navigation callbacks.
- Produces: labeled popup sections `People`, `Filters`, and `Choose what to search`; no state or search-query API changes.

- [ ] **Step 1: Write failing popup section tests**

Add to `tests/popup.test.tsx`:

```tsx
it('groups people, filters, and search actions under visible headings', async () => {
  render(<App />);
  await screen.findByLabelText('My X handle');

  const people = screen.getByRole('group', { name: 'People' });
  const filters = screen.getByRole('group', { name: 'Filters' });
  const actions = screen.getByRole('group', { name: 'Choose what to search' });

  expect(within(people).getByLabelText('My X handle')).toBeVisible();
  expect(within(people).getByLabelText(/Other person/)).toBeVisible();
  expect(within(filters).getByLabelText('Keyword')).toBeVisible();
  expect(within(filters).getByLabelText('Since')).toBeVisible();
  expect(within(actions).getAllByRole('button')).toHaveLength(4);
});
```

Import `within` and retain all persistence/autosuggest tests.

- [ ] **Step 2: Run the popup component test and confirm RED**

Run: `npx vitest run tests/popup.test.tsx`

Expected: FAIL because People and Filters are not accessible named groups.

- [ ] **Step 3: Write failing popup layout-contract tests**

Replace the old condensed-padding expectation with:

```ts
it('uses readable shell and group spacing without changing popup width', () => {
  const shell = ruleBody(appCss, '.popup-shell');
  expect(shell).toContain('width: 400px;');
  expect(shell).toContain('padding: 16px;');

  const section = ruleBody(appCss, '.popup-section');
  expect(section).toContain('gap: 10px;');
  expect(section).toContain('margin-bottom: 16px;');
});
```

Retain one-line preview and fallback body scrolling assertions.

- [ ] **Step 4: Run the popup layout test and confirm RED**

Run: `npx vitest run tests/popup-layout.test.ts`

Expected: FAIL against the current 10/20/10/12 shell padding and 7/9 section spacing.

- [ ] **Step 5: Implement semantic popup groups**

Use `section` with `role="group"` and `aria-labelledby`:

```tsx
<section className="popup-section search-fields" role="group" aria-labelledby="people-heading">
  <h2 id="people-heading">People</h2>
  {/* both handle controls and their current helper text */}
</section>
<section className="popup-section search-fields" role="group" aria-labelledby="filters-heading">
  <h2 id="filters-heading">Filters</h2>
  {/* keyword and current date row */}
</section>
<section className="popup-section action-grid" role="group" aria-labelledby="search-actions-heading">
  {/* existing heading, guidance, and four actions */}
</section>
```

Do not change settings reads/writes, action enablement, previews, history, or tab navigation.

- [ ] **Step 6: Implement popup spacing and hierarchy**

Set `.popup-shell` padding to `16px`, `.popup-section` gap to `10px` and margin-bottom to `16px`, inputs to at least 36 pixels high, and section `h2` styles consistent with the current action heading. Keep the 400-pixel width, body max-height/scrolling, one-line previews, combobox overlay, and footer separation.

- [ ] **Step 7: Run focused popup checks and confirm GREEN**

Run: `npx vitest run tests/popup.test.tsx tests/popup-autosuggest.test.tsx tests/popup-layout.test.ts tests/popup-error-boundary.test.tsx`

Expected: PASS.

- [ ] **Step 8: Update canonical popup documentation**

Document the People, Filters, and action grouping in `docs/features/x-search-builder.md` without changing supported queries or filters.

- [ ] **Step 9: Commit Task 3**

```bash
git add entrypoints/popup/App.tsx entrypoints/popup/App.css tests/popup.test.tsx tests/popup-layout.test.ts docs/features/x-search-builder.md
git commit -m "feat: clarify toolbar search workflow"
```

---

### Task 4: Full verification and browser QA handoff

**Files:**
- Modify if needed: `docs/development/browser-workflow.md`
- Modify if needed: `docs/testing.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a release-verification record in command output and canonical QA guidance only if assumptions changed.

- [ ] **Step 1: Run formatting and diff checks**

Run: `git diff --check main...HEAD`

Expected: exit 0 with no whitespace errors.

- [ ] **Step 2: Run the full automated test suite**

Run: `npm test`

Expected: all Vitest files and tests pass with zero failures.

- [ ] **Step 3: Run TypeScript compilation**

Run: `npm run compile`

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 4: Build the production extension**

Run: `npm run build`

Expected: WXT completes the Chrome MV3 production build successfully.

- [ ] **Step 5: Verify the built popup bundle**

Run: `npm run verify:popup`

Expected: exit 0 and a successful popup-bundle verification message.

- [ ] **Step 6: Review the implementation against every design requirement**

Check `docs/superpowers/specs/2026-10-18-contexto-surface-ux-refresh-design.md` line by line and confirm:

```text
Feed: grouped summary/local/X/checkpoint/footer; two X links consecutive; checkpoint below.
Hover: compact summary only; no editor inside X hover subtree.
Editor: Identity/Work/Relationship groups; lifecycle contract unchanged.
Sidebar: structured results; native X search untouched.
Popup: People/Filters/Search groups; 400px width; scrolling fallback.
Accessibility: labels, semantic links/buttons, focus, light/dark, narrow reflow.
Docs: current feature docs match implemented behavior.
```

- [ ] **Step 7: Perform or clearly hand off manual browser checks**

Use the existing matrix in `docs/development/browser-workflow.md` in Chrome and Vivaldi. If browser access is unavailable, report these rows as remaining manual QA rather than claiming completion: saved feed panel in light/dark and narrow views, note/bookmark composers, checkpoint success/failure, hover-card fit, inline/docked/modal editor, sidebar search, toolbar popup at 100% and increased zoom, extension reload/navigation.

- [ ] **Step 8: Commit any verification-documentation adjustments**

If and only if the QA workflow changed:

```bash
git add docs/development/browser-workflow.md docs/testing.md
git commit -m "docs: update Contexto surface QA"
```

If no workflow text changed, do not create an empty commit.
