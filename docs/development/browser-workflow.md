# Browser Development Workflow

Contexto targets Chrome and Vivaldi as Chromium MV3 browsers.

## Fast Loop

Use WXT dev mode:

```sh
npm run dev
```

WXT launches a Chromium browser with the extension installed. Edits rebuild automatically and the development extension reloads.

## Persistent Profile

By default, web-ext can create throwaway profiles. For Contexto, a persistent profile is better because you need X login state, extension IndexedDB, and DevTools settings to survive restarts.

Create a local `web-ext.config.ts` at the repo root. It is ignored by git. Start from [web-ext.config.example.ts](web-ext.config.example.ts), then set your Chrome or Vivaldi binary path.

Common Linux paths to try:

```sh
/usr/bin/google-chrome
/usr/bin/google-chrome-stable
/usr/bin/chromium
/usr/bin/vivaldi
/usr/bin/vivaldi-stable
```

## Manual Unpacked Install

When you want to use your everyday browser profile instead of WXT's launched profile:

```sh
npm run build
```

Then load `.output/chrome-mv3` from `chrome://extensions` or `vivaldi://extensions`.

The tradeoff is that you may need to press Reload on the extension card after each build.

## Manual QA Matrix

Run the relevant rows in both Chrome and Vivaldi when a change touches browser integration.

| Scenario | Expected result |
| --- | --- |
| Unknown and saved accounts on feed hover cards | Correct handle and display name; populated Role, Company, and Tags use their canonical labels; empty values are omitted; long values wrap without overlapping X controls or the Edit launcher. |
| Saved-contact feed context | The marker opens an opaque compact panel at the viewport's right edge above X content, outside the post subtree, without navigating to the post. Verify light/dark themes, quoted posts, narrow viewports, and scrolling to all actions on short screens. Close, marker toggle, outside pointer, and Escape dismiss the compact panel; Open full context hands off to the persistent editor. Populated Role, Company, How you know them, Tags, Circles, and Latest note use canonical labels; empty values and blank chips are omitted; long values wrap; intentional panel links still work. |
| Saved-contact post capture | Eligible primary posts show Capture or Bookmarked; optional reminders save without leaving X; quoted/promoted/ambiguous posts do not expose capture. |
| Saved-contact prior interactions | A valid configured viewer handle shows View our interactions and opens a live two-way X query in a new tab; a missing or invalid viewer handle hides the action without affecting context or bookmarks. |
| Saved-contact catch-up | Catch up on X opens live author posts since the displayed checkpoint; opening does not advance it; explicit Mark caught up updates it; failed updates preserve the previous date and context. |
| Saved-contact quick note | Add quick note opens an inline focused composer; empty drafts cannot save; success refreshes Latest note; failure preserves the draft; Cancel or panel close clears it; bookmark and note composers do not appear together. |
| Saved-contact tags and circles | Edit tags and circles works with populated or empty assignments. Verify suggestion selection, new values, chip removal, and Save with text still in either input; success refreshes the summary and keeps the popup open, while failure retains the draft. Cancel and panel dismissal discard unsaved edits. Internal clicks stay within the popup; narrow windows and both themes remain usable. |
| Dashboard account metadata | Account rows show Company: and Notes show Latest note: only for populated values; empty values are omitted; long unbroken values wrap within the compact list and detail pane. Role, Company, and Location suggestions use the shared neutral/teal style and appear below the input without moving the paired field row. |
| Dashboard account deletion | Account details requires a second explicit confirmation; confirmed deletion removes the account and its notes, bookmarks, search history, assignments, and local change-log entries, while shared company/tag/circle definitions remain. Cancel leaves the account intact. |
| Dashboard bookmark collection | Multiple bookmarks appear newest first; reminder edits accept text or an empty value; failed saves retain the draft; Mark handled preserves the source and exposes Reopen; Open on X remains canonical; Remove updates the collection without affecting contact metadata. |
| Wide and narrow viewports | The editor opens in the Contexto-owned right rail or modal fallback without shifting the hover card. |
| Hover dismissal and editor interaction | Moving away from the X card, typing, clicking fields or the backdrop, and pressing Escape do not close the editor. |
| Save, failed Save, and Cancel | Successful Save and explicit Cancel close the owned editor; failed Save stays open with the draft intact. |
| Full profile page | The inline editor remains visible and shows authoritative saved values. Location and Website appear in Identity. For saved contacts with either or both fields blank, available X metadata prefills only those blank fields; existing values and unsaved edits remain intact, and nothing persists until Save. A profile website such as `arize.com` behind a `t.co` link prefills as `https://arize.com/`; verify website edits, Save, Cancel, and dashboard persistence. |
| Contexto visual consistency on X | Full-profile, right-rail, modal, hover, and sidebar surfaces use the dashboard's warm neutral/teal palette; editors are visibly distinct from X; fields, buttons, chips, and suggestions use consistent geometry; circle chips retain their amber distinction; autocomplete has readable neutral/teal states in light and dark themes. |
| Quick X search in popup and right sidebar | The complete builder is available in both places; the sidebar builder is always expanded and sits in a Contexto-owned closed Shadow DOM root directly inside the sidebar column, above X's native search branch and outside its constrained or sticky wrappers. At page top, verify the first label is visible; in short windows, scroll inside the workspace to reach the last action. On profile and conversation views, scroll down and back up: the workspace stays 72 pixels below the viewport top, its first label stays unobscured, and all actions remain reachable by scrolling inside it. Verify the native search remains usable. Open a profile and a conversation: **Other person’s X handle** prefills from the URL, including after in-app navigation and Back/Forward without replacing the sidebar. Edit or clear it and confirm it stays editable on the same view; navigate to another person and confirm their handle replaces it while keyword/dates remain. Home and Search retain the existing target. Enter saved-account suggestions and a free-form target; verify shared handles, keyword, dates, autosuggest history, validation, and new-tab launches restore across popup/sidebar reopening. Select each date shortcut and verify both dates and query previews update together, manual date edits remain possible, and the dates restore across popup/sidebar reopening. Run **Posts by me** and **Posts to me** both with and without a target. Verify both successful and failed launches: only a successful launch updates target history. |
| X right-sidebar account search and native widgets | Saved-account exact, prefix, and fuzzy matches show up to five results; selecting a result navigates the current tab. Native news, sports, trends, and follow modules are hidden by default; enabling **Show X sidebar widgets** in the dashboard restores them live around mid-viewport in their original order; disabling it hides them again. On X rerender, resize, navigation, and extension reload, one Contexto workspace remounts cleanly and restores X-owned inline state during cleanup. If the native search-form evidence is absent, Contexto does not mount or alter X's own search/widgets. |
| Quick X search themes | In both Chrome and Vivaldi, verify the popup and X sidebar builder in light and dark X/browser themes. |
| Toolbar popup | Popup content and search controls render at the expected extension width; populated suggestion companies use Company:, empty values are omitted, and long unbroken company values wrap within the result. |
| Extension reload and navigation | Reloaded content scripts remount cleanly without relying on an invalidated extension context. |

## Manage data verification

In the options dashboard, open Manage data and verify Tags, Circles, and Companies: search, sort by usage, filter unused values, view contacts, rename, merge with overlapping contacts, cancel deletion, and confirm deletion everywhere. Return to accounts and verify assignments and suggestions reflect the change. Keep a profile or feed grouping editor open while making a catalog edit in another tab: Save must fail without recreating the old value, retain the draft, and offer Reload saved values. Reload explicitly discards the draft; a subsequent Save succeeds. For Companies, confirm merge reassigns contacts and deletion clears company fields. For Roles and Locations, verify case/whitespace variants share a preview, replace into existing/new values, cancel/confirm clearing, and refresh suggestions. A stale dashboard metadata draft must also fail and retain inputs until Reload saved values; an explicit X reload must preserve a cleared location even when the original X snapshot supplied one.
