# X Sidebar Embedded Workspace Top Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase the top margin of the Contexto workspace embedded in X's right sidebar from 12px to 24px without changing the toolbar popup or other surfaces.

**Architecture:** Keep the fix at the existing Contexto-owned sidebar host selector in `src/ui/contexto-profile-surface.css`. Add a CSS contract assertion in the existing surface layout test so the host-level spacing remains exactly `24px 0 16px`; do not change X DOM mounting or the shared Quick X search component.

**Tech Stack:** TypeScript, Vitest, CSS, npm scripts, Git.

## Global Constraints

- X DOM is transient and untrusted; this visual-only change must not alter selectors, mounting, or X-owned nodes.
- The toolbar popup and other Contexto surfaces remain unchanged.
- The embedded X sidebar host uses `margin:24px 0 16px;`.
- Run the focused regression test, full test suite, compile, build, and popup verification before claiming completion.

---

### Task 1: Increase embedded X sidebar top spacing

**Files:**
- Modify: `tests/contexto-surface-layout.test.ts`
- Modify: `src/ui/contexto-profile-surface.css`

**Interfaces:**
- Consumes: the existing `ruleBody(stylesheet, selector)` CSS contract helper and the existing `:host([data-contexto-surface="sidebar-search"])` rule.
- Produces: a tested sidebar host rule containing `margin:24px 0 16px;`.

- [ ] **Step 1: Add the failing CSS contract assertion**

In the existing `keeps the sidebar search clear of the viewport edge and native X search` test, change the expected host margin from `margin:12px 0 16px;` to the requested 2× top spacing:

```ts
expect(host).toContain('margin:24px 0 16px;');
```

- [ ] **Step 2: Run the focused test and verify it fails for the old margin**

Run:

```sh
npx vitest run tests/contexto-surface-layout.test.ts
```

Expected: the layout test fails because the stylesheet still contains `margin:12px 0 16px;`, while unrelated layout assertions remain valid.

- [ ] **Step 3: Make the minimal CSS change**

In `src/ui/contexto-profile-surface.css`, update only the sidebar host declaration:

```css
:host([data-contexto-surface="sidebar-search"]) { --ctx-bg:#fff; --ctx-text:#0f1419; --ctx-muted:#536471; --ctx-label:#536471; --ctx-border:#eff3f4; --ctx-subtle-border:#eff3f4; --ctx-accent:#5b3fd6; --ctx-link:#1d9bf0; --ctx-hover:#f7f9f9; display:block; width:100%; margin:24px 0 16px; color-scheme:light; }
```

Do not modify the dark-theme rule, `.contexto-sidebar-workspace`, `.contexto-quick-search`, popup styles, or any mounting code.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```sh
npx vitest run tests/contexto-surface-layout.test.ts
```

Expected: all tests in that file pass.

- [ ] **Step 5: Run the required repository verification**

Run:

```sh
npm run compile
npm test
npm run build
npm run verify:popup
```

Expected: each command exits with status 0 and reports no failed tests or build errors.

- [ ] **Step 6: Review and commit the implementation**

Run:

```sh
git -c safe.directory=/workspaces/contexto-web-extension diff --check
git -c safe.directory=/workspaces/contexto-web-extension diff -- src/ui/contexto-profile-surface.css tests/contexto-surface-layout.test.ts
git -c safe.directory=/workspaces/contexto-web-extension status --short
```

Confirm that only the focused CSS and test files contain implementation changes, then commit:

```sh
git -c safe.directory=/workspaces/contexto-web-extension add src/ui/contexto-profile-surface.css tests/contexto-surface-layout.test.ts
git -c safe.directory=/workspaces/contexto-web-extension commit -m "fix: add top spacing to X sidebar workspace"
```
