# X Hover-Card Context Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep X's Following and Followers links together, make hover-card Edit reliable, show compact saved metadata, and handle invalidated extension contexts without uncaught messaging errors.

**Architecture:** Mount the hover launcher as the final child of the semantic count-link container and make its Shadow DOM host a full-width flex item. Retain the lookup `AccountSummary` in the launcher, activate pointer Edit before X can remove the card, and route content-script messaging through a small lifecycle-aware sender that converts synchronous runtime throws to promise rejections.

**Tech Stack:** TypeScript 5.9, React 19, WXT 0.20, Chrome MV3, Vitest 4, Testing Library, Shadow DOM, CSS.

## Global Constraints

- Do not use generated X class names.
- Keep full-profile and toolbar-popup behavior unchanged.
- Hide empty saved metadata fields in the compact hover summary.
- Show only saved Display Name, Profession, Company, and Tags in the compact summary.
- Preserve keyboard activation for Edit.
- Use failing regression tests before every production change.
- Do not attempt to reinject an old content script after the extension runtime is reloaded.

---

### Task 1: Keep the Contexto host below both count links

**Files:**
- Modify: `src/x/hover-card-placement.ts`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `tests/hover-card-placement.test.ts`
- Modify: `tests/content-mount.test.tsx`
- Modify: `tests/contexto-surface-layout.test.ts`

**Interfaces:**
- Consumes: `resolveHoverCardInsertion(host: HTMLElement, handle: string): HoverCardInsertion`.
- Produces: for a valid shared count container, `{ parent: countsRow, before: null }` so the mount host is the container's final child.
- Preserves: existing profile-CTA and inner-container fallback results.

- [ ] **Step 1: Change the placement tests to require a final child inside the count container**

In `tests/hover-card-placement.test.ts`, replace the first two expected locations with:

```ts
it('places the launcher after both links inside their shared count container', () => {
  const card = buildCard('/amanda/followers');
  const counts = card.querySelector<HTMLElement>('[data-testid="counts"]')!;

  const location = resolveHoverCardInsertion(card, 'amanda');

  expect(location).toEqual({ parent: counts, before: null });
  expect(Array.from(counts.querySelectorAll('a')).map((anchor) => anchor.textContent)).toEqual([
    '1,724 Following',
    '3,149 Followers',
  ]);
});

it('recognizes X verified-follower links as the follower count', () => {
  const card = buildCard('/amanda/verified_followers');
  const counts = card.querySelector<HTMLElement>('[data-testid="counts"]')!;

  expect(resolveHoverCardInsertion(card, 'amanda')).toEqual({ parent: counts, before: null });
});
```

In `tests/content-mount.test.tsx`, replace the hover mount placement assertions with:

```ts
const counts = host.querySelector<HTMLElement>('[data-testid="counts"]')!;
expect(mountHost?.parentElement).toBe(counts);
expect(counts.lastElementChild).toBe(mountHost);
expect(Array.from(counts.querySelectorAll('a')).map((anchor) => anchor.textContent)).toEqual([
  '12 Following',
  '34 Followers',
]);
```

In `tests/contexto-surface-layout.test.ts`, add this host contract:

```ts
expect(host).toContain('flex:0 0 100%;');
expect(host).toContain('width:100%;');
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run tests/hover-card-placement.test.ts tests/content-mount.test.tsx tests/contexto-surface-layout.test.ts
```

Expected: FAIL because the resolver currently returns the count container's parent and the hover host lacks a flex-basis contract.

- [ ] **Step 3: Return the shared count container as the insertion parent**

In `src/x/hover-card-placement.ts`, change only the valid shared-row branch to:

```ts
if (following && followers) {
  const countsRow = nearestCommonAncestor(following, followers, container);
  if (countsRow && countsRow !== container && container.contains(countsRow)) {
    return { parent: countsRow, before: null };
  }
}
```

This retains the existing safe fallbacks when the nearest shared ancestor is the entire inner card.

In `src/ui/contexto-profile-surface.css`, replace the hover host rule with:

```css
:host([data-contexto-surface="hover-card"]) { display:block; flex:0 0 100%; width:100%; margin:8px 0; }
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/hover-card-placement.test.ts tests/content-mount.test.tsx tests/contexto-surface-layout.test.ts
```

Expected: all focused placement and layout tests PASS.

- [ ] **Step 5: Commit the placement fix**

```bash
git add src/x/hover-card-placement.ts src/ui/contexto-profile-surface.css tests/hover-card-placement.test.ts tests/content-mount.test.tsx tests/contexto-surface-layout.test.ts
git commit -m "fix: keep hover counts above contexto"
```

---

### Task 2: Make Edit survive hover dismissal and render saved metadata

**Files:**
- Modify: `src/ui/ContextoHoverLauncher.tsx`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `tests/contexto-hover-launcher.test.tsx`

**Interfaces:**
- Consumes: successful lookup response `{ ok: true; lookup: true; lookupAccount: AccountSummary | undefined }`.
- Produces: one `onEdit(profile, button)` call from pointer-down or accessible click.
- Renders: saved Display Name plus nonempty Profession, Company, and Tags.

- [ ] **Step 1: Add failing interaction and summary tests**

Update the imports in `tests/contexto-hover-launcher.test.tsx` to include `fireEvent`:

```ts
import { fireEvent, render, screen } from '@testing-library/react';
```

Replace the saved-state test and add pointer/keyboard regressions:

```ts
it('shows saved display name and populated profession, company, and tags', async () => {
  const saved = {
    id: 'account_1', platform: 'x' as const, handle: 'theo', normalizedHandle: 'theo',
    displayName: 'Theo Browne', profileUrl: 'https://x.com/theo',
    profession: 'Developer', company: { id: 'company_1', name: 'Ping Labs', normalizedName: 'ping labs', updatedAt: '2026-07-12' },
    tags: [
      { id: 'tag_1', name: 'Founder', normalizedName: 'founder', updatedAt: '2026-07-12' },
      { id: 'tag_2', name: 'Security', normalizedName: 'security', updatedAt: '2026-07-12' },
    ],
    folders: [],
  };
  renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved }));

  expect(await screen.findByText('Saved')).toBeVisible();
  expect(screen.getByText('Theo Browne')).toBeVisible();
  expect(screen.getByText('Developer · Ping Labs')).toBeVisible();
  expect(screen.getByText('Founder')).toBeVisible();
  expect(screen.getByText('Security')).toBeVisible();
});

it('omits empty optional metadata from a saved summary', async () => {
  const saved = {
    id: 'account_1', platform: 'x' as const, handle: 'theo', normalizedHandle: 'theo',
    displayName: 'Theo', profileUrl: 'https://x.com/theo', tags: [], folders: [],
  };
  renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved }));

  expect(await screen.findByText('Theo')).toBeVisible();
  expect(screen.queryByTestId('contexto-hover-organization')).not.toBeInTheDocument();
  expect(screen.queryByTestId('contexto-hover-tags')).not.toBeInTheDocument();
});

it('opens on pointer-down before X can remove the hover card and does not duplicate on click', async () => {
  const onEdit = renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: undefined }));
  const edit = await screen.findByRole('button', { name: 'Edit' });

  fireEvent.pointerDown(edit, { pointerType: 'mouse' });
  expect(onEdit).toHaveBeenCalledOnce();
  fireEvent.click(edit);
  expect(onEdit).toHaveBeenCalledOnce();
});

it('keeps click activation for keyboard users', async () => {
  const onEdit = renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: undefined }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  expect(onEdit).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the launcher tests and verify RED**

Run:

```bash
npx vitest run tests/contexto-hover-launcher.test.tsx
```

Expected: FAIL because the lookup account is discarded, no summary is rendered, and pointer-down does not call Edit.

- [ ] **Step 3: Retain AccountSummary and implement one-shot pointer activation**

In `src/ui/ContextoHoverLauncher.tsx`:

1. Import `AccountSummary` with `ProfileSnapshot`.
2. Add `const [account, setAccount] = useState<AccountSummary>();`.
3. Add `const pointerActivatedRef = useRef(false);`.
4. On lookup success, call `setAccount(response.lookupAccount)` before setting saved/unsaved state.
5. Add these helpers inside the component:

```ts
function openEditor() {
  if (buttonRef.current) onEdit(profile, buttonRef.current);
}

function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
  if (event.pointerType === 'mouse' || event.pointerType === 'pen' || event.pointerType === 'touch') {
    pointerActivatedRef.current = true;
    openEditor();
  }
}

function handleClick() {
  if (pointerActivatedRef.current) {
    pointerActivatedRef.current = false;
    return;
  }
  openEditor();
}
```

6. Replace the Edit button handler with `onPointerDown={handlePointerDown}` and `onClick={handleClick}`.
7. Render the saved summary after the header button when `account` exists:

```tsx
{account && <div className="contexto-hover-summary">
  <strong className="contexto-hover-name">{account.displayName}</strong>
  {(account.profession || account.company?.name) && <span data-testid="contexto-hover-organization">
    {[account.profession, account.company?.name].filter(Boolean).join(' · ')}
  </span>}
  {account.tags.length > 0 && <div className="contexto-hover-tags" data-testid="contexto-hover-tags">
    {account.tags.map((tag) => <span className="contexto-hover-tag" key={tag.id}>{tag.name}</span>)}
  </div>}
</div>}
```

Wrap the existing header content in a new `<div className="contexto-hover-header">` so the section can become a vertical layout without changing header alignment.

- [ ] **Step 4: Add compact summary styles**

In `src/ui/contexto-profile-surface.css`, change the launcher layout and add:

```css
.contexto-hover-launcher { --ctx-bg:#fff; --ctx-text:#0f1419; --ctx-muted:#536471; --ctx-border:#eff3f4; --ctx-accent:#5b3fd6; display:grid; box-sizing:border-box; gap:6px; width:100%; min-height:36px; border:1px solid var(--ctx-border); border-radius:14px; background:var(--ctx-bg); color:var(--ctx-text); padding:6px 8px 7px 10px; box-shadow:none; font-size:12px; }
.contexto-hover-header { display:flex; align-items:center; gap:8px; }
.contexto-hover-header > strong { margin-right:auto; color:var(--ctx-accent); }
.contexto-hover-launcher button { min-height:28px; padding:4px 10px; }
.contexto-hover-summary { display:grid; gap:3px; padding:0 2px 2px; color:var(--ctx-muted); }
.contexto-hover-name { color:var(--ctx-text); font-size:13px; }
.contexto-hover-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:2px; }
.contexto-hover-tag { border-radius:999px; padding:2px 6px; background:color-mix(in srgb,var(--ctx-accent) 14%,var(--ctx-bg)); color:var(--ctx-accent); font-weight:650; }
```

Remove the obsolete `.contexto-hover-launcher strong { ... }` rule because header-specific styling replaces it.

- [ ] **Step 5: Run the launcher tests and verify GREEN**

Run:

```bash
npx vitest run tests/contexto-hover-launcher.test.tsx tests/contexto-surface-layout.test.ts
```

Expected: all launcher and surface layout tests PASS.

- [ ] **Step 6: Commit the interaction and summary changes**

```bash
git add src/ui/ContextoHoverLauncher.tsx src/ui/contexto-profile-surface.css tests/contexto-hover-launcher.test.tsx
git commit -m "feat: show saved context in hover cards"
```

---

### Task 3: Guard content-script messaging against invalidated runtimes

**Files:**
- Create: `src/x/content-runtime-sender.ts`
- Create: `tests/content-runtime-sender.test.ts`
- Modify: `entrypoints/content.ts`

**Interfaces:**
- Produces: `createContentRuntimeSender(context, sendMessage): (message: ContextoRequest) => Promise<ContextoResponse>`.
- Context contract: `{ readonly isValid: boolean }`; reading the WXT context property triggers its existing invalidation lifecycle when the runtime ID is gone.
- Send contract: synchronous throws and asynchronous rejections are both exposed as rejected promises.

- [ ] **Step 1: Write failing sender tests**

Create `tests/content-runtime-sender.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createContentRuntimeSender } from '@/src/x/content-runtime-sender';

const request = { type: 'contexto:settings:get' } as const;

describe('createContentRuntimeSender', () => {
  it('sends through a valid content-script context', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, settings: { myXHandle: '', lastDashboardView: 'accounts' } });
    const send = createContentRuntimeSender({ isValid: true }, sendMessage);

    await expect(send(request)).resolves.toMatchObject({ ok: true });
    expect(sendMessage).toHaveBeenCalledWith(request);
  });

  it('rejects without messaging when the WXT context is invalid', async () => {
    const sendMessage = vi.fn();
    const send = createContentRuntimeSender({ isValid: false }, sendMessage);

    await expect(send(request)).rejects.toThrow('Extension context invalidated. Reload this X tab.');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('converts a synchronous runtime throw into a rejected promise', async () => {
    const sendMessage = vi.fn(() => { throw new Error('Extension context invalidated.'); });
    const send = createContentRuntimeSender({ isValid: true }, sendMessage);

    await expect(send(request)).rejects.toThrow('Extension context invalidated.');
  });
});
```

- [ ] **Step 2: Run the sender test and verify RED**

Run:

```bash
npx vitest run tests/content-runtime-sender.test.ts
```

Expected: FAIL because `src/x/content-runtime-sender.ts` does not exist.

- [ ] **Step 3: Implement the lifecycle-aware sender**

Create `src/x/content-runtime-sender.ts`:

```ts
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';

export interface ContentRuntimeContext {
  readonly isValid: boolean;
}

export type RuntimeSendMessage = (message: ContextoRequest) => ContextoResponse | Promise<ContextoResponse>;

export function createContentRuntimeSender(
  context: ContentRuntimeContext,
  sendMessage: RuntimeSendMessage,
): (message: ContextoRequest) => Promise<ContextoResponse> {
  return (message) => {
    if (!context.isValid) {
      return Promise.reject(new Error('Extension context invalidated. Reload this X tab.'));
    }
    try {
      return Promise.resolve(sendMessage(message));
    } catch (error) {
      return Promise.reject(error);
    }
  };
}
```

In `entrypoints/content.ts`, import `createContentRuntimeSender`, remove the module-level `send`, and create it at the start of `main(ctx)`:

```ts
const send = createContentRuntimeSender(
  ctx,
  (message) => browser.runtime.sendMessage(message),
);
```

Keep the existing `ctx.onInvalidated` cleanup unchanged. Reading `ctx.isValid` before every message activates that cleanup when WXT detects the stale runtime.

- [ ] **Step 4: Run focused tests and compile**

Run:

```bash
npx vitest run tests/content-runtime-sender.test.ts tests/contexto-hover-launcher.test.tsx tests/page-editor-controller-real.test.tsx
npm run compile
```

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the runtime lifecycle fix**

```bash
git add src/x/content-runtime-sender.ts tests/content-runtime-sender.test.ts entrypoints/content.ts
git commit -m "fix: handle invalidated content runtimes"
```

---

### Task 4: Verify the complete extension and integration diff

**Files:**
- Review only: all files changed by Tasks 1-3.

**Interfaces:**
- Verifies all acceptance criteria from `docs/superpowers/specs/2026-07-12-hover-card-context-summary-design.md`.
- Produces no additional behavior unless verification exposes a regression, in which case return to the relevant task's RED-GREEN cycle.

- [ ] **Step 1: Run the full unit suite**

```bash
npm test
```

Expected: all test files and tests PASS with zero failures.

- [ ] **Step 2: Run TypeScript compilation**

```bash
npm run compile
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 3: Build the Chrome MV3 extension**

```bash
npm run build
```

Expected: exit 0 and production output under `.output/chrome-mv3`.

- [ ] **Step 4: Verify the popup artifact**

```bash
npm run verify:popup
```

Expected: exit 0 with `Release bundle JSX transform verified`.

- [ ] **Step 5: Inspect the final diff and worktree state**

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git status --short --branch
```

Expected: no whitespace errors, only the planned hover placement/summary/runtime files plus design and plan documentation, and a clean feature worktree.

- [ ] **Step 6: Request code review and address only verified findings**

Use `superpowers:requesting-code-review` against `main...HEAD`. If feedback is actionable, use `superpowers:receiving-code-review`, add a failing test that demonstrates the issue, implement the smallest fix, and repeat the full verification commands.

- [ ] **Step 7: Finish the feature branch**

Use `superpowers:finishing-a-development-branch`, then integrate according to the user's selected completion option.
