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
- Add a minimal fixture and regression test whenever X introduces a newly observed DOM shape.

The right-sidebar workspace, including saved-account search and the always-expanded Quick X search builder, mounts only when `input[data-testid="SearchBox_Search_Input"]` is contained by a native `form`; it inserts a Contexto-owned host with a closed Shadow DOM root immediately before that form and fails closed when this evidence is incomplete. The mount remains valid only while the host and form are connected, share the same parent, and the host is the form's immediate previous sibling. Reparenting the same form or inserting or reordering a sibling triggers cleanup and one fresh mount in the required position. Missing native-form evidence leaves X's own search available and does not modify its widgets. The Quick X builder is not an X widget: native search and the independently configured native-sidebar-widget visibility policy remain separately usable.

Native sidebar-widget control additionally requires that form to be contained by `[data-testid="sidebarColumn"]` and resolves only top-level following siblings along the form-to-column ancestor path. Contexto never identifies widgets from localized text and never reparents X-owned nodes. It records original inline display, spacing, and marker state, reapplies the visibility policy after X rerenders, and restores the original state when nodes leave the classified region or the content script disconnects. If the broader column evidence is missing, saved-account search may still mount but unrelated native content remains untouched.

Bookmark capture additionally requires one unambiguous top-level status link matching the validated primary-author handle. Only top-level `[data-testid="tweetText"]` may become the bounded excerpt; quoted-post links/text, promoted content, reply targets, and nested cards are excluded. Missing post evidence disables capture without removing saved-contact relationship context.

Keep DOM extraction in the X content-script boundary. Shared platform adapters continue to own stable parsing, normalization, and URL construction rules.

## Future Platforms

LinkedIn and Reddit should add their own adapter modules with the same responsibilities:

- Normalize a platform account identifier.
- Parse a profile URL into a `ProfileSnapshot`.
- Build any platform-specific search/navigation URLs.
- Keep DOM extraction in the platform content script, not in shared repositories.

The `Account.platform` field already accepts `x`, `linkedin`, and `reddit`, but only `x` is implemented in the MVP UI.
