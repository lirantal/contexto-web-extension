# X Hover-Card In-Flow Contexto Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place the compact Contexto launcher directly after X's Following/Followers row so it neither overlaps X controls nor leaves the hover card's interactive content subtree.

**Architecture:** A small semantic placement resolver locates the shared counts row from profile-relative links and returns a DOM insertion location, with an in-flow inner-card fallback. `mountContextoSurface` uses that location for hover cards while preserving the existing full-profile and persistent editor flows; CSS changes the Shadow DOM host from an absolute overlay to a full-width flow row.

**Tech Stack:** TypeScript, React 19, Shadow DOM, WXT, Vitest, Testing Library, jsdom.

## Global Constraints

- Do not use X's generated class names.
- Do not patch X hover-dismissal timers or dispatch synthetic hover events.
- Never fall back to absolute positioning.
- Keep toolbar popup, full-profile editor, and persistent right-rail/modal editor behavior unchanged.
- Preserve the existing `Loading…`, `Saved`, `Not saved`, retry, and **Edit** launcher behavior.

---

### Task 1: Semantic Hover-Card Placement Resolver

**Files:**
- Create: `src/x/hover-card-placement.ts`
- Create: `tests/hover-card-placement.test.ts`

**Interfaces:**
- Consumes: a hover-card `HTMLElement` and normalized profile handle string.
- Produces: `resolveHoverCardInsertion(host: HTMLElement, handle: string): { parent: HTMLElement; before: ChildNode | null }`.

- [ ] **Step 1: Write failing resolver tests**

Create fixtures with an outer `[data-testid="HoverCard"]`, an inner content element, username content, Following/Followers links, a mutual-follow row, and a profile CTA. Assert that:

```ts
const location = resolveHoverCardInsertion(card, 'amanda');
expect(location.parent).toBe(countsRow.parentElement);
expect(location.before).toBe(countsRow.nextSibling);
expect(location.parent).not.toBe(card);
```

Use a second fixture with `/amanda/verified_followers` and assert the same location. Use a third fixture without count links and assert the returned parent is the inner card container, the insertion is before `<a role="button" href="/amanda">View Profile</a>`, and neither location uses an element outside the hover card.

- [ ] **Step 2: Run the resolver tests to verify RED**

Run: `npm test -- --run tests/hover-card-placement.test.ts`

Expected: FAIL because `src/x/hover-card-placement.ts` does not exist.

- [ ] **Step 3: Implement the minimal resolver**

Implement these exact public types and helpers:

```ts
export interface HoverCardInsertion {
  parent: HTMLElement;
  before: ChildNode | null;
}

export function resolveHoverCardInsertion(host: HTMLElement, handle: string): HoverCardInsertion;
```

Normalize anchor paths through `new URL(anchor.href, document.baseURI).pathname`, ignoring malformed URLs. Locate anchors whose paths end in `/following` and either `/followers` or `/verified_followers`. Find their nearest common ancestor below `host`; when it has a parent inside the hover card, return that parent and the common row's `nextSibling`.

For fallback, find the top-level child below `host` that contains `[data-testid="UserName"]`; use it as the inner card container. Within it, find `a[role="button"]` whose normalized pathname equals `/${handle}`. Return the CTA's parent and the CTA as `before`; if there is no matching CTA, return the inner container and `null`. If the expected username wrapper is absent, use `host` itself as the final in-flow fallback.

- [ ] **Step 4: Run resolver tests to verify GREEN**

Run: `npm test -- --run tests/hover-card-placement.test.ts`

Expected: PASS for standard followers, verified followers, and fallback fixtures.

- [ ] **Step 5: Commit the resolver**

```bash
git add src/x/hover-card-placement.ts tests/hover-card-placement.test.ts
git commit -m "feat: resolve in-flow hover launcher placement"
```

---

### Task 2: Mount the Launcher In Flow

**Files:**
- Modify: `src/x/mount-contexto-surface.tsx`
- Modify: `tests/content-mount.test.tsx`

**Interfaces:**
- Consumes: `resolveHoverCardInsertion(host, profile.handle)` from Task 1.
- Produces: hover-card mounting at the returned `{ parent, before }`, with the existing `() => void` cleanup contract unchanged.

- [ ] **Step 1: Write failing mount and cleanup tests**

Replace the flat hover host fixture with a representative nested card:

```tsx
host.innerHTML = `
  <div data-testid="inner-card">
    <div data-testid="UserName"><span>Theo</span><span>@theo</span></div>
    <div data-testid="counts">
      <a href="/theo/following">12 Following</a>
      <a href="/theo/followers">34 Followers</a>
    </div>
    <a role="button" href="/theo">View Profile</a>
  </div>`;
```

After mounting, assert the Contexto host's `previousElementSibling` is `[data-testid="counts"]`, its `nextElementSibling` is the CTA, and it is not a direct child of the outer hover root. Set an existing `host.style.position = 'fixed'`, clean up, and assert the value is still `fixed`, proving Contexto no longer mutates X-owned positioning.

Keep the existing assertions that hover cards render only `ContextoHoverLauncher`, full profiles render only `ContextoProfileSurface`, theme data is set, and cleanup removes the mount host.

- [ ] **Step 2: Run mount tests to verify RED**

Run: `npm test -- --run tests/content-mount.test.tsx`

Expected: FAIL because the Contexto host is appended to the outer card and the current code mutates host positioning.

- [ ] **Step 3: Use semantic insertion for hover cards**

Import `resolveHoverCardInsertion`. Remove `previousHostPosition`, `hostPosition`, `positionHoverHost`, the `surface.host.style.position = 'relative'` mutation, and its cleanup restoration.

Insert using:

```ts
if (surface.kind === 'hover-card') {
  const { parent, before } = resolveHoverCardInsertion(surface.host, surface.profile.handle);
  parent.insertBefore(mountHost, before);
} else {
  surface.host.append(mountHost);
}
```

Do not change React rendering, theme detection, editor callbacks, Shadow DOM creation, or cleanup beyond removing position restoration.

- [ ] **Step 4: Run mount and observer tests to verify GREEN**

Run: `npm test -- --run tests/content-mount.test.tsx tests/x-surface-observer.test.ts`

Expected: PASS with the launcher inside the inner content stack and observer cleanup unchanged.

- [ ] **Step 5: Commit in-flow mounting**

```bash
git add src/x/mount-contexto-surface.tsx tests/content-mount.test.tsx
git commit -m "fix: mount hover launcher inside X content"
```

---

### Task 3: Replace Overlay Styling and Verify the Extension

**Files:**
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `tests/contexto-surface-layout.test.ts`

**Interfaces:**
- Consumes: the in-flow hover Shadow DOM host mounted by Task 2.
- Produces: a compact full-width launcher row with no absolute positioning, offsets, or overlay z-index.

- [ ] **Step 1: Write the failing CSS contract test**

Replace the overlay assertion with:

```ts
it('renders the hover launcher as a full-width in-flow row', () => {
  const host = ruleBody(':host([data-contexto-surface="hover-card"])');
  expect(host).toContain('display:block;');
  expect(host).toContain('margin:8px 0;');
  expect(host).not.toContain('position:absolute;');
  expect(host).not.toContain('bottom:');
  expect(host).not.toContain('right:');
  expect(host).not.toContain('z-index:');

  const launcher = ruleBody('.contexto-hover-launcher');
  expect(launcher).toContain('width:100%;');
});
```

- [ ] **Step 2: Run the CSS contract test to verify RED**

Run: `npm test -- --run tests/contexto-surface-layout.test.ts`

Expected: FAIL because the current host rule is absolute and the launcher does not declare full width.

- [ ] **Step 3: Implement the in-flow styles**

Change the host and launcher rules to include:

```css
:host([data-contexto-surface="hover-card"]) { display:block; margin:8px 0; }
.contexto-hover-launcher { width:100%; box-shadow:none; }
```

Retain the existing flex alignment, rounded border, padding, theme variables, status spacing, focus styles, and minimum button height. Remove only the overlay-specific position, offsets, z-index, and elevated shadow.

- [ ] **Step 4: Run focused interaction and layout tests**

Run: `npm test -- --run tests/contexto-surface-layout.test.ts tests/contexto-hover-launcher.test.tsx tests/content-mount.test.tsx tests/hover-card-placement.test.ts tests/page-editor-controller.test.tsx`

Expected: PASS with launcher lookup/Edit behavior and persistent editor behavior unchanged.

- [ ] **Step 5: Run complete verification**

Run, one command at a time:

```bash
npm test
npm run compile
npm run build
npm run verify:popup
```

Expected: all tests pass, TypeScript exits 0, the Chrome MV3 build exits 0, and popup verification prints `Popup bundle React binding verified`.

- [ ] **Step 6: Commit styling and regression coverage**

```bash
git add src/ui/contexto-profile-surface.css tests/contexto-surface-layout.test.ts
git commit -m "fix: render hover launcher in normal flow"
```

- [ ] **Step 7: Manual QA handoff**

Report the unpacked extension output at `.output/chrome-mv3` and ask the user to reload it, hover an account, move the pointer across the Contexto row, and click **Edit**. The expected result is no overlap, no dismissal while crossing onto Contexto, and the existing persistent editor opening successfully.
