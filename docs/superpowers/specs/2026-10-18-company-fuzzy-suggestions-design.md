# Company Fuzzy Suggestions Design

## Goal

Give Company the same fuzzy suggestion behavior as Location in both metadata editors so users can reuse canonical saved company names and avoid near-duplicates caused by spelling mistakes, while retaining free-text creation for genuinely new companies.

## User Experience

Company and Location use the same single-value free-text combobox. Typing a Company value opens a ranked list of active saved companies. Users can select a result with the pointer or keyboard, or keep their typed text and save it as a new company.

Suggestions rank case-insensitive exact matches first, then prefix matches, substring matches, and ordered-character fuzzy matches. Arrow Up and Arrow Down move through results, Enter selects the highlighted result, and Escape closes the list. Empty results and lookup failures leave the input fully usable.

## Architecture

The Location-specific combobox becomes a generic fuzzy text combobox configured with a label, value, suggestion strings, change callback, and optional disabled state. The Location-specific ranking helper becomes a generic text-suggestion ranker. Location migrates to these generalized names without changing behavior, and Company adopts the same component.

The existing company lookup data remains the source of suggestions. Companies are already normalized, uniquely indexed by normalized name, soft-delete aware, and returned by the shared lookup response, so no database migration or message-contract change is needed.

## Data Flow

The X editor maps active lookup companies to their display names and passes them to the shared combobox. The dashboard passes the same live lookup values to its account detail editor. Selecting an option updates the existing companyName draft field; saving continues through the existing account update and company upsert paths.

Free text remains authoritative until the user explicitly selects a suggestion. Existing normalized company uniqueness continues to handle exact case and whitespace variants during persistence.

## Failure And Lifecycle Behavior

A missing or empty company lookup produces an ordinary free-text Company field. The X editor disables and closes the combobox during Save. Existing successful Save, failed Save, Cancel, draft retention, and owned-editor close contracts remain unchanged.

## Testing

Generic ranking tests retain exact, prefix, substring, fuzzy, nonmatching, and deterministic ordering coverage. Generic component tests retain keyboard, pointer, Escape, free-text, and disabled-state coverage and verify configurable labels.

X editor and dashboard tests each prove that a fuzzy Company query can select an existing canonical company name and that the selected value reaches the existing save API. Existing Location surface coverage confirms that generalization does not regress Location behavior.

Canonical profile metadata and testing documentation describe the shared Company and Location suggestion contract.
