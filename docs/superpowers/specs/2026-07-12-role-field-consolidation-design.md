# Role Field Consolidation Design

## Summary

Contexto will replace the overlapping `profession` and `position` account metadata fields with one optional `role` field. The label shown to users is **Role**. A role describes how the person should be understood in relation to their current company, for example `CTO`, `Security engineer`, or `Founder`.

Historic values in `profession` and `position` are intentionally discarded. The change does not attempt to choose between, merge, or migrate those values.

## Data Model and Database

- `Account` and `AccountUpdateInput` expose `role?: string` and no longer expose `profession` or `position`.
- The accounts table uses `role` in its Dexie schema instead of the two removed fields.
- A new Dexie schema version replaces the account indexes. Its upgrade removes any stored `profession` and `position` properties without copying them into `role`.
- New and updated roles are trimmed before persistence, matching the existing metadata normalization behavior.
- Backup exports contain `role` through the updated account type. Existing format-version-1 imports may carry unrecognized legacy properties at runtime; those properties are not used by the application and the database upgrade removes them when applicable. There is no legacy-value conversion.

## User Experience

- The X profile editor and dashboard each show one **Role** input alongside **Company**.
- Draft creation, remount recovery, save, and cancel flows preserve `role` in the same way they previously preserved the two old fields.
- The hover-card summary renders `Role · Company` when both exist and omits the row when both are empty.
- Account text search includes `role`. The obsolete profession-specific filter is removed because it is not exposed by the current dashboard UI.

## Tests and Documentation

- Repository tests prove that `role` is saved, trimmed, returned, exported, and searchable.
- UI tests prove that the editor exposes only **Role**, saves it, restores it across remount/cancel flows, and renders it in the hover summary.
- TypeScript compilation ensures no production or current test code still consumes `profession` or `position` as account metadata.
- Current architecture and feature documentation refer only to `role`. Historical design and implementation-plan documents remain unchanged as records of earlier decisions.

## Out of Scope

- Employment history or multiple company-role pairs.
- Automatic role inference from X biographies.
- Migration heuristics for old profession or position values.
- Changes to CSS uses of the word `position`.
