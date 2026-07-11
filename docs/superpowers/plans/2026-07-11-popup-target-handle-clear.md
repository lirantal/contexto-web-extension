# Popup target-handle clear control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user clear the toolbar popup's other-person X handle with an accessible inline X button.

**Architecture:** Keep `searchState.targetHandle` as the single source of truth in `App`. Wrap only that controlled input in a positioned element; render the clear button only when the value is nonempty and route its click through `updateSearchField`. CSS keeps the icon button within the input's right edge without obscuring typed text.

**Tech Stack:** React 19, TypeScript, Lucide React, CSS, Vitest, React Testing Library.

## Global Constraints

- Change only the **Other person's X handle** input; all other popup fields retain their current behavior.
- Render the clear control only while `searchState.targetHandle` is nonempty.
- Give the control the accessible name `Clear other person's X handle`.
- Persist clearing through `updateSearchField('targetHandle', '')`, retaining the existing fire-and-forget persistence behavior.
- Do not add dependencies.

---

### Task 1: Add the target-handle clear affordance

**Files:**
- Modify: `tests/popup.test.tsx:31-49`
- Modify: `entrypoints/popup/App.tsx:2,103-111`
- Modify: `entrypoints/popup/App.css:49-65`

**Interfaces:**
- Consumes: `PopupSearchState`, `updateSearchField<Key extends keyof PopupSearchState>(field: Key, value: PopupSearchState[Key])`, and Lucide React's `X` icon.
- Produces: A conditionally rendered, keyboard-accessible button that clears `targetHandle` and causes `popupSearchStateItem.setValue` to receive the unchanged search state with `targetHandle: ''`.

- [ ] **Step 1: Write the failing test**

In `tests/popup.test.tsx`, import `userEvent` from `@testing-library/user-event`, then add this test after the existing persistence test:

```tsx
  it('clears and persists the other person’s X handle', async () => {
    const user = userEvent.setup();
    render(<App />);

    const clearButton = await screen.findByRole('button', { name: "Clear other person's X handle" });
    await user.click(clearButton);

    expect(screen.getByLabelText(/Other person/)).toHaveValue('');
    await waitFor(() => expect(mocks.setSearchState).toHaveBeenCalledWith({
      targetHandle: '',
      keyword: 'security',
      since: '2026-01-01',
      until: '2026-02-01',
    }));
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/popup.test.tsx`

Expected: FAIL because no button has the accessible name `Clear other person's X handle`.

- [ ] **Step 3: Write the minimal implementation**

In `entrypoints/popup/App.tsx`, import `X` alongside the other Lucide icons. Replace the target-handle input with a wrapper and conditional button:

```tsx
          <div className="input-with-clear">
            <input
              aria-label="Other person's X handle"
              value={searchState.targetHandle}
              onChange={(event) => updateSearchField('targetHandle', event.target.value)}
              placeholder="@their_handle"
            />
            {searchState.targetHandle && (
              <button
                type="button"
                className="clear-input"
                aria-label="Clear other person's X handle"
                onClick={() => updateSearchField('targetHandle', '')}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
```

In `entrypoints/popup/App.css`, add the following rules beside the search-field styles:

```css
.input-with-clear {
  position: relative;
}

.input-with-clear input {
  padding-right: 32px;
}

.popup-shell .clear-input {
  position: absolute;
  top: 50%;
  right: 4px;
  min-height: 24px;
  width: 24px;
  padding: 0;
  transform: translateY(-50%);
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #667066;
}

.popup-shell .clear-input:hover,
.popup-shell .clear-input:focus-visible {
  background: #e4e8e3;
  color: #222822;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- tests/popup.test.tsx`

Expected: PASS with all popup tests green.

- [ ] **Step 5: Run verification and commit**

Run:

```bash
npm test
npm run compile
git diff --check
git status --short
```

Expected: all tests and TypeScript compilation pass; the only changed implementation files are `entrypoints/popup/App.tsx`, `entrypoints/popup/App.css`, and `tests/popup.test.tsx`.

Commit:

```bash
git add entrypoints/popup/App.tsx entrypoints/popup/App.css tests/popup.test.tsx
git commit -m "feat: add popup target-handle clear button"
```

