# Platform Adapters

Contexto is X-first, but the CRM core is platform-neutral.

## Current X Adapter

`src/shared/platforms/x.ts` owns:

- X handle normalization and validation.
- Profile URL parsing for `x.com` and `twitter.com`.
- Reserved X route rejection, such as `/home`, `/messages`, and `/search`.
- X search query construction.
- X search URL construction.
- Canonical X status URL parsing for supported `/<handle>/status/<numeric-id>` paths.

## X DOM Extraction Invariants

X page DOM is transient, untrusted, and versionless input. Selectors are evidence about the current page shape, not a stable API.

Content-script extraction must:

- Scope extraction to the current hover card or profile surface rather than the whole page.
- Resolve the normalized handle first and prefer an identity link whose exact path is `/<handle>`.
- Read the display name from the matching identity subtree before the matching `@handle`.
- Exclude text inside buttons and elements with `role="button"` so action copy such as `Following` cannot become account metadata.
- Use deliberate fallbacks and return no profile when identity evidence is inconsistent.
- Capture website metadata from scoped `a[data-testid="UserUrl"]` outside posts and bio-text links; prefer complete HTTP(S) website evidence over X’s shortened link without resolving redirects. See [Profile metadata](../features/profile-metadata.md).
- Add a minimal fixture and regression test whenever X introduces a newly observed DOM shape.

The right-sidebar workspace, including saved-account search and the always-expanded Quick X search builder, requires `input[data-testid="SearchBox_Search_Input"]` inside a native `form` within `[data-testid="sidebarColumn"]`. Search inputs outside that column are ignored. A Contexto-owned host with a closed Shadow DOM root is inserted directly into the column, immediately before its top-level native branch containing the form. Never insert the workspace beside the form inside X's search shell: fixed heights, centering, clipping, transforms, and sticky offsets on those ancestors can move a tall form above the viewport regardless of its margin.

The mount remains valid while the host and form are connected, the form belongs to the same column and native branch, and the host is that branch's immediate previous sibling. Internal form-wrapper changes preserve the mounted workspace and its draft. Replacing the form, moving it to another branch or column, or separating or reordering the host and native branch triggers cleanup and one fresh mount. Missing form or column evidence fails closed and leaves native X content untouched. The workspace stays in document flow with sticky positioning 72 pixels below the viewport top, reserving room for X’s pinned native search header, and a viewport-bounded internal scroll area for short windows; it never reparents or changes the search shell's styles.

Native sidebar-widget control resolves only top-level following siblings along the validated form-to-column ancestor path. Contexto never identifies widgets from localized text and never reparents X-owned nodes. It records original inline display, spacing, and marker state, reapplies the visibility policy after X rerenders, and restores the original state when nodes leave the classified region or the content script disconnects. Missing column evidence leaves all native content untouched.

Bookmark capture additionally requires one unambiguous top-level status link matching the validated primary-author handle. Only top-level `[data-testid="tweetText"]` may become the bounded excerpt; quoted-post links/text, promoted content, reply targets, and nested cards are excluded. Missing post evidence disables capture without removing saved-contact relationship context.

Keep DOM extraction in the X content-script boundary. Shared platform adapters continue to own stable parsing, normalization, and URL construction rules.

## Future Platforms

LinkedIn and Reddit should add their own adapter modules with the same responsibilities:

- Normalize a platform account identifier.
- Parse a profile URL into a `ProfileSnapshot`.
- Build any platform-specific search/navigation URLs.
- Keep DOM extraction in the platform content script, not in shared repositories.

The `Account.platform` field already accepts `x`, `linkedin`, and `reddit`, but only `x` is implemented in the MVP UI.
