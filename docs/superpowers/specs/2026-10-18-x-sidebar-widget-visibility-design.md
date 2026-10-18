# X Sidebar Widget Visibility Design

## Goal

Keep Contexto's saved-account search comfortably visible in X's right rail, prevent X's native search from overlapping subsequent right-rail modules, and let users decide whether native X sidebar widgets appear at all. Native widgets are hidden by default.

## Scope

- Add top and bottom breathing room around the Contexto sidebar search so its input is not clipped.
- Keep X's native search field present and usable.
- Hide native right-rail content modules that follow the search area by default, including current news, sports, trends, and follow recommendations.
- Add a Contexto dashboard setting that restores those native modules lower on the page.
- Apply the setting to already-open X tabs without requiring a reload.
- Preserve X-owned DOM nodes and restore every Contexto-applied mutation during teardown.

Out of scope: hiding X navigation, modifying timeline content, changing X search behavior, identifying widgets from localized copy, moving X-owned nodes, or providing per-widget visibility settings.

## User Experience

The Contexto saved-account search remains above X's native search. It has a visible top margin and enough separation from the native field that neither search control is clipped or visually merged with the other.

The Contexto dashboard's existing Settings panel contains a checkbox labeled **Show X sidebar widgets**. The setting defaults to off. With it off, native right-rail modules after the search area are absent while both search fields remain usable. With it on, the modules remain in their original order and begin around the middle of the viewport, below the two search surfaces. Changing the setting updates an open X page live.

## Architecture

Extend `ContextoSettings` with `showNativeXSidebarWidgets: boolean` and set its fallback to `false`. Existing stored settings may lack the field, so all reads normalize the value with the default instead of assuming a migration has already populated it.

Keep saved-account search mounting focused on the validated native search evidence: `input[data-testid="SearchBox_Search_Input"]` contained by a `form`. Extend the X sidebar observer/controller to resolve the structurally related right-rail module region, then classify the top-level X-owned modules that follow the search area. Classification uses DOM position and containment, not visible text, labels, or the first matching node on the page.

The controller never reparents X-owned nodes. It records the prior values of any attributes or inline styles it changes, applies a Contexto-owned marker and visibility/spacing policy, reapplies the policy after X mutation-driven rerenders, and restores the prior state during remount or disconnect.

When native widgets are hidden, the controller hides the classified modules. When they are shown, it restores their visibility and applies spacing before the first module so it begins around `50vh` without changing module order. The Contexto search host owns its own top/bottom spacing in Shadow DOM host styles.

The content script reads the normalized setting and watches the existing WXT settings item for changes. The watch is removed during content-script invalidation. Setting failures fail closed to the default hidden policy while leaving both search fields available.

## Components and Data Flow

1. `src/shared/settings.ts` supplies the new default and a normalization helper for partial/legacy stored values.
2. `src/ui/Dashboard.tsx` renders and persists the checkbox through the existing settings item.
3. `entrypoints/content.ts` loads and watches settings, passing `showNativeXSidebarWidgets` into the sidebar controller.
4. `src/x/sidebar-search-observer.ts` discovers the native search form, maintains the Contexto search mount, classifies following right-rail modules, and applies the current policy after X rerenders.
5. `src/x/mount-contexto-sidebar-search.tsx` continues to own only the Contexto Shadow DOM host and React root.

No account data or setting value is sent to X.

## Failure and Lifecycle Behavior

- Missing or inconsistent native-search/right-rail evidence fails closed: do not hide unrelated page elements.
- A settings read/watch failure uses the default hidden policy only when a validated sidebar region has been found.
- X replacements of the search area or widget modules trigger cleanup and reclassification without duplicate Contexto hosts.
- Disconnect restores X-owned attributes/styles exactly to their prior values, removes the Contexto host, stops observers, and unregisters the settings watcher.
- Native X search remains untouched and usable in all states.

## Testing

- Expand the minimal X sidebar fixture to include a search area followed by representative news, sports, trends, and follow modules.
- Add controller tests for default hiding, enabled visibility plus mid-viewport spacing, live policy changes, rerender replacement, failure on incomplete evidence, preservation of native search, and cleanup restoration.
- Add settings tests for a default of `false` and normalization of legacy stored values.
- Add dashboard tests for rendering and persisting the checkbox.
- Add CSS contract assertions for Contexto search top/bottom spacing.
- Run focused Vitest checks during TDD, then `npm run compile`, `npm test`, `npm run build`, and `npm run verify:popup` before completion.

## Documentation

Update canonical account-search, platform-adapter, storage, browser-workflow, and testing documentation. Document the structural DOM evidence, default-hidden behavior, live dashboard toggle, enabled spacing, cleanup contract, and fixture coverage.
