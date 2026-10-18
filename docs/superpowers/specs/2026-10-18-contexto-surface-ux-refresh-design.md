# Contexto Surface UX Refresh Design

**Date:** 2026-10-18

## Summary

Contexto will refresh its toolbar popup and its embedded X surfaces so they are easier to scan, less visually compressed, and more explicit about the difference between saved information, local Contexto actions, and outbound links to X. The approved direction is the **Grouped workflow**: related content and controls are colocated under short section labels, spacing establishes hierarchy, and links receive more than color alone as an affordance.

The refresh changes presentation and information architecture, not persistence, navigation targets, X extraction, or editor lifecycle behavior.

## Scope

The refresh covers:

- The saved-contact feed panel, including quick note, bookmark capture, catch-up, prior-interaction, and full-context actions.
- The compact hover-card launcher.
- The complete profile editor in inline, docked, and modal placements.
- The X right-sidebar saved-account search.
- The browser toolbar quick-search popup.

The dashboard/options page is not a popup or an embedded X surface and is outside this pass. Existing shared styles may improve incidentally only where the same component is used by an in-scope surface.

## Goals

- Make **Catch up on X** and **View our interactions** unmistakable outbound links through grouped placement, persistent underlines, an external-navigation cue, a distinct blue treatment, and generous hit areas.
- Put related fields, actions, statuses, and errors next to each other instead of presenting one undifferentiated stack.
- Give every editable field a visible label and every group a concise heading where the relationship is not otherwise obvious.
- Increase breathing room without making embedded surfaces dominate X or forcing the toolbar popup to clip content.
- Establish one consistent visual hierarchy across light and dark themes.
- Preserve every documented behavior and close contract.

## Shared Information Hierarchy

Each surface uses the smallest applicable subset of this hierarchy:

1. **Identity and state** — person or Contexto title, saved state, and the primary edit affordance.
2. **Saved context** — role, company, relationship source, tags, folders, and latest note, with empty fields omitted in summaries.
3. **Local actions** — actions that write to Contexto, such as adding a note or saving a post.
4. **Explore on X** — outbound, read-only X searches.
5. **Primary continuation** — the main action that opens or saves the complete context.

Sections use 12–16 pixels of internal spacing, 8–10 pixels between related controls, and a subtle divider only between distinct groups. Supporting text remains secondary but no smaller than 12 pixels on content surfaces. Interactive targets are at least 36 pixels high on desktop and retain a visible focus state.

## Saved-Contact Feed Panel

The feed panel grows from 280 pixels to a target width of 320 pixels, constrained to the available viewport. Its content order is:

1. **Saved context** — name and saved state in the header, then labeled relationship rows, tags/folders, and the latest note.
2. **Add to Contexto** — **Add note** and **Save post** appear as a paired local-action row when eligible. Opening either composer replaces this row with the existing labeled textarea, action buttons, and adjacent success or error feedback.
3. **Explore on X** — **Catch up on X** and **View our interactions** are colocated as two consecutive blue link-actions. They are never separated by checkpoint controls. Each link has a visible underline, a short explanation, and an external-link icon while retaining semantic anchor markup and safe new-tab attributes.
4. **Catch-up checkpoint** — directly below both blue links, a checkpoint row shows the last-reviewed date or first-use message together with **Mark caught up**. Catch-up success or failure appears immediately below this row. Marking the checkpoint remains independent from opening either link.
5. **Open full context** — the single full-width primary action remains the panel footer.

When **View our interactions** is unavailable, **Catch up on X** remains in the same Explore group and the checkpoint stays below it. When bookmark capture is unavailable, the remaining local action uses the available width. The existing rule that note and bookmark composers are mutually exclusive remains unchanged.

## Hover-Card Launcher

The hover launcher remains intentionally compact so it does not turn X's hover card into an editor. Its header keeps the Contexto identity, a readable saved/loading/error state, and one **Edit** button. Saved summary content uses a small vertical rhythm between name, organization, and tags. Status copy is visually secondary and does not compete with the Edit action.

No additional fields or outbound X actions are added to the hover card. The complete editor continues to mount outside the X-owned hover subtree.

## Profile Editor

The complete editor keeps the same data and save/cancel lifecycle but organizes fields into three labeled groups:

- **Identity:** Display name and read-only X handle.
- **Work:** Role and Company.
- **Relationship:** Location, How you know them, Tags, and Folders.

Docked and modal placements use two-column rows for naturally paired short fields when at least 380 pixels are available. Narrow and inline placements collapse to one column. Tags and folders keep their current searchable multi-value behavior.

The header pairs the Contexto title with the saved state. Save, retry, error, success, and Cancel remain together at the bottom of the form. The primary Save action comes first; Cancel remains secondary. Successful Save and explicit Cancel close owned docked/modal editors, while the inline editor stays visible. Internal interaction, backdrop clicks, Escape, pointer movement, and hover dismissal do not close owned editors.

## X Sidebar Account Search

The sidebar search keeps one visible label and adds short supporting copy only when needed. Results become structured rows with the display name as the primary line and the handle plus role/company as secondary context when available. Rows receive more vertical padding and a complete hover/focus treatment so they read as navigation targets rather than plain text.

Loading, no-results, and failure messages stay immediately below the field. The native X search remains unchanged and separate, and Contexto continues to fail closed when the native-form placement evidence is incomplete.

## Toolbar Quick-Search Popup

The toolbar popup keeps its 400-pixel extension width and browser-controlled placement, but replaces the condensed continuous form with three clear groups:

- **People:** My X handle and Other person's X handle, with helper text placed directly under the relevant field.
- **Filters:** Keyword plus paired Since and Until dates.
- **Choose what to search:** the existing four search actions and their query previews.

Section headings, 12–16 pixel group spacing, consistent labels, and slightly taller inputs improve scanability. Query previews remain one-line and ellipsized with the full query available through the existing button title. Footer navigation remains visually separate from search execution.

The normal 100% desktop layout should remain within Chrome's 600-pixel popup height when practical. Vertical scrolling remains an explicit fallback for smaller screens, increased text scaling, or long localized content; content must not be clipped merely to avoid a scrollbar.

## Link and Action Language

- Semantic anchors are used for navigation; buttons are used for writes, disclosure, and editor actions.
- Outbound X links use blue text, persistent underlining, an external-link cue, and a blue-tinted bordered surface. Color is not the only link signal.
- Purple remains the Contexto product accent and identifies the primary continuation or save action, not ordinary navigation.
- Secondary buttons use neutral borders and backgrounds.
- Success and error messages appear beside the action group that caused them rather than between unrelated controls.

## Component and Style Boundaries

- `ContextoFeedContext` owns the feed panel's semantic groups and conditional action layout.
- `ContextoProfileSurface` owns editor field grouping and responsive form rows.
- `ContextoHoverLauncher` retains its compact summary boundary.
- `ContextoSidebarAccountSearch` owns structured result labels.
- The toolbar popup keeps its independent extension-page stylesheet.
- `contexto-profile-surface.css` supplies shared embedded-surface tokens and layout primitives inside each Shadow DOM root.

No X selectors, extraction rules, repository interfaces, message types, database fields, or permissions change. No new UI framework or runtime dependency is required.

## Accessibility and Responsive Behavior

- Every form control retains an explicit visible label.
- Section headings are descriptive text, not placeholder-only instruction.
- Keyboard order follows visual order, and focus rings remain visible in light and dark themes.
- Link purpose is understandable without relying on color or hover.
- Status and error live regions retain their current semantics.
- At narrow widths, paired fields and actions wrap or stack without overlap; panels remain within the viewport.
- Reduced-motion behavior remains respected.

## Testing

Implementation follows test-driven development:

- Feed component tests assert the Explore-on-X grouping order: both outbound links appear together before the checkpoint row, safe link attributes remain intact, and conditional visibility does not break the group.
- Feed tests preserve note/bookmark mutual exclusion, checkpoint success/failure, and full-context behavior.
- Profile-surface tests assert labeled field groups without changing persistence or close behavior.
- Sidebar-search tests assert structured result content and existing navigation/error states.
- Popup component and layout-contract tests assert the People, Filters, and search-action groups, visible labels, spacing rules, width, query truncation, and fallback scrolling.
- Shared layout-contract tests cover feed width, grouped spacing, responsive field collapse, link affordances, light/dark tokens, and focus visibility.
- The complete Vitest suite, TypeScript compile, production build, and popup bundle verification run before completion.
- Manual QA covers the relevant browser-workflow matrix in both Chrome and Vivaldi, including wide/narrow viewports, light/dark X themes, hover-card fit, feed panel composers, editor placements, sidebar search, toolbar-popup height, and extension reload/navigation.

Because this work changes presentation rather than observed X DOM shapes, no new X fixture is required unless implementation encounters and supports a newly observed DOM structure.

## Documentation

Current behavior will be synchronized in:

- `docs/features/feed-saved-contact-context.md`
- `docs/features/profile-metadata.md`
- `docs/features/account-search.md`
- `docs/features/x-search-builder.md`
- `docs/development/browser-workflow.md` or `docs/testing.md` only if verification assumptions change

## Out of Scope

- New CRM fields, search directions, or saved data.
- Changes to the dashboard/options-page information architecture.
- Changes to X DOM extraction or placement selectors unless a newly observed fixture requires them.
- Collapsing essential actions behind menus or hover-only UI.
- Changing the documented editor close contract.
