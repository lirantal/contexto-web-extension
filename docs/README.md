# Documentation

These documents describe Contexto's current architecture, behavior, development workflow, and verification expectations.

## Architecture

- [Overview](architecture/overview.md) — system boundaries and data flow.
- [Data model](architecture/data-model.md) — persisted entities and relationships.
- [Platform adapters](architecture/platform-adapters.md) — platform parsing boundaries and X DOM extraction invariants.
- [Storage and sync](architecture/storage-and-sync.md) — local persistence and synchronization model.
- [Security and privacy](architecture/security-privacy.md) — data handling and privacy constraints.

## Development and testing

- [Browser development workflow](development/browser-workflow.md) — WXT development, unpacked installs, and the manual browser QA matrix.
- [Testing](testing.md) — automated checks, X fixtures, interaction lifecycle coverage, and manual verification expectations.

## Features

- [Account search](features/account-search.md) — dashboard account discovery and filtering.
- [Backup and restore](features/backup-restore.md) — local data portability.
- [Folders and tags](features/folders-tags.md) — metadata grouping behavior.
- [Message and profile search](features/message-profile-search.md) — X interaction-search workflows.
- [Profile metadata](features/profile-metadata.md) — hover, profile, and editor interaction contracts.
- [X search builder](features/x-search-builder.md) — popup query construction.
- [Saved-contact feed context](features/feed-saved-contact-context.md) — local relationship context on saved authors in X feeds.
- [Contact post bookmarks](features/contact-post-bookmarks.md) — capture X posts with reminders and revisit them per contact.

## Decision history

- [Design specifications](superpowers/specs/) — dated design decisions.
- [Implementation plans](superpowers/plans/) — dated execution plans.

Documents under `docs/superpowers/specs/` and `docs/superpowers/plans/` record design and execution history. Current behavior and invariants belong in the architecture, development, testing, and feature documents linked above.
