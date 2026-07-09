# Platform Adapters

Contexto is X-first, but the CRM core is platform-neutral.

## Current X Adapter

`src/shared/platforms/x.ts` owns:

- X handle normalization and validation.
- Profile URL parsing for `x.com` and `twitter.com`.
- Reserved X route rejection, such as `/home`, `/messages`, and `/search`.
- X search query construction.
- X search URL construction.

## Future Platforms

LinkedIn and Reddit should add their own adapter modules with the same responsibilities:

- Normalize a platform account identifier.
- Parse a profile URL into a `ProfileSnapshot`.
- Build any platform-specific search/navigation URLs.
- Keep DOM extraction in the platform content script, not in shared repositories.

The `Account.platform` field already accepts `x`, `linkedin`, and `reddit`, but only `x` is implemented in the MVP UI.
