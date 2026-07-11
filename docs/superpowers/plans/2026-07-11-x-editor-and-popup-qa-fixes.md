# X Editor and Toolbar Popup QA Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile hover-card form with a persistent right-rail/modal editor, keep all profile editors visible after saves, and make the production toolbar popup render reliably.

**Architecture:** Split the current shared surface into a compact hover launcher and a reusable always-visible editor. A content-script-owned page editor controller mounts outside transient hover cards and chooses X's right rail or a modal fallback. The popup keeps its current search experience but restores classic-JSX bindings, contains async failures, adds a render fallback, and verifies the generated WXT artifact.

**Tech Stack:** TypeScript 5.9, React 19, WXT 0.20, Shadow DOM, Vitest 4, Testing Library, IndexedDB/Dexie.

## Global Constraints

- Keep `react.vite.jsxRuntime` set to `classic` in `wxt.config.ts`.
- Keep all persistence behind existing background messages; content-script UI must not access repositories directly.
- Keep unsaved drafts memory-only and keyed by normalized X handle.
- Do not patch or emulate X's internal hover-dismissal timers.
- The complete editor must remain visible after every successful save.
- The right-rail editor must fall back to a Contexto-owned modal when `[data-testid="sidebarColumn"]` is unavailable.
- Autosuggest, history, settings, or IndexedDB failures must not blank the base popup form.

---

### Task 1: Production-safe toolbar popup startup

**Files:**
- Create: `entrypoints/popup/PopupErrorBoundary.tsx`
- Create: `scripts/verify-popup-bundle.mjs`
- Create: `tests/popup-error-boundary.test.tsx`
- Modify: `entrypoints/popup/App.tsx`
- Modify: `entrypoints/popup/main.tsx`
- Modify: `src/ui/TargetHandleCombobox.tsx`
- Modify: `tests/popup.test.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `PopupErrorBoundary({ children }: { children: React.ReactNode })`.
- Produces: `npm run verify:popup`, which validates the popup chunk referenced by `.output/chrome-mv3/popup.html`.
- Preserves: `App`'s current fields, actions, persistence, and target-handle suggestions.

- [ ] **Step 1: Write failing popup resilience tests**

Add a rejection case to `tests/popup.test.tsx` that makes settings, saved search state, history, and account suggestions reject, renders `<App />`, and asserts that `My X handle`, `Other person's X handle`, and `Keyword` remain visible with default values. Add `tests/popup-error-boundary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PopupErrorBoundary } from '@/entrypoints/popup/PopupErrorBoundary';

function Broken() { throw new Error('render exploded'); }

describe('PopupErrorBoundary', () => {
  it('shows a recovery state instead of a blank popup', async () => {
    const reload = vi.spyOn(location, 'reload').mockImplementation(() => undefined);
    render(<PopupErrorBoundary><Broken /></PopupErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Contexto could not open');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run tests/popup.test.tsx tests/popup-error-boundary.test.tsx`

Expected: FAIL because `PopupErrorBoundary` does not exist and rejected initialization is not independently contained.

- [ ] **Step 3: Add the popup boundary and independent loading**

Create a class error boundary that renders this recovery UI after `getDerivedStateFromError`:

```tsx
<main className="popup-shell popup-recovery" role="alert">
  <h1>Contexto could not open</h1>
  <p>Reload the popup and try again.</p>
  <button type="button" onClick={() => location.reload()}>Retry</button>
</main>
```

Wrap `<App />` with it in `entrypoints/popup/main.tsx`. In `App.tsx`, restore `import React, { ... } from 'react'` and replace the first `Promise.all` with `Promise.allSettled`, applying each fulfilled result independently. Restore an in-scope `React` binding in `TargetHandleCombobox.tsx` as well.

- [ ] **Step 4: Verify component GREEN**

Run: `npm test -- --run tests/popup.test.tsx tests/popup-autosuggest.test.tsx tests/target-handle-combobox.test.tsx tests/popup-error-boundary.test.tsx`

Expected: all focused popup tests PASS.

- [ ] **Step 5: Write and run the failing production-artifact check**

Create `scripts/verify-popup-bundle.mjs` to:

```js
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('.output/chrome-mv3');
const html = await readFile(resolve(output, 'popup.html'), 'utf8');
const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
if (!src) throw new Error('popup.html has no module entry');
const bundle = await readFile(resolve(output, src.replace(/^\//, '')), 'utf8');
if (/\bReact\.createElement\b/.test(bundle)) {
  throw new Error('Popup bundle contains an unbound classic-JSX React reference');
}
console.log('Popup bundle React binding verified');
```

Add `"verify:popup": "node scripts/verify-popup-bundle.mjs"` to `package.json`. Before rebuilding, run `npm run verify:popup` against the current broken build and confirm it fails with the unbound-reference message.

- [ ] **Step 6: Rebuild and verify production GREEN**

Run: `npm run build && npm run verify:popup`

Expected: build exits 0 and prints `Popup bundle React binding verified`.

- [ ] **Step 7: Commit Task 1**

```bash
git add entrypoints/popup src/ui/TargetHandleCombobox.tsx tests/popup.test.tsx tests/popup-error-boundary.test.tsx scripts/verify-popup-bundle.mjs package.json
git commit -m "fix: restore toolbar popup rendering"
```

---

### Task 2: Always-visible shared profile editor

**Files:**
- Modify: `src/ui/ContextoProfileSurface.tsx`
- Modify: `tests/contexto-profile-surface.test.tsx`
- Modify: `src/ui/contexto-profile-surface.css`

**Interfaces:**
- Extends: `ContextoProfileSurfaceProps` with optional `onRequestClose?: () => void` and `placement?: 'inline' | 'docked' | 'modal'`.
- Preserves: existing lookup and `contexto:account:saveContext` message contracts.
- Produces: an editor that always enters editing state after successful lookup and stays editing after save.

- [ ] **Step 1: Replace summary assertions with always-visible editor assertions**

Change the successful-save test to assert after the save response:

```tsx
expect(await screen.findByLabelText('Display name')).toHaveValue('Theo Browne');
expect(screen.getByLabelText('Position')).toHaveValue('CEO');
expect(screen.getByLabelText('Company')).toHaveValue('t3dotchat');
expect(screen.getByText('Saved to Contexto')).toHaveAttribute('role', 'status');
expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
```

Add tests proving an existing account opens directly as a populated editor, full-profile Cancel restores persisted values while leaving the form visible, and `onRequestClose` causes Cancel to close only after the draft is restored.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm test -- --run tests/contexto-profile-surface.test.tsx`

Expected: FAIL because successful saves and existing-account lookup still enter `summary`.

- [ ] **Step 3: Implement the always-visible state model**

Remove the `summary` state and summary render branch. Found and missing accounts both transition to `editing`. After save, clear the draft store, set the returned account and returned draft, remain editing, and set a success status string. Render the status with `role="status"` and `aria-live="polite"`.

Make Cancel run:

```ts
const restored = draftFor(profile, account);
setDraft(restored);
drafts.clear(profile.handle);
setError('');
setSuccess('');
onRequestClose?.();
```

When `onRequestClose` is absent, the inline form remains mounted. Add `data-placement={placement ?? 'inline'}` for placement-specific styling and expose a close button only when `onRequestClose` exists; it follows the same restore-and-close behavior as Cancel.

- [ ] **Step 4: Verify component GREEN**

Run: `npm test -- --run tests/contexto-profile-surface.test.tsx`

Expected: all profile-surface tests PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/ui/ContextoProfileSurface.tsx src/ui/contexto-profile-surface.css tests/contexto-profile-surface.test.tsx
git commit -m "fix: keep profile context editor visible"
```

---

### Task 3: Compact hover launcher

**Files:**
- Create: `src/ui/ContextoHoverLauncher.tsx`
- Create: `tests/contexto-hover-launcher.test.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `src/x/mount-contexto-surface.tsx`
- Modify: `tests/content-mount.test.tsx`

**Interfaces:**
- Produces: `ContextoHoverLauncherProps { profile; send; onEdit(profile, returnFocusTarget): void }`.
- Extends: `MountContextoSurfaceOptions` with `openPageEditor(profile, returnFocusTarget): void`.
- Preserves: full-profile mounts of `ContextoProfileSurface`.

- [ ] **Step 1: Write failing launcher and mount-routing tests**

The launcher test must cover missing, saved, and failed lookup states. For a missing account it asserts `Not saved`, an **Edit** button, and no `Display name` input. Clicking **Edit** must call `onEdit(profile, buttonElement)`. For a saved account it asserts `Saved` and the same action.

Update `tests/content-mount.test.tsx` to mount both surface kinds and assert the hover Shadow DOM contains a launcher without form fields while the full-profile Shadow DOM contains the editor.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/contexto-hover-launcher.test.tsx tests/content-mount.test.tsx`

Expected: FAIL because the launcher and mount routing do not exist.

- [ ] **Step 3: Implement the launcher**

The launcher performs only `contexto:account:lookup`. Render:

```tsx
<section className="contexto-hover-launcher" aria-label="Contexto profile context">
  <strong>◆ Contexto</strong>
  <span>{account ? 'Saved' : 'Not saved'}</span>
  <button ref={buttonRef} type="button" onClick={() => onEdit(profile, buttonRef.current!)}>Edit</button>
</section>
```

On lookup failure, show `Contexto unavailable` plus a compact **Retry** button. Do not create or mutate an `AccountDraftStore` entry.

In `mountContextoSurface`, render the launcher for `hover-card` and `ContextoProfileSurface` for `full-profile`.

- [ ] **Step 4: Verify focused GREEN**

Run: `npm test -- --run tests/contexto-hover-launcher.test.tsx tests/content-mount.test.tsx`

Expected: both test files PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/ui/ContextoHoverLauncher.tsx src/ui/contexto-profile-surface.css src/x/mount-contexto-surface.tsx tests/contexto-hover-launcher.test.tsx tests/content-mount.test.tsx
git commit -m "feat: add compact Contexto hover launcher"
```

---

### Task 4: Persistent right-rail editor with modal fallback

**Files:**
- Create: `src/x/page-editor-controller.tsx`
- Create: `tests/page-editor-controller.test.tsx`
- Modify: `entrypoints/content.ts`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `src/x/mount-contexto-surface.tsx`
- Modify: `tests/content-mount.test.tsx`

**Interfaces:**
- Produces: `createPageEditorController({ root, send, drafts, css }): { open(profile, returnFocusTarget): void; close(): void; disconnect(): void }`.
- Consumes: `ContextoProfileSurface` with `placement` and `onRequestClose`.
- Supplies: `controller.open` as `openPageEditor` to every hover launcher mount.

- [ ] **Step 1: Write failing controller lifecycle tests**

Use a document fixture containing `[data-testid="sidebarColumn"]`. After `open(profile, button)`, assert one `[data-contexto-page-editor]` host is appended to that column with `data-placement="docked"`. Remove the originating hover fixture and assert the editor host remains connected. Remove the sidebar and trigger mutations; assert the same host moves under `document.body` with `data-placement="modal"`. Add a no-sidebar case that starts modal. Assert `disconnect()` removes the host and observer.

- [ ] **Step 2: Run the controller test and verify RED**

Run: `npm test -- --run tests/page-editor-controller.test.tsx`

Expected: FAIL because the controller module does not exist.

- [ ] **Step 3: Implement the page-level controller**

Create one Shadow DOM host and one React root lazily. `open()` stores the active profile and focus target, chooses placement with:

```ts
const rail = root.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');
const placement = rail ? 'docked' : 'modal';
(rail ?? root).append(host);
host.dataset.placement = placement;
```

Render `ContextoProfileSurface` with `kind="hover-card"`, the chosen placement, and `onRequestClose`. Closing unmounts/removes the host and restores focus when the launcher is still connected. A throttled `MutationObserver` re-runs placement while open so removing/restoring the right rail moves the same host without recreating the React root or losing draft state.

Before replacing an active profile, check `drafts.get(activeProfile.handle)`. If a different account has a draft, retain the current editor. Otherwise render the new profile.

Add docked and modal host rules to the isolated CSS. Docked mode uses normal flow within the rail and a sticky top offset. Modal mode uses a fixed full-viewport backdrop with a centered, scrollable editor and a high extension-owned z-index.

- [ ] **Step 4: Connect the controller to the content script**

Create the controller once in `entrypoints/content.ts`, pass `pageEditor.open` through `mountContextoSurface`, close it on page-context navigation, and disconnect it during content-script invalidation. The existing surface observer continues owning only X-surface mounts.

- [ ] **Step 5: Verify controller and mount GREEN**

Run: `npm test -- --run tests/page-editor-controller.test.tsx tests/content-mount.test.tsx tests/x-surface-observer.test.ts`

Expected: all focused lifecycle tests PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add entrypoints/content.ts src/x/page-editor-controller.tsx src/x/mount-contexto-surface.tsx src/ui/contexto-profile-surface.css tests/page-editor-controller.test.tsx tests/content-mount.test.tsx
git commit -m "feat: dock persistent Contexto profile editor"
```

---

### Task 5: Documentation and complete verification

**Files:**
- Modify: `docs/features/profile-metadata.md`
- Modify: `docs/superpowers/specs/2026-07-11-inline-x-context-design.md`
- Modify: `README.md` only if its documented popup/profile behavior is now inaccurate.

**Interfaces:**
- Documents: hover launcher, docked/modal editor placement, always-visible post-save editor, and popup recovery behavior.

- [ ] **Step 1: Update user-facing behavior docs**

Replace statements that saved inline surfaces collapse to a summary. Document that hover cards expose a compact **Edit** launcher, editing continues in the right rail with a modal fallback, and successful saves leave the editor visible with authoritative saved values. Add a short supersession note to the earlier inline-X design rather than rewriting its historical decision record.

- [ ] **Step 2: Run the complete automated verification**

Run:

```bash
npm test
npm run compile
npm run build
npm run verify:popup
```

Expected: every command exits 0; Vitest reports 0 failed tests; TypeScript reports no errors; WXT builds Chrome MV3; the popup verifier prints `Popup bundle React binding verified`.

- [ ] **Step 3: Inspect the final diff and generated artifact**

Run:

```bash
git diff --check
git status --short
rg -n "React\.createElement" .output/chrome-mv3/chunks/popup-*.js
```

Expected: no whitespace errors; only planned source/docs changes are present; the final `rg` returns no matches.

- [ ] **Step 4: Commit documentation and verification support**

```bash
git add docs README.md package.json scripts/verify-popup-bundle.mjs
git commit -m "docs: describe persistent X profile editing"
```

- [ ] **Step 5: Manual QA handoff**

Build and reload `.output/chrome-mv3` in Chrome or Vivaldi. Verify:

1. Toolbar popup renders the complete search form.
2. Autosuggest storage/database failure does not blank the form.
3. Hover card shows a compact Contexto row without the full form.
4. **Edit** opens the right-rail editor and the hover card may disappear without closing it.
5. Narrowing the window or removing the sidebar uses the modal fallback without losing edits.
6. Full profile pages show the complete form.
7. Saving from full-profile, docked, and modal placements keeps the form visible and repopulates it with saved values.
