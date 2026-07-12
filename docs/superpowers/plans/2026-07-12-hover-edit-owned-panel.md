# X Hover Edit Contexto-Owned Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hover Edit open reliably before X removes the hover card and render the complete editor in a visible Contexto-owned responsive panel.

**Architecture:** Remove pointer-type filtering from the launcher's pointer-down path, preserving click deduplication and keyboard activation. Refactor the page editor controller to mount directly under `document.body`, select fixed-panel or modal placement from `matchMedia('(min-width: 1100px)')`, and stop depending on X's sidebar DOM.

**Tech Stack:** TypeScript 5.9, React 19, WXT 0.20, Chrome MV3, Vitest 4, Testing Library, Shadow DOM, CSS media placement.

## Global Constraints

- Do not query or mount into X's `[data-testid="sidebarColumn"]`.
- At 1100px and wider, show a 380px Contexto-owned fixed top-right panel.
- Below 1100px, retain the existing centered modal and dialog semantics.
- Preserve keyboard Edit activation and deduplicate pointer-down plus click.
- Keep compact saved metadata, full-profile editor, toolbar popup, drafts, saving, and cancellation unchanged.
- Use failing regression tests before production changes.

---

### Task 1: Activate Edit for every pointer-down

**Files:**
- Modify: `tests/contexto-hover-launcher.test.tsx`
- Modify: `src/ui/ContextoHoverLauncher.tsx`

**Interfaces:**
- Consumes: `onEdit(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void`.
- Produces: exactly one `onEdit` call for pointer-down followed by click, even when `pointerType` is empty or unknown.
- Preserves: one `onEdit` call for a keyboard-generated click without pointer-down.

- [ ] **Step 1: Change the pointer regression to omit pointerType and remove the hover before click**

In `tests/contexto-hover-launcher.test.tsx`, change `renderLauncher` to return its Testing Library render result alongside `onEdit`:

```tsx
function renderLauncher(send: ReturnType<typeof vi.fn>, onEdit = vi.fn()) {
  const view = render(<ContextoHoverLauncher profile={profile} send={send as ContextoHoverLauncherProps['send']} onEdit={onEdit} />);
  return { onEdit, ...view };
}
```

Update existing call sites to destructure `onEdit` where required. Replace the pointer test with:

```tsx
it('opens on pointer-down without relying on pointerType before X removes the hover card', async () => {
  const { onEdit, unmount } = renderLauncher(
    vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: undefined }),
  );
  const edit = await screen.findByRole('button', { name: 'Edit' });

  fireEvent.pointerDown(edit);
  expect(onEdit).toHaveBeenCalledOnce();
  unmount();
});

it('does not duplicate pointer activation with its subsequent click', async () => {
  const { onEdit } = renderLauncher(
    vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: undefined }),
  );
  const edit = await screen.findByRole('button', { name: 'Edit' });

  fireEvent.pointerDown(edit);
  fireEvent.click(edit);
  expect(onEdit).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the launcher test and verify RED**

```bash
npx vitest run tests/contexto-hover-launcher.test.tsx --reporter=verbose
```

Expected: the pointer-down-without-pointerType test FAILS because the current handler filters out the empty value.

- [ ] **Step 3: Remove pointerType filtering**

In `src/ui/ContextoHoverLauncher.tsx`, replace `handlePointerDown` with:

```ts
function handlePointerDown() {
  pointerActivatedRef.current = true;
  openEditor();
}
```

Keep `handleClick` unchanged so it consumes the pointer activation flag or opens for keyboard click.

- [ ] **Step 4: Run the launcher test and verify GREEN**

```bash
npx vitest run tests/contexto-hover-launcher.test.tsx --reporter=verbose
```

Expected: all launcher tests PASS.

- [ ] **Step 5: Commit the activation fix**

```bash
git add tests/contexto-hover-launcher.test.tsx src/ui/ContextoHoverLauncher.tsx
git commit -m "fix: open hover editor on every pointer down"
```

---

### Task 2: Render the editor in a Contexto-owned responsive panel

**Files:**
- Modify: `src/x/page-editor-controller.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `tests/page-editor-controller.test.tsx`
- Modify: `tests/contexto-surface-layout.test.ts`
- Create: `tests/hover-edit-integration.test.tsx`

**Interfaces:**
- Consumes: `createPageEditorController({ root, send, drafts, css })` with `root === document.body`.
- Produces: one `[data-contexto-page-editor]` host directly under `root`.
- Uses: `root.ownerDocument.defaultView?.matchMedia('(min-width: 1100px)')`.
- Emits: `data-placement="docked"` when the query matches and `data-placement="modal"` otherwise.

- [ ] **Step 1: Add a controllable matchMedia fixture to controller tests**

In `tests/page-editor-controller.test.tsx`, add:

```ts
function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    get matches() { return matches; },
    media: '(min-width: 1100px)', onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return {
    setMatches(next: boolean) {
      matches = next;
      for (const listener of listeners) listener({ matches: next, media: query.media } as MediaQueryListEvent);
    },
    listeners,
  };
}
```

Add `vi.unstubAllGlobals()` to `afterEach`.

- [ ] **Step 2: Replace sidebar-owned expectations with body-owned responsive expectations**

Replace the first controller test with:

```ts
it('renders a wide-screen panel under the Contexto-owned root instead of X sidebar content', () => {
  installMatchMedia(true);
  const hover = document.createElement('div');
  const button = document.createElement('button');
  hover.append(button);
  const rail = document.createElement('aside');
  rail.dataset.testid = 'sidebarColumn';
  rail.append(document.createElement('div'), document.createElement('div'));
  document.body.append(hover, rail);
  const controller = createPageEditorController({ root: document.body, send: vi.fn(), drafts: new AccountDraftStore(), css: '' });

  controller.open(profile, button);

  const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
  expect(host.parentElement).toBe(document.body);
  expect(rail.contains(host)).toBe(false);
  expect(host.dataset.placement).toBe('docked');
  hover.remove();
  expect(host.isConnected).toBe(true);
  controller.disconnect();
});
```

Replace the sidebar-removal test with a responsive transition test:

```ts
it('uses the same body-owned host when changing from panel to modal', () => {
  const viewport = installMatchMedia(true);
  const button = document.createElement('button');
  document.body.append(button);
  const controller = createPageEditorController({ root: document.body, send: vi.fn(), drafts: new AccountDraftStore(), css: '' });

  controller.open(profile, button);
  const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
  viewport.setMatches(false);

  expect(document.querySelector('[data-contexto-page-editor]')).toBe(host);
  expect(host.parentElement).toBe(document.body);
  expect(host.dataset.placement).toBe('modal');
  controller.disconnect();
  expect(viewport.listeners.size).toBe(0);
});
```

Call `installMatchMedia(false)` at the start of the existing modal tests and `installMatchMedia(true)` at the start of the clean-account switch test.

- [ ] **Step 3: Add CSS contract assertions for the fixed panel**

In `tests/contexto-surface-layout.test.ts`, add:

```ts
it('keeps the docked editor visible as a fixed Contexto-owned right panel', () => {
  const panel = ruleBody(':host([data-contexto-page-editor][data-placement="docked"])');
  expect(panel).toContain('position:fixed;');
  expect(panel).toContain('z-index:2147483645;');
  expect(panel).toContain('top:12px;');
  expect(panel).toContain('right:16px;');
  expect(panel).toContain('width:min(380px,calc(100vw - 32px));');
  expect(panel).not.toContain('position:sticky;');
});
```

- [ ] **Step 4: Add a real Shadow DOM launcher-to-controller integration regression**

Create `tests/hover-edit-integration.test.tsx` with a wide `matchMedia` stub, a populated sidebar fixture, real `mountContextoSurface`, and real `createPageEditorController`. The test must:

```tsx
const controller = createPageEditorController({ root: document.body, send, drafts, css: '' });
const cleanup = mountContextoSurface({
  surface: { kind: 'hover-card', host: hover, profile },
  send, drafts, css: '', theme: 'light', openPageEditor: controller.open,
});
const launcherHost = hover.querySelector<HTMLElement>('[data-contexto-surface="hover-card"]')!;
const edit = await waitFor(() => {
  const button = launcherHost.shadowRoot?.querySelector<HTMLButtonElement>('button');
  expect(button).not.toBeDisabled();
  return button!;
});

fireEvent.pointerDown(edit);
hover.remove();

const editorHost = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
expect(editorHost.parentElement).toBe(document.body);
expect(sidebar.contains(editorHost)).toBe(false);
expect(editorHost.dataset.placement).toBe('docked');
```

The `send` fixture returns an unsaved lookup response for `contexto:account:lookup` and empty lookup collections for `contexto:lookups:list`. Cleanup calls both `cleanup()` and `controller.disconnect()`.

- [ ] **Step 5: Run controller, layout, and integration tests and verify RED**

```bash
npx vitest run tests/page-editor-controller.test.tsx tests/contexto-surface-layout.test.ts tests/hover-edit-integration.test.tsx --reporter=verbose
```

Expected: tests FAIL because the controller still chooses/appends to X's sidebar and docked CSS is sticky rather than fixed.

- [ ] **Step 6: Refactor the controller to use the body-owned root and media query**

In `src/x/page-editor-controller.tsx`:

- Create `const wideViewport = root.ownerDocument.defaultView?.matchMedia?.('(min-width: 1100px)');`.
- Replace sidebar detection with `const nextPlacement = wideViewport?.matches ? 'docked' : 'modal';`.
- Always append/move `host` to `root`.
- Register `wideViewport?.addEventListener('change', place)` after `place` is defined.
- Remove the root `MutationObserver`, placement timer, and all sidebar queries.
- In `disconnect`, call `wideViewport?.removeEventListener('change', place)` before `close()`.

The placement function becomes:

```ts
function place() {
  if (!host || !activeProfile) return;
  const nextPlacement = wideViewport?.matches ? 'docked' : 'modal';
  if (host.parentElement !== root) root.append(host);
  host.dataset.placement = nextPlacement;
  host.dataset.theme = detectXTheme(root);
  if (placement !== nextPlacement) {
    placement = nextPlacement;
    needsModalFocus = nextPlacement === 'modal';
    renderEditor();
  }
  focusModalControl();
}
```

In `open`, call `ensureHost()`, set `placement` from `wideViewport`, append the host to `root`, set theme from `root`, render, and focus.

- [ ] **Step 7: Change docked CSS from sticky flow to fixed panel**

In `src/ui/contexto-profile-surface.css`, replace the docked host rule with:

```css
:host([data-contexto-page-editor][data-placement="docked"]) { display:block; position:fixed; z-index:2147483645; top:12px; right:16px; box-sizing:border-box; width:min(380px,calc(100vw - 32px)); max-height:calc(100vh - 24px); overflow:auto; border:1px solid #eff3f4; border-radius:16px; background:#fff; box-shadow:0 8px 28px rgb(15 20 25 / 12%); }
```

- [ ] **Step 8: Run controller, layout, and integration tests and verify GREEN**

```bash
npx vitest run tests/page-editor-controller.test.tsx tests/page-editor-controller-real.test.tsx tests/contexto-surface-layout.test.ts tests/hover-edit-integration.test.tsx --reporter=verbose
```

Expected: all focused tests PASS.

- [ ] **Step 9: Commit the Contexto-owned panel**

```bash
git add src/x/page-editor-controller.tsx src/ui/contexto-profile-surface.css tests/page-editor-controller.test.tsx tests/contexto-surface-layout.test.ts tests/hover-edit-integration.test.tsx
git commit -m "fix: render hover editor in owned panel"
```

---

### Task 3: Verify and finish

**Files:**
- Review: all files changed by Tasks 1-2.

**Interfaces:**
- Verifies every acceptance criterion in `docs/superpowers/specs/2026-07-12-hover-edit-owned-panel-design.md`.

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all test files and tests PASS.

- [ ] **Step 2: Compile TypeScript**

```bash
npm run compile
```

Expected: exit 0.

- [ ] **Step 3: Build and verify artifacts**

```bash
npm run build
npm run verify:popup
```

Expected: Chrome MV3 build succeeds and popup verification prints `Release bundle JSX transform verified`.

- [ ] **Step 4: Inspect scope and cleanliness**

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git status --short --branch
```

Expected: only the planned launcher, controller, CSS, tests, and documentation are present; the feature worktree is clean.

- [ ] **Step 5: Review and finish the branch**

Use `superpowers:requesting-code-review`, evaluate findings with `superpowers:receiving-code-review`, then use `superpowers:finishing-a-development-branch`. After local integration, rebuild from `main` for manual QA.
