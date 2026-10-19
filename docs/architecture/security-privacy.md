# Security And Privacy

Contexto stores relationship metadata locally by default. The MVP does not send CRM data to a remote service.

## Permissions

The manifest requests:

- `storage`: extension settings and WXT storage.
- `tabs`: opening generated search URLs from the popup.
- `unlimitedStorage`: larger local CRM data in Chrome/Vivaldi.
- Host permissions for `https://x.com/*` and `https://twitter.com/*` only.

## Content Script Boundaries

The X content script reads visible profile-page DOM to capture a profile snapshot. It does not call private X APIs, scrape hidden data, or bulk-index direct messages.

Content-script UI uses Shadow DOM to avoid leaking Contexto styles into X and to reduce interference from X styles. The embedded right-sidebar workspace specifically uses a closed Shadow DOM root, so X page scripts and page-level selectors cannot directly enumerate its saved-account search or Quick X search controls. This closed-root choice is scoped to the sidebar workspace and does not change the root mode of other Contexto surfaces.

Closed Shadow DOM is an encapsulation boundary, not an authorization or secrets boundary. Sensitive relationship data remains protected by extension storage and typed extension messaging rather than by DOM visibility.

## Data Handling

- Private relationship notes remain in extension local storage unless explicitly exported.
- Exported JSON files contain all local Contexto data and should be treated as sensitive.
- Future sync must include explicit authentication, encryption and deletion behavior, and a migration plan.
