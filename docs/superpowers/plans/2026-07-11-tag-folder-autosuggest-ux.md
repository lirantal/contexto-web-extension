# Tag and Folder Autosuggest UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shared Tags and Folders autosuggest keyboard-accessible, visually distinct, and free of the explicit “Create” option row.

**Architecture:** Keep all interaction state inside the existing shared `MultiValueField`, because Tags and Folders already consume the same component. Add focused component tests for the combobox contract, then update the profile-surface theme styles without changing Company, dashboard inputs, or the popup handle combobox.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, CSS custom properties

## Global Constraints

- Apply the custom autosuggest changes only to Tags and Folders in `MultiValueField`.
- Preserve free-form creation by pressing Enter when no suggestion is active.
- Do not render a visible “Create” option.
- Preserve case-insensitive substring matching and exclude already-selected values.
- Do not change Company, dashboard tag/folder inputs, or the popup target-handle combobox.

---

### Task 1: Accessible keyboard and pointer interaction

**Files:**
- Create: `tests/multi-value-field.test.tsx`
- Modify: `src/ui/MultiValueField.tsx`

**Interfaces:**
- Consumes: existing `MultiValueFieldProps` without public API changes.
- Produces: an ARIA combobox whose existing-value matches can be highlighted with Arrow Up/Down and selected with Enter or pointer input.

- [ ] **Step 1: Write failing keyboard and rendering tests**

Create `tests/multi-value-field.test.tsx` with a stateful harness using suggestions `['YouTuber', 'YouTube Creator', 'Developer']`. Assert that typing `you` shows the two matching options in the listbox, renders no text matching `/create/i`, Arrow Down selects the first option through `aria-activedescendant`, a second Arrow Down selects the next option, Arrow Up returns to the first option, and Enter adds `YouTuber` as a chip and clears the input.

Add separate tests asserting:

```tsx
await user.type(input, 'New Tag{Enter}');
expect(screen.getByText('New Tag')).toBeVisible();

await user.type(input, 'you');
await user.keyboard('{Escape}');
expect(input).toHaveValue('you');
expect(input).toHaveAttribute('aria-expanded', 'false');

await user.click(screen.getByRole('option', { name: 'YouTuber' }));
expect(screen.getByText('YouTuber')).toBeVisible();
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- tests/multi-value-field.test.tsx`

Expected: FAIL because the input lacks combobox expansion/active-descendant behavior, Enter creates the query instead of selecting the active option, and the “Create” row is still rendered.

- [ ] **Step 3: Implement the minimal combobox behavior**

Update `MultiValueField.tsx` to import `useEffect`, `useId`, `useMemo`, and `useState`. Add `open` and `highlighted` state plus a stable listbox id. Derive `expanded` from `open`, a non-empty trimmed query, and available matches.

Implement key handling with these exact rules:

```tsx
if (event.key === 'ArrowDown' && matches.length) {
  event.preventDefault();
  setOpen(true);
  setHighlighted((current) => current < matches.length - 1 ? current + 1 : 0);
} else if (event.key === 'ArrowUp' && matches.length) {
  event.preventDefault();
  setOpen(true);
  setHighlighted((current) => current > 0 ? current - 1 : matches.length - 1);
} else if (event.key === 'Enter') {
  event.preventDefault();
  add(highlighted >= 0 && matches[highlighted] ? matches[highlighted] : query);
} else if (event.key === 'Escape' && open) {
  event.preventDefault();
  setOpen(false);
  setHighlighted(-1);
}
```

Reset the highlight and open the list on input changes. Reset and close both states after adding. Use `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` on the input. Render only matching existing suggestions when expanded; remove the “Create” button. Give options stable ids, `aria-selected`, pointer highlight, focus-preserving mouse down, and click selection. Scroll the active option into view with a guarded `scrollIntoView?.({ block: 'nearest' })` effect.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `npm test -- tests/multi-value-field.test.tsx`

Expected: all tests in the file PASS with no warnings.

- [ ] **Step 5: Commit the interaction behavior**

```bash
git add src/ui/MultiValueField.tsx tests/multi-value-field.test.tsx
git commit -m "feat: improve tag and folder autosuggest controls"
```

---

### Task 2: Suggestion and active-option visuals

**Files:**
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `tests/multi-value-field.test.tsx`

**Interfaces:**
- Consumes: the option highlight state and existing profile-surface color variables.
- Produces: `.value-option.highlighted`, link-blue option text, and a blue-tinted active/hover background in light and dark themes.

- [ ] **Step 1: Write a failing visual-contract test**

Extend the rendering test to assert existing options have class `value-option`, and after Arrow Down the selected option also has class `highlighted`.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- tests/multi-value-field.test.tsx`

Expected: FAIL if the option classes are not yet emitted exactly as specified.

- [ ] **Step 3: Add the minimal theme-aware styles**

Add `--ctx-link:#1d9bf0` to `.contexto-surface` and a suitable lighter dark-theme value to the existing dark theme block. Replace the generic option rule with:

```css
.value-options .value-option { border:0; border-radius:0; color:var(--ctx-link); text-align:left; }
.value-options .value-option:hover,
.value-options .value-option.highlighted { background:color-mix(in srgb,var(--ctx-link) 12%,var(--ctx-bg)); color:color-mix(in srgb,var(--ctx-link) 82%,var(--ctx-text)); }
```

- [ ] **Step 4: Run focused tests and static checks**

Run: `npm test -- tests/multi-value-field.test.tsx tests/contexto-profile-surface.test.tsx`

Expected: both test files PASS.

Run: `npm run compile`

Expected: TypeScript exits with code 0.

- [ ] **Step 5: Commit the visual treatment**

```bash
git add src/ui/contexto-profile-surface.css tests/multi-value-field.test.tsx
git commit -m "style: clarify tag and folder suggestions"
```

---

### Task 3: Full regression verification

**Files:**
- Verify only; no planned modifications.

**Interfaces:**
- Consumes: completed interaction and visual changes.
- Produces: evidence that the extension remains testable, type-safe, and buildable.

- [ ] **Step 1: Check the final diff and whitespace**

Run: `git diff main...HEAD --check && git diff --stat main...HEAD`

Expected: no whitespace errors and only the component, focused test, and profile-surface stylesheet differ from the worktree base; the spec and plan are already committed on that base.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all Vitest tests PASS with zero failures.

- [ ] **Step 3: Run compilation and production build**

Run: `npm run compile`

Expected: exit code 0.

Run: `npm run build`

Expected: Chrome extension production build exits with code 0.

- [ ] **Step 4: Inspect worktree state**

Run: `git status --short --branch && git log --oneline --decorate -5`

Expected: the feature branch is clean and contains the implementation commits above the spec and plan commits.
