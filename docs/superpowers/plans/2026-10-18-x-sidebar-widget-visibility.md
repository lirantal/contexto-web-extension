# X Sidebar Widget Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Contexto and native X search controls separated while hiding X's following right-rail widgets by default and restoring them lower on the page through a live dashboard setting.

**Architecture:** Normalize legacy settings at every read boundary, expose the new boolean in the dashboard, and extend the existing sidebar observer into a reversible policy controller. The controller uses validated native search plus `sidebarColumn` containment, never widget text, never reparents X nodes, and restores original inline styles when modules change or the content script disconnects.

**Tech Stack:** WXT storage, React 19, TypeScript, DOM `MutationObserver`, Vitest, Testing Library, JSDOM.

## Global Constraints

- `showNativeXSidebarWidgets` defaults to `false`, including for legacy stored objects where the field is absent.
- Preserve Contexto search and X native search in both states.
- Classify widgets structurally within the validated X right rail; do not use visible or localized widget copy.
- Do not reparent X-owned nodes or overwrite unrelated inline styles.
- When enabled, keep native widgets in their original order and place the first around mid-viewport with `margin-top: 50vh`.
- Restore every modified native element on replacement and disconnect.
- Apply setting changes live through `settingsItem.watch` and unregister the watcher on invalidation.
- Add or update a minimal fixture and regression test for the observed X DOM shape.

---

## File Structure

- Modify `src/shared/types.ts` — add the persisted boolean setting.
- Modify `src/shared/settings.ts` — add the default and legacy normalization helper.
- Modify `src/ui/Dashboard.tsx` — render and persist the dashboard checkbox.
- Modify `tests/dashboard-settings.test.tsx` — cover default rendering and persistence.
- Modify `tests/fixtures/x/sidebar-native-search.html` — represent a sidebar column with search and multiple following modules.
- Modify `src/x/sidebar-search-observer.ts` — resolve modules and apply reversible visibility/spacing policy.
- Modify `tests/x-sidebar-search-observer.test.ts` — cover hidden, visible, live update, rerender, fail-closed, and cleanup behavior.
- Modify `entrypoints/content.ts` — normalize, load, and watch the setting.
- Modify `src/ui/contexto-profile-surface.css` — add search host spacing.
- Modify `tests/contexto-surface-layout.test.ts` — enforce the spacing contract.
- Modify canonical docs under `docs/` — describe settings, DOM evidence, behavior, QA, and tests.

### Task 1: Add the normalized setting and dashboard toggle

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/settings.ts`
- Modify: `src/ui/Dashboard.tsx`
- Modify: `tests/dashboard-settings.test.tsx`

**Interfaces:**
- Produces: `normalizeContextoSettings(value: Partial<ContextoSettings> | null | undefined): ContextoSettings`.
- Produces: `ContextoSettings.showNativeXSidebarWidgets: boolean`.
- Used by: dashboard state, background responses, popup state, and content startup/watch wiring.

- [ ] **Step 1: Write failing settings/dashboard tests**

Add assertions that `defaultSettings.showNativeXSidebarWidgets` and normalization of `{ myXHandle: '', lastDashboardView: 'accounts' }` are `false`. In `tests/dashboard-settings.test.tsx`, retain a `setSettings` mock and add:

```tsx
it('shows X sidebar widgets only when the dashboard toggle is enabled', async () => {
  const user = userEvent.setup();
  render(<Dashboard />);
  const toggle = await screen.findByRole('checkbox', { name: 'Show X sidebar widgets' });
  expect(toggle).not.toBeChecked();
  await user.click(toggle);
  expect(mocks.setSettings).toHaveBeenCalledWith({
    myXHandle: '@me',
    lastDashboardView: 'accounts',
    showNativeXSidebarWidgets: true,
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/dashboard-settings.test.tsx tests/settings.test.ts`

Expected: FAIL because the field, normalizer, checkbox, or settings mock does not exist.

- [ ] **Step 3: Implement the minimal setting and checkbox**

Add the field to `ContextoSettings`, add it to `defaultSettings`, and implement:

```ts
export function normalizeContextoSettings(
  value: Partial<ContextoSettings> | null | undefined,
): ContextoSettings {
  return {
    ...defaultSettings,
    ...value,
    showNativeXSidebarWidgets: value?.showNativeXSidebarWidgets === true,
  };
}
```

Normalize the dashboard's startup value, then add this control under **My X handle**:

```tsx
<label className="checkbox-field">
  <input
    type="checkbox"
    checked={settings.showNativeXSidebarWidgets}
    onChange={(event) => saveSettings({
      ...settings,
      showNativeXSidebarWidgets: event.target.checked,
    })}
  />
  Show X sidebar widgets
</label>
```

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/dashboard-settings.test.tsx tests/settings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/shared/types.ts src/shared/settings.ts src/ui/Dashboard.tsx tests/dashboard-settings.test.tsx tests/settings.test.ts
git commit -m "feat: add X sidebar widget setting"
```

### Task 2: Apply a reversible native-widget policy

**Files:**
- Modify: `tests/fixtures/x/sidebar-native-search.html`
- Modify: `tests/x-sidebar-search-observer.test.ts`
- Modify: `src/x/sidebar-search-observer.ts`

**Interfaces:**
- `createXSidebarSearchObserver(...)` additionally returns `setShowNativeWidgets(show: boolean): void`.
- Internally resolves `{ form, widgets }` only when the validated form is inside `[data-testid="sidebarColumn"]` and an ancestor level has following element siblings.

- [ ] **Step 1: Expand the fixture and write failing policy tests**

Use this structural fixture shape:

```html
<aside data-testid="sidebarColumn">
  <div data-testid="sidebar-stack">
    <div data-testid="search-shell">
      <form role="search" action="/search">
        <label>Search<input data-testid="SearchBox_Search_Input" type="text" /></label>
      </form>
    </div>
    <section data-sidebar-module="news">Today's news</section>
    <section data-sidebar-module="sports">NFL</section>
    <section data-sidebar-module="trends">What's happening</section>
    <section data-sidebar-module="follow">Who to follow</section>
  </div>
</aside>
```

Assert that default policy sets every module's `style.display` to `none`, preserves the native input, and still mounts Contexto before the native form. After `setShowNativeWidgets(true)`, assert restored displays and `50vh` margin only on the first module. After replacement or `disconnect()`, assert prior `display` and `marginTop` values are restored. Add a negative fixture where the form is outside `sidebarColumn` and assert no native elements change.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/x-sidebar-search-observer.test.ts`

Expected: FAIL because the observer does not classify widgets or expose the policy setter.

- [ ] **Step 3: Implement classification and reversible state**

Add an internal resolver that ascends from the form toward `sidebarColumn`, retaining the outermost level that has following `HTMLElement` siblings. Track original style values once per element:

```ts
interface NativeWidgetStyle {
  display: string;
  marginTop: string;
}

const originalStyles = new Map<HTMLElement, NativeWidgetStyle>();
```

On every scan, restore and remove stale classified elements, capture newly classified elements, and apply:

```ts
widget.style.display = showNativeWidgets ? original.display : 'none';
widget.style.marginTop = showNativeWidgets && index === 0 ? '50vh' : original.marginTop;
```

Keep mounting tied only to the validated form. `setShowNativeWidgets` updates the boolean and reapplies the current classified widgets synchronously. `disconnect` restores all tracked styles before clearing the map.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/x-sidebar-search-observer.test.ts`

Expected: PASS for placement, hidden default, enabled spacing, replacements, fail-closed behavior, and cleanup.

- [ ] **Step 5: Commit**

```sh
git add tests/fixtures/x/sidebar-native-search.html tests/x-sidebar-search-observer.test.ts src/x/sidebar-search-observer.ts
git commit -m "feat: control native X sidebar widgets"
```

### Task 3: Wire live settings and fix Contexto search spacing

**Files:**
- Modify: `entrypoints/content.ts`
- Modify: `src/ui/contexto-profile-surface.css`
- Modify: `tests/contexto-surface-layout.test.ts`
- Create: `tests/content-sidebar-settings.test.ts`

**Interfaces:**
- Consumes: `settingsItem.getValue()`, `settingsItem.watch(callback)`, and `normalizeContextoSettings`.
- Produces: one startup update, live subsequent updates, and one watcher cleanup during invalidation.

- [ ] **Step 1: Write failing wiring and CSS tests**

In the CSS contract test require the sidebar host to contain `margin:12px 0 16px;`. In a focused content wiring test, mock `settingsItem` and controller creation, capture the watch callback, and assert startup/updates invoke:

```ts
expect(setShowNativeWidgets).toHaveBeenCalledWith(false);
watchCallback({ myXHandle: '', lastDashboardView: 'accounts', showNativeXSidebarWidgets: true });
expect(setShowNativeWidgets).toHaveBeenLastCalledWith(true);
```

Invalidate the content context and assert the returned `unwatch` callback runs once.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/contexto-surface-layout.test.ts tests/content-sidebar-settings.test.ts`

Expected: FAIL because host spacing and live setting wiring are absent.

- [ ] **Step 3: Implement live wiring and host spacing**

Change the sidebar host rule to `margin:12px 0 16px;`. In the content script, create the observer with the default-hidden policy, then wire:

```ts
void settingsItem.getValue()
  .then((value) => sidebarSearchObserver.setShowNativeWidgets(
    normalizeContextoSettings(value).showNativeXSidebarWidgets,
  ))
  .catch(() => sidebarSearchObserver.setShowNativeWidgets(false));

const unwatchSettings = settingsItem.watch((value) => {
  sidebarSearchObserver.setShowNativeWidgets(
    normalizeContextoSettings(value).showNativeXSidebarWidgets,
  );
});
```

Call `unwatchSettings()` during the existing invalidation cleanup.

- [ ] **Step 4: Verify GREEN and related integration tests**

Run: `npm test -- tests/contexto-surface-layout.test.ts tests/content-sidebar-settings.test.ts tests/x-sidebar-search-observer.test.ts tests/sidebar-account-search.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add entrypoints/content.ts src/ui/contexto-profile-surface.css tests/contexto-surface-layout.test.ts tests/content-sidebar-settings.test.ts
git commit -m "fix: separate X sidebar search surfaces"
```

### Task 4: Synchronize documentation and verify

**Files:**
- Modify: `docs/features/account-search.md`
- Modify: `docs/architecture/platform-adapters.md`
- Modify: `docs/architecture/storage-and-sync.md`
- Modify: `docs/development/browser-workflow.md`
- Modify: `docs/testing.md`

- [ ] **Step 1: Update canonical documentation**

Document the default-hidden setting, dashboard toggle, live application, structural `sidebarColumn` plus native-form evidence, no-reparent/restore contract, enabled `50vh` spacing, expanded fixture, and manual QA expectations.

- [ ] **Step 2: Run focused verification**

Run: `npm test -- tests/settings.test.ts tests/dashboard-settings.test.tsx tests/x-sidebar-search-observer.test.ts tests/contexto-surface-layout.test.ts tests/content-sidebar-settings.test.ts tests/sidebar-account-search.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run release verification**

Run each command separately:

```sh
npm run compile
npm test
npm run build
npm run verify:popup
```

Expected: all commands exit zero with no new warnings.

- [ ] **Step 4: Review the complete diff and documentation coverage**

Run `git diff --check`, inspect `git diff --stat`, and compare every requirement in `docs/superpowers/specs/2026-10-18-x-sidebar-widget-visibility-design.md` with code, tests, or canonical docs. Confirm no text-based widget detection, native-node reparenting, or unrelated refactor was introduced.

- [ ] **Step 5: Commit documentation and any verification fixes**

```sh
git add docs/features/account-search.md docs/architecture/platform-adapters.md docs/architecture/storage-and-sync.md docs/development/browser-workflow.md docs/testing.md
git commit -m "docs: document X sidebar widget controls"
```
