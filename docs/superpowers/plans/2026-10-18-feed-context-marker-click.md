# Feed Context Marker Click Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Contexto marker open its compact relationship panel from an X feed without also navigating to the post detail page.

**Architecture:** Keep the marker mounted in the validated author header and establish the event boundary at the marker's click handler. The handler cancels the click default and propagation before toggling local panel state, leaving the panel and its intentional outbound links unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, WXT browser extension content scripts

## Global Constraints

- Clicking the Contexto marker in a feed post opens or closes the compact relationship panel without navigating away from the feed.
- The marker remains a semantic button with its existing accessible expanded state.
- **Catch up on X**, **View our interactions**, and all other compact-panel actions retain their current behavior.
- Do not add an event boundary around the complete Contexto widget.
- Keep documentation synchronized with the interaction behavior and browser QA expectations.

---

### Task 1: Isolate the feed marker click from X post navigation

**Files:**
- Modify: `tests/contexto-feed-context.test.tsx:100`
- Modify: `src/ui/ContextoFeedContext.tsx:224`
- Modify: `docs/features/feed-saved-contact-context.md:11`
- Modify: `docs/development/browser-workflow.md:40`

**Interfaces:**
- Consumes: `ContextoFeedContext(props: ContextoFeedContextProps)` and the existing `onEdit`, `send`, and panel-link behaviors.
- Produces: a marker `React.MouseEvent<HTMLButtonElement>` handler that cancels X feed navigation and toggles the existing `open` state.

- [x] **Step 1: Write the failing feed-navigation regression test**

Add a test after the first marker-opening test in `tests/contexto-feed-context.test.tsx`. Render the real component beneath a parent click handler so the test models X's delegated feed-post navigation:

```tsx
it('opens the panel without triggering the enclosing feed post navigation', async () => {
  const user = userEvent.setup();
  const navigateToPost = vi.fn();
  const send = vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved });

  render(
    <article onClick={navigateToPost}>
      <ContextoFeedContext profile={profile} send={send} onEdit={vi.fn()} />
    </article>,
  );

  await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

  expect(screen.getByRole('dialog', { name: 'Contexto relationship context' })).toBeVisible();
  expect(navigateToPost).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```sh
npx vitest run tests/contexto-feed-context.test.tsx -t "opens the panel without triggering the enclosing feed post navigation"
```

Expected: FAIL because `navigateToPost` is called once even though the compact panel opens.

- [x] **Step 3: Implement the minimal marker click boundary**

In `src/ui/ContextoFeedContext.tsx`, add the typed handler next to the other local action handlers:

```tsx
const togglePanel = (event: React.MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
  event.stopPropagation();
  setOpen((current) => !current);
};
```

Use it only on the marker:

```tsx
onClick={togglePanel}
```

Do not attach cancellation handlers to the wrapping `span` or panel; outbound links inside the panel must retain their default navigation.

- [x] **Step 4: Run the focused component tests and verify GREEN**

Run:

```sh
npx vitest run tests/contexto-feed-context.test.tsx
```

Expected: all tests in `tests/contexto-feed-context.test.tsx` pass, including the new regression test and existing catch-up/interaction-link coverage.

- [x] **Step 5: Document the marker event contract**

In `docs/features/feed-saved-contact-context.md`, extend the opening behavior to state:

```markdown
Activating the marker opens or closes the compact panel without triggering the enclosing X post's navigation. Intentional links inside the panel retain their own navigation behavior.
```

In the saved-contact feed-context row of `docs/development/browser-workflow.md`, add the expected result:

```markdown
the marker opens the compact panel without navigating to the post; intentional panel links still open their documented destinations
```

- [x] **Step 6: Run repository verification**

Run:

```sh
npm run compile
npm test
npm run build
npm run verify:popup
```

Expected: all four commands exit with status 0 and report no test failures or compilation/build errors.

- [x] **Step 7: Review and commit the implementation**

Review only the intended files:

```sh
git diff --check
git diff -- tests/contexto-feed-context.test.tsx src/ui/ContextoFeedContext.tsx docs/features/feed-saved-contact-context.md docs/development/browser-workflow.md
```

Confirm that unrelated workspace files remain unstaged, then commit:

```sh
git add tests/contexto-feed-context.test.tsx src/ui/ContextoFeedContext.tsx docs/features/feed-saved-contact-context.md docs/development/browser-workflow.md docs/superpowers/plans/2026-10-18-feed-context-marker-click.md
git commit -m "fix: keep feed context marker on the timeline"
```
