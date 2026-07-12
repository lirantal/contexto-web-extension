# Platform Adapters

Contexto is X-first, but the CRM core is platform-neutral.

## Current X Adapter

`src/shared/platforms/x.ts` owns:

- X handle normalization and validation.
- Profile URL parsing for `x.com` and `twitter.com`.
- Reserved X route rejection, such as `/home`, `/messages`, and `/search`.
- X search query construction.
- X search URL construction.

## X DOM Extraction Invariants

X page DOM is transient, untrusted, and versionless input. Selectors are evidence about the current page shape, not a stable API.

Content-script extraction must:

- Scope extraction to the current hover card or profile surface rather than the whole page.
- Resolve the normalized handle first and prefer an identity link whose exact path is `/<handle>`.
- Read the display name from the matching identity subtree before the matching `@handle`.
- Exclude text inside buttons and elements with `role="button"` so action copy such as `Following` cannot become account metadata.
- Use deliberate fallbacks and return no profile when identity evidence is inconsistent.
- Add a minimal fixture and regression test whenever X introduces a newly observed DOM shape.

Keep DOM extraction in the X content-script boundary. Shared platform adapters continue to own stable parsing, normalization, and URL construction rules.

## Future Platforms

LinkedIn and Reddit should add their own adapter modules with the same responsibilities:

- Normalize a platform account identifier.
- Parse a profile URL into a `ProfileSnapshot`.
- Build any platform-specific search/navigation URLs.
- Keep DOM extraction in the platform content script, not in shared repositories.

The `Account.platform` field already accepts `x`, `linkedin`, and `reddit`, but only `x` is implemented in the MVP UI.
