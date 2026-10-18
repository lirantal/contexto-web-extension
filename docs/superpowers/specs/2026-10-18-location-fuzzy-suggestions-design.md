# Location Fuzzy Suggestions Design

## Goal

Make Location entry consistent in the X profile editor and dashboard by suggesting previously saved locations with fuzzy matching, reducing duplicate values caused by spelling differences and typos while preserving free-text entry for new locations.

## User Experience

Both metadata editors use the same single-value Location combobox. Typing opens a ranked list of distinct saved locations. Users can select a result with the pointer or keyboard, or leave their typed text unchanged and save it as a new location.

Suggestions rank exact matches first, then prefix matches, substring matches, and finally ordered-character fuzzy matches. Matching is case-insensitive and ignores surrounding whitespace. Arrow Up and Arrow Down move through results, Enter selects the highlighted result, and Escape closes the list. The input remains usable when no suggestions exist or lookup loading fails.

## Data Flow

The existing lookup repository derives locations from active account records alongside companies, tags, and folders. It excludes blank values, trims surrounding whitespace, deduplicates case-insensitively, and returns stable alphabetical display values through `LookupData.locations`.

The background lookup message automatically carries the extended lookup shape to the X editor. The dashboard consumes the same repository data through its existing live query, so suggestions refresh after account changes without a separate storage model or database migration.

## Components

A shared single-value combobox owns suggestion filtering, ranking, popup state, keyboard navigation, pointer selection, and accessible combobox/listbox attributes. It is controlled by its parent through `value` and `onChange`, so selecting or typing updates the same draft state already used for saving and cancellation.

The X profile surface and dashboard account detail replace their plain Location inputs with this component. Tags and folders remain multi-value fields and are not changed by this work.

## Failure And Lifecycle Behavior

Location remains free text at all times. Empty lookup results, lookup errors, or a query with no fuzzy matches never block editing or saving. Disabling the field during an X editor save closes its suggestion list. Existing Save, failed Save, Cancel, draft retention, and editor-close contracts remain unchanged.

## Testing

Repository tests cover trimming, blank removal, case-insensitive deduplication, active-account filtering, and alphabetical output. Pure ranking tests cover exact, prefix, substring, fuzzy, and nonmatching queries. Component tests cover pointer and keyboard selection, Escape, free-text editing, and disabled behavior. Surface tests prove the X editor receives saved-location suggestions, while dashboard tests prove the same interaction is available there.

Canonical profile metadata and testing documentation are updated to describe the shared Location behavior and required regression coverage.
