# X Integration Learnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the X hover-editor extraction and lifecycle lessons discoverable as canonical documentation and enforce the observed identity variant through a reusable regression fixture.

**Architecture:** Keep `AGENTS.md` as a small routing layer, put current product behavior in feature documentation, put DOM assumptions in architecture documentation, and put verification policy in testing/development documentation. Preserve dated `docs/superpowers/` files as decision history rather than current behavior sources. The fixture migration changes test data organization only; production behavior remains unchanged.

**Tech Stack:** Markdown, TypeScript, Vitest, JSDOM, Node.js filesystem APIs, WXT.

## Global Constraints

- Do not change production behavior.
- Do not scaffold unrelated contribution or release-process documentation.
- Current feature and architecture documents are canonical; `docs/superpowers/` is historical decision and execution context.
- X page DOM is untrusted, versionless input; every newly observed identity shape requires a minimal fixture and regression assertion.
- The right-rail/modal editor closes only after successful Save or explicit Cancel; the full-profile inline editor remains visible.
- Keep root agent guidance concise and link to sources of truth instead of duplicating them.

---

### Task 1: Add documentation routing and canonical X integration contracts

**Files:**
- Create: `AGENTS.md`
- Create: `docs/README.md`
- Create: `docs/testing.md`
- Modify: `README.md`
- Modify: `docs/features/profile-metadata.md`
- Modify: `docs/architecture/platform-adapters.md`
- Modify: `docs/development/browser-workflow.md`

**Interfaces:**
- Consumes: The approved behavior in `docs/superpowers/specs/2026-07-12-x-integration-learnings-design.md`.
- Produces: Stable entry points and canonical contracts used by future humans and coding agents.

- [ ] **Step 1: Create concise root agent routing**

Create `AGENTS.md` with this structure and content:

```markdown
# AGENTS.md

Guidance for AI coding agents working in this repository.

## Start Here

Before making changes, read:

- `README.md` for product scope, setup, build, and manual installation.
- `docs/README.md` for the project documentation index.
- `docs/architecture/overview.md` for system structure and data flow.
- `docs/architecture/platform-adapters.md` before changing X parsing or DOM extraction.
- `docs/features/profile-metadata.md` before changing hover, profile, or editor behavior.
- `docs/development/browser-workflow.md` and `docs/testing.md` for verification requirements.

Treat those files as the source of truth. Dated files under `docs/superpowers/` preserve design and implementation history; they do not override current feature or architecture documentation.

## X Integration Guardrails

- Treat X DOM as transient, untrusted, and versionless. Scope identity extraction to the normalized handle and exact profile path; never infer identity from the first matching text node.
- Keep interactive Contexto editors outside X-owned hover-card subtrees. The hover card contains only the compact summary and Edit launcher.
- Preserve the documented close contract: successful Save and explicit Cancel close right-rail/modal editors; internal interaction, backdrop clicks, Escape, pointer movement, and hover dismissal do not.
- Add or update a minimal fixture and regression test for every newly observed X DOM shape.

## Documentation

- Keep documentation synchronized when changing behavior, architecture, workflows, selectors, or operational assumptions.
- Prefer links to canonical sources over duplicated instructions.
- Link new durable documentation from `docs/README.md`.
```

- [ ] **Step 2: Add the documentation index**

Create `docs/README.md` with sections for Architecture, Development and testing, Features, and Decision history. Link every existing document under `docs/architecture/`, `docs/development/`, and `docs/features/`. State explicitly:

```markdown
Documents under `docs/superpowers/specs/` and `docs/superpowers/plans/` record design and execution history. Current behavior and invariants belong in the architecture, development, testing, and feature documents linked above.
```

- [ ] **Step 3: Add canonical testing guidance**

Create `docs/testing.md` with these requirements:

```markdown
# Testing

## Automated checks

Run `npm run compile`, `npm test`, `npm run build`, and `npm run verify:popup` before handing off a release build.

## X DOM fixtures

Store observed X markup variants under `tests/fixtures/x/`. Fixtures are minimal structural examples, named for the DOM variant rather than a real account. Every fixture must have an assertion that identifies the protected behavior, including negative assertions such as action labels not becoming display names.

## Interaction lifecycle tests

Use controller tests with composed Shadow DOM events for mounting, focus, and dismissal behavior. Explicitly assert interactions that must not close the editor. Use surface tests for Save, failed Save, Cancel, draft retention, and the inline-versus-modal lifecycle distinction.

## Manual browser checks

Synthetic tests cannot reproduce every X or browser lifecycle. Run the matrix in `docs/development/browser-workflow.md` after changing content-script mounting, X selectors, popup layout, Shadow DOM behavior, or extension lifecycle handling.
```

- [ ] **Step 4: Correct the profile-metadata lifecycle contract**

Update `docs/features/profile-metadata.md` so it says:

```markdown
The right-rail/modal editor stays mounted when X dismisses the originating hover card. Internal clicks, backdrop clicks, Escape, and pointer movement do not close it. A successful Save or explicit Cancel closes this owned editor; a failed Save keeps it open with the draft intact. Navigation, extension reload, and content-script teardown remain system lifecycle events.

The full-profile editor is inline and remains visible after Save or Cancel. Save repopulates it from the authoritative account, while Cancel restores persisted values.
```

Remove the contradictory claim that every editor remains visible after saving.

- [ ] **Step 5: Document third-party DOM extraction invariants**

Add an `X DOM Extraction Invariants` section to `docs/architecture/platform-adapters.md` covering:

```markdown
- Scope extraction to the current surface rather than the whole page.
- Resolve the normalized handle first and prefer an identity link whose exact path is `/<handle>`.
- Read the display name from the matching identity subtree before the matching `@handle`.
- Exclude text inside buttons and elements with `role="button"` so action copy such as `Following` cannot become metadata.
- Use deliberate fallbacks and return no profile when identity evidence is inconsistent.
- Add a minimal fixture and regression test whenever X introduces a new observed DOM shape.
```

Explain that selectors are evidence, not a stable API.

- [ ] **Step 6: Add the browser QA matrix**

Extend `docs/development/browser-workflow.md` with a `Manual QA Matrix` table containing these scenarios and expectations:

| Scenario | Expected result |
| --- | --- |
| Unknown and saved accounts on feed hover cards | Correct handle/display name; compact summary and Edit launcher do not overlap X controls. |
| Wide and narrow viewports | Editor opens in the owned right rail or modal fallback without shifting the hover card. |
| Hover dismissal and editor interaction | Moving away from the X card, typing, clicking fields/backdrop, and pressing Escape do not close the editor. |
| Save, failed Save, and Cancel | Successful Save and Cancel close the owned editor; failed Save stays open with the draft. |
| Full profile page | Inline editor remains visible and shows authoritative saved values. |
| Toolbar popup | Popup content and search controls render at the expected extension width. |
| Extension reload/navigation | Reloaded content scripts remount cleanly without relying on invalidated extension contexts. |

Require running relevant rows in both Chrome and Vivaldi when the change touches browser integration.

- [ ] **Step 7: Route README readers to the docs index**

Add `docs/README.md` as the first link in the README Documentation section while preserving the existing direct links.

- [ ] **Step 8: Validate documentation paths and commit**

Run:

```bash
test -f AGENTS.md
test -f docs/README.md
test -f docs/testing.md
test -f docs/features/profile-metadata.md
test -f docs/architecture/platform-adapters.md
test -f docs/development/browser-workflow.md
rg -n "docs/README.md|profile-metadata.md|platform-adapters.md|browser-workflow.md|docs/testing.md" AGENTS.md README.md docs/README.md
git diff --check
```

Expected: every `test` exits 0, routing links are present, and `git diff --check` prints nothing.

Commit:

```bash
git add AGENTS.md README.md docs/README.md docs/testing.md docs/features/profile-metadata.md docs/architecture/platform-adapters.md docs/development/browser-workflow.md
git commit -m "docs: record X integration invariants"
```

### Task 2: Move the observed identity shape into a reusable fixture

**Files:**
- Create: `tests/fixtures/x/hover-card-action-before-identity.html`
- Modify: `tests/x-profile-extraction.test.ts`

**Interfaces:**
- Consumes: `extractHoverCardProfile(surface: HTMLElement): ProfileSnapshot | null` and Node.js `readFileSync`/`resolve`, following existing test conventions.
- Produces: A reusable minimal fixture for the action-before-identity X hover-card shape.

- [ ] **Step 1: Record the existing focused-test baseline**

Run:

```bash
npx vitest run tests/x-profile-extraction.test.ts --reporter=verbose
```

Expected: 6 tests pass before the fixture-only refactor.

- [ ] **Step 2: Create the minimal HTML fixture**

Create `tests/fixtures/x/hover-card-action-before-identity.html`:

```html
<div role="dialog" data-testid="HoverCard">
  <button><span>Following</span></button>
  <div data-testid="UserName">
    <button><span>Following</span></button>
    <a href="/exampledev"><span>Example Developer</span><span>@exampledev</span></a>
  </div>
  <a href="/exampledev"><img src="https://pbs.twimg.com/profile_images/example.jpg"></a>
  <div data-testid="UserDescription">Developer</div>
</div>
```

- [ ] **Step 3: Load the fixture in the regression test**

At the top of `tests/x-profile-extraction.test.ts`, add:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const hoverCardActionBeforeIdentity = readFileSync(
  resolve('tests/fixtures/x/hover-card-action-before-identity.html'),
  'utf8',
);
```

Replace the inline HTML in `extracts the identity name when an action button precedes it in UserName` with:

```ts
document.body.innerHTML = hoverCardActionBeforeIdentity;
const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;

expect(extractHoverCardProfile(dialog)).toMatchObject({
  handle: 'exampledev',
  displayName: 'Example Developer',
});
```

- [ ] **Step 4: Verify the fixture refactor**

Run:

```bash
npx vitest run tests/x-profile-extraction.test.ts --reporter=verbose
npm run compile
```

Expected: 6 focused tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the fixture migration**

```bash
git add tests/fixtures/x/hover-card-action-before-identity.html tests/x-profile-extraction.test.ts
git commit -m "test: preserve observed X hover identity shape"
```

### Task 3: Final repository verification

**Files:**
- Verify only: all files committed by Tasks 1 and 2.

**Interfaces:**
- Consumes: Canonical docs and fixture-backed tests from Tasks 1 and 2.
- Produces: A clean, verified repository state ready for handoff.

- [ ] **Step 1: Run complete verification**

```bash
npm test -- --run
npm run compile
npm run build
npm run verify:popup
git diff --check HEAD~2..HEAD
git status --short
```

Expected: all tests pass, compilation/build/popup verification exit 0, diff check prints nothing, and status is clean.

- [ ] **Step 2: Review the committed documentation contract**

Confirm all of the following appear in canonical documentation:

- X DOM is untrusted and identity extraction is handle/path scoped.
- Action controls are excluded from identity metadata.
- X owns the transient hover card and Contexto owns the interactive editor.
- Only successful Save and explicit Cancel close the right-rail/modal editor.
- Failed Save, internal clicks, backdrop clicks, Escape, pointer movement, and hover dismissal keep it open.
- The full-profile inline editor remains visible.
- The Chrome/Vivaldi QA matrix covers popup rendering and extension reloads.

- [ ] **Step 3: Report final commits and verification evidence**

Report the design commit, plan commit, documentation commit, fixture commit, exact test count, build result, and the clean repository status.
