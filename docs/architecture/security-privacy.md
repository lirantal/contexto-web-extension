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

The content script uses a Shadow DOM UI to avoid leaking Contexto styles into X and to reduce interference from X styles.

## Data Handling

- Private relationship notes remain in extension local storage unless explicitly exported.
- Exported JSON files contain all local Contexto data and should be treated as sensitive.
- Future sync must include explicit authentication, encryption and deletion behavior, and a migration plan.
