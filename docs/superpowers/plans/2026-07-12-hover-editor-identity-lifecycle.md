# X Hover Editor Identity and Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct hover-card display-name extraction and make the persistent hover editor close only after successful Save or Cancel.

**Architecture:** Scope display-name extraction to the exact profile identity link and choose the nearest safe text before the matching handle, with a contained `UserName` fallback. Remove all user-interaction close paths from the page editor controller, and let `ContextoProfileSurface` invoke its optional close callback only after successful Save or Cancel.

**Tech Stack:** TypeScript 5.9, React 19, WXT 0.20, Vitest 4, Testing Library, Shadow DOM.

## Global Constraints

- Only successful Save or Cancel may close the persistent hover editor.
- Backdrop clicks, outside clicks, Escape, header close controls, field clicks, and failed saves keep it open.
- Inline profile-page Save continues to leave its form visible because it has no close callback.
- Display-name extraction must not select action controls such as `Following`.
- Keep fixed-panel placement, modal fallback, saved metadata, toolbar popup, and extension lifecycle behavior unchanged.
- Use failing regression tests before production changes.

---

### Task 1: Extract the actual X display name

**Files:**
- Modify: `tests/x-profile-extraction.test.ts`
- Modify: `src/x/extract-profile.ts`

**Interfaces:**
- Consumes: `extractHoverCardProfile(surface: HTMLElement): ProfileSnapshot | null` and `extractFullProfile(...)`.
- Produces: the hovered account's display name, never the text of an X action control.

- [ ] **Step 1: Add a Following-first hover fixture regression**

Append this test to `tests/x-profile-extraction.test.ts`:

```ts
it('extracts the identity name when an action button precedes it in UserName', () => {
  document.body.innerHTML = `
    <div role="dialog" data-testid="HoverCard">
      <button><span>Following</span></button>
      <div data-testid="UserName">
        <button><span>Following</span></button>
        <a href="/pauline"><span>Pauline P. Narvas</span><span>@pauline</span></a>
      </div>
      <a href="/pauline"><img src="https://pbs.twimg.com/profile_images/pauline.jpg"></a>
      <div data-testid="UserDescription">Developer</div>
    </div>`;
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;

  expect(extractHoverCardProfile(dialog)).toMatchObject({
    handle: 'pauline',
    displayName: 'Pauline P. Narvas',
  });
});
```

- [ ] **Step 2: Run the extraction tests and verify RED**

```bash
npx vitest run tests/x-profile-extraction.test.ts --reporter=verbose
```

Expected: the new test FAILS because the current implementation returns `Following` from the broad `UserName` span list.

- [ ] **Step 3: Implement scoped nearest-name extraction**

In `src/x/extract-profile.ts`, add these helpers before `readDisplayName`:

```ts
function anchorPath(anchor: HTMLAnchorElement): string | null {
  try {
    return new URL(anchor.getAttribute('href') ?? anchor.href, document.baseURI).pathname.replace(/\/$/, '').toLowerCase();
  } catch {
    return null;
  }
}

function readNameBeforeHandle(scope: ParentNode, handle: string): string | undefined {
  const spans = Array.from(scope.querySelectorAll('span'));
  const handleIndex = spans.findIndex((span) => compactText(span.textContent)?.toLowerCase() === `@${handle.toLowerCase()}`);
  if (handleIndex < 0) return undefined;
  for (let index = handleIndex - 1; index >= 0; index -= 1) {
    const value = compactText(spans[index].textContent);
    if (!value || value.startsWith('@') || spans[index].closest('button,[role="button"]')) continue;
    return value;
  }
  return undefined;
}
```

Replace `readDisplayName` with:

```ts
function readDisplayName(surface: HTMLElement, handle: string): string | undefined {
  const profilePath = `/${handle.replace(/^@/, '').toLowerCase()}`;
  const identityLink = Array.from(surface.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .find((anchor) => anchorPath(anchor) === profilePath && readNameBeforeHandle(anchor, handle));
  return readNameBeforeHandle(identityLink ?? surface.querySelector('[data-testid="UserName"]') ?? surface, handle);
}
```

The exact identity link is preferred; the `UserName`/surface fallback still chooses only text immediately before the matching handle and excludes controls.

- [ ] **Step 4: Run the extraction tests and verify GREEN**

```bash
npx vitest run tests/x-profile-extraction.test.ts --reporter=verbose
```

Expected: all extraction tests PASS, including existing full-profile behavior.

- [ ] **Step 5: Commit the extraction fix**

```bash
git add src/x/extract-profile.ts tests/x-profile-extraction.test.ts
git commit -m "fix: extract hover identity name"
```

---

### Task 2: Enforce Save/Cancel-only persistent editor closing

**Files:**
- Modify: `src/x/page-editor-controller.tsx`
- Modify: `src/ui/ContextoProfileSurface.tsx`
- Modify: `tests/page-editor-controller.test.tsx`
- Modify: `tests/contexto-profile-surface.test.tsx`

**Interfaces:**
- Consumes: optional `onRequestClose?: () => void` from the persistent editor controller.
- Produces: callback invocation only after successful Save or Cancel.
- Preserves: inline surfaces without a callback remain open after successful Save.

- [ ] **Step 1: Add failing lifecycle tests**

In `tests/page-editor-controller.test.tsx`, add this test using the existing modal `installMatchMedia(false)` setup and mocked editor button:

```ts
it('keeps the editor open for internal and backdrop clicks and Escape', () => {
  installMatchMedia(false);
  const button = document.createElement('button');
  document.body.append(button);
  const controller = createPageEditorController({ root: document.body, send: vi.fn(), drafts: new AccountDraftStore(), css: '' });
  controller.open(profile, button);
  const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
  const editorButton = host.shadowRoot?.querySelector('[data-testid="editor"]')!;

  editorButton.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  host.shadowRoot?.querySelector('button')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  expect(host.isConnected).toBe(true);
  controller.disconnect();
});
```

In `tests/contexto-profile-surface.test.tsx`, add callback assertions:

```tsx
it('closes only after a successful persistent save or explicit cancel', async () => {
  const onRequestClose = vi.fn();
  const send = vi.fn()
    .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
    .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [] } })
    .mockResolvedValueOnce({ ok: true, account: { id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo', tags: [], folders: [] } });
  render(<ContextoProfileSurface profile={profile} kind="hover-card" send={send} drafts={new AccountDraftStore()} placement="modal" onRequestClose={onRequestClose} />);

  expect(await screen.findByRole('dialog')).toBeVisible();
  expect(screen.queryByLabelText('Close Contexto editor')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));
  await waitFor(() => expect(onRequestClose).toHaveBeenCalledOnce());
});

it('keeps the persistent editor open after a failed save and closes on cancel', async () => {
  const onRequestClose = vi.fn();
  const send = vi.fn()
    .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
    .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [] } })
    .mockResolvedValueOnce({ ok: false, error: 'Save failed' });
  render(<ContextoProfileSurface profile={profile} kind="hover-card" send={send} drafts={new AccountDraftStore()} placement="modal" onRequestClose={onRequestClose} />);

  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed');
  expect(onRequestClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onRequestClose).toHaveBeenCalledOnce();
});
```

Keep the existing inline Save test and assert its form remains visible after saving.

- [ ] **Step 2: Run lifecycle tests and verify RED**

```bash
npx vitest run tests/page-editor-controller.test.tsx tests/contexto-profile-surface.test.tsx --reporter=verbose
```

Expected: failures show internal/backdrop/Escape interactions closing, the header close control present, and Save not invoking the persistent close callback.

- [ ] **Step 3: Remove controller user-dismissal paths**

In `src/x/page-editor-controller.tsx`:

1. Delete the `host.addEventListener('click', ...)` registration in `ensureHost`.
2. Delete the Escape branch in `handleModalKeydown`; leave Tab focus trapping unchanged.

- [ ] **Step 4: Close the persistent surface only after successful Save or Cancel**

In `src/ui/ContextoProfileSurface.tsx`:

1. Remove the conditional header close button:

```tsx
{onRequestClose && <button type="button" aria-label="Close Contexto editor" onClick={onRequestClose}>×</button>}
```

2. In `saveContext`, after the successful response updates `account`, clears the draft, sets the draft, and sets success, invoke the optional callback:

```ts
onRequestClose?.();
return;
```

3. Leave the existing `cancelEditing` callback invocation intact.

- [ ] **Step 5: Run lifecycle tests and verify GREEN**

```bash
npx vitest run tests/page-editor-controller.test.tsx tests/contexto-profile-surface.test.tsx --reporter=verbose
```

Expected: all controller and surface tests PASS; inline Save remains visible.

- [ ] **Step 6: Commit the lifecycle fix**

```bash
git add src/x/page-editor-controller.tsx src/ui/ContextoProfileSurface.tsx tests/page-editor-controller.test.tsx tests/contexto-profile-surface.test.tsx
git commit -m "fix: keep hover editor open until save or cancel"
```

---

### Task 3: Verify and finish

**Files:**
- Review: all files changed by Tasks 1-2.

- [ ] **Step 1: Run the full suite and compile**

```bash
npm test
npm run compile
```

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 2: Build and verify artifacts**

```bash
npm run build
npm run verify:popup
```

Expected: production Chrome MV3 build succeeds and popup verification prints `Release bundle JSX transform verified`.

- [ ] **Step 3: Inspect, review, and finish**

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git status --short --branch
```

Use the code-review and branch-finishing workflows, then rebuild from merged `main` for manual QA.
