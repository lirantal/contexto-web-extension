# X Integration Learnings Design

## Goal

Turn the hover-editor QA lessons into durable, discoverable project guidance and executable regression coverage so future changes begin with the correct X DOM, ownership, and lifecycle assumptions.

## Scope

This is a focused documentation and test-maintenance change. It will:

- Add lightweight root guidance for coding agents.
- Add a documentation index.
- Correct and strengthen the canonical profile-metadata behavior contract.
- Document invariants for extracting identity from unstable third-party DOM.
- Add a repeatable Chromium browser QA matrix.
- Move the known hover-card identity variant into a reusable X fixture.

It will not introduce a broad contribution or release-process scaffold, change production behavior, or reorganize unrelated documentation.

## Canonical Sources

### `AGENTS.md`

The root agent guide will be a routing document, not a duplicate handbook. It will direct agents to the README, documentation index, architecture guides, profile-metadata contract, browser workflow, and testing guidance. It will state that behavior, architecture, workflow, and testing changes must update their canonical documentation and tests.

### `docs/README.md`

The documentation index will group existing architecture, development, feature, and historical design/plan documents. It will explain that `docs/superpowers/` records decision history while feature and architecture documents define current behavior.

### `docs/features/profile-metadata.md`

The feature contract will distinguish surface lifecycles:

- X owns the transient hover card; it contains only the compact Contexto summary and Edit launcher.
- Contexto owns the interactive right-rail/modal editor outside the hover-card subtree.
- Successful Save and explicit Cancel are the only user actions that close the right-rail/modal editor.
- Internal clicks, backdrop clicks, Escape, pointer movement, and X dismissing its hover card do not close the editor.
- Failed saves retain the editor and draft.
- The full-profile inline editor remains visible after saving or cancelling and restores authoritative values as appropriate.
- Navigation, extension reload, and content-script teardown remain system lifecycle events rather than user close actions.

### `docs/architecture/platform-adapters.md`

The X adapter guidance will treat page DOM as untrusted, versionless input. Identity extraction will be scoped by the normalized handle and exact profile path, read fields only from the matching identity subtree, exclude action controls, and use deliberate fallbacks. New observed DOM variants require a regression fixture and test.

### `docs/development/browser-workflow.md` and `docs/testing.md`

The browser workflow will contain a concise manual QA matrix covering Chrome/Vivaldi, wide/narrow layouts, hover/full-profile surfaces, saved/unsaved accounts, popup rendering, Save/Cancel/failure behavior, hover dismissal, and extension reloads. Testing guidance will explain the division between unit DOM fixtures, real React/Shadow DOM controller tests, and manual browser checks.

## Test Fixture Strategy

Create `tests/fixtures/x/hover-card-action-before-identity.html` for the observed X shape where a `Following` action precedes the identity block. `tests/x-profile-extraction.test.ts` will load this fixture and continue asserting that the display name is the account name, never the action label.

Fixtures must be minimal: include only the DOM structure needed to express an observed contract or regression. File names should describe the DOM variant rather than a real person.

## Validation

- Verify every Markdown link resolves to a repository path.
- Run the focused X profile-extraction test after fixture migration.
- Run the full test suite and TypeScript compilation.
- Confirm `git diff --check` passes.

## Success Criteria

A future contributor or coding agent can discover the interaction and extraction invariants from `AGENTS.md` and `docs/README.md`, understand the current behavior without reading dated plans, and break the protected behavior only by failing a named regression test or the documented QA checklist.
