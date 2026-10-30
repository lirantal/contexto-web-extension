# AGENTS.md

Guidance for AI coding agents working in this repository.

## Start Here

Before making changes, read:

- `README.md` for product scope, setup, build, and manual installation.
- `docs/README.md` for the project documentation index.
- `docs/architecture/overview.md` for system structure and data flow.
- `docs/architecture/platform-adapters.md` before changing X parsing or DOM extraction.
- `docs/features/profile-metadata.md` before changing hover, profile, or editor behavior.
- `docs/development/browser-workflow.md` and `docs/testing.md` for verification requirements.

Treat those files as the source of truth. Dated files under `docs/superpowers/` preserve design and implementation history; they do not override current feature or architecture documentation.

## X Integration Guardrails

- Treat X DOM as transient, untrusted, and versionless. Scope identity extraction to the normalized handle and exact profile path; never infer identity from the first matching text node.
- Keep interactive Contexto editors outside X-owned hover-card subtrees. The hover card contains only the compact summary and Edit launcher.
- Preserve the documented close contract: successful Save and explicit Cancel close right-rail/modal editors; internal interaction, backdrop clicks, Escape, pointer movement, and hover dismissal do not.
- Add or update a minimal fixture and regression test for every newly observed X DOM shape.

## Documentation

- Keep documentation synchronized when changing behavior, architecture, workflows, selectors, or operational assumptions.
- Prefer links to canonical sources over duplicated instructions.
- Link new durable documentation from `docs/README.md`.

## Data preservation

Read [Data integrity](docs/development/data-integrity.md) before changing persistence, model fields, imports, or draft saves. Preserve existing and unknown fields, use lossless versioned migrations, keep multi-record writes transactional, and pass contact revisions from production draft editors. Add upgrade/round-trip or late-failure regressions appropriate to the change. Never use database deletion/reset as a production migration or silently overwrite conflicts during import.
