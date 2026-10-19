# Metadata Value Labels Design

**Date:** 2026-10-18

## Problem

Contexto displays saved relationship metadata in several compact, read-only surfaces. Some values appear without a visible field label. For example, a feed-post panel can show `DevRel` and `met in AISS` without identifying them as a role and relationship source. Similar ambiguity exists for company names, tags, folders, and latest-note text in other summaries and suggestions.

The editors already label their inputs. The inconsistency is limited to read-only metadata displays.

## Goal

Give every displayed saved metadata value a concise, visible label so a person can identify the field without relying on position, punctuation, color, or prior knowledge of the layout.

## Canonical Label Rule

The affected surfaces use these visible labels:

- `Role`
- `Company`
- `How you know them`
- `Tags`
- `Folders`
- `Latest note`

Each label is rendered next to or immediately above its value according to available width. Compact inline presentations use the form `Label: value`. Labels are visually differentiated from values with muted, semibold text, but the wording remains present in the document text so the relationship does not depend on styling.

Names, X handles, saved/unsaved state, `Recent`, catch-up checkpoints, success and error messages, and action text are identity or status content rather than saved metadata fields. They remain unchanged.

An empty metadata field is omitted together with its label. Contexto does not render empty labels or placeholder values.

## Affected Surfaces

### X feed-post context panel

The compact panel stops combining role and company into one unlabeled organization line. It renders separate populated rows for:

- `Role`
- `Company`
- `How you know them`
- `Tags`
- `Folders`
- `Latest note`

Tag and folder chips remain visually distinct values inside their labeled rows. All existing panel actions and lifecycle behavior remain unchanged.

### X hover-card summary

The saved-account summary renders separate populated fields for `Role`, `Company`, and `Tags`. The saved display name remains the summary identity and is not prefixed with a field label. The hover summary continues to omit relationship source, folders, notes, and other metadata that it did not previously display.

### Dashboard account list and detail

When an account-row company is present, the secondary line changes from an unlabeled suffix to a visible `Company:` value while retaining the `@handle` identity. In the Notes section, saved note text is identified as `Latest note:`. Existing editable profile fields, Tags and Folders section headings, and catch-up status already provide their own context and do not receive redundant labels.

### Toolbar popup account suggestions

A saved company shown in a target-handle suggestion is prefixed with `Company:`. The suggestion's display name, handle, and `Recent` state remain unchanged.

### X sidebar account search

The current result rows contain only display name and X handle. They do not display saved metadata, so no label change is required. If saved metadata is added to this surface later, the canonical label rule applies.

## Implementation Approach

Use explicit semantic markup in each affected surface rather than introducing a universal metadata renderer. The surfaces have different density, ownership, and styling contexts: Shadow DOM X UI, dashboard layout, and toolbar-popup suggestions. A generic renderer would either leak layout decisions across those contexts or require an abstraction more complex than the repeated label/value markup.

Class names may follow a shared label/value naming convention within each stylesheet. Markup must keep the visible label and value in the same logical field container so wrapping does not separate unrelated content.

No persistence, messaging, background, repository, platform-adapter, X extraction, or DOM-placement changes are required.

## Accessibility

- Labels are visible text, not CSS-generated content or `aria-label` substitutes.
- A field's label precedes its value in DOM and reading order.
- Chip collections remain readable after their `Tags` or `Folders` label.
- Existing accessible names for buttons, links, dialogs, listbox options, and account rows remain meaningful after the extra label text is introduced.
- Color is supplementary; the label/value distinction remains understandable without it.

## Styling

Compact X summaries use small field containers that support wrapping and preserve the current panel widths. Labels use the existing muted color and semibold weight; values retain normal content color. Tag and folder chip treatments remain unchanged.

Dashboard account rows and popup suggestions preserve their current density. The new `Company:` prefix wraps with the company value when necessary. The latest-note label is visually distinct without turning the note into an editable control.

Light and dark X themes continue to use the existing surface variables.

## Testing

Focused component tests will verify:

- the X feed panel renders each populated field with its canonical visible label;
- role and company are separate labeled fields rather than an unlabeled combined value;
- tags, folders, relationship source, and latest note are labeled;
- the X hover summary labels role, company, and tags;
- empty optional metadata omits both label and value;
- the dashboard account row labels company and the Notes section labels the latest note;
- toolbar-popup suggestions label saved company values;
- identity, status, and action copy remains unchanged.

Layout coverage will verify that the new compact field markup has explicit wrapping and label styling. The complete test suite, TypeScript compilation, production build, and popup bundle verification run before integration.

Manual browser verification covers the X feed panel and hover card at wide and narrow widths in light and dark themes, plus the dashboard account list and toolbar popup.

No new X fixture is required because this work does not change X DOM extraction, selectors, identity evidence, or placement.

## Documentation

The current feature documentation will state that read-only saved metadata uses visible field labels. The feed summary documentation will list the canonical labels, and profile metadata documentation will extend the convention to compact summaries, dashboard read-only values, and popup suggestions.

## Out of Scope

- Adding metadata fields to a surface that does not currently display them.
- Labeling identity values such as display names and X handles.
- Labeling general statuses, timestamps, actions, success messages, or errors.
- Changing editing behavior or field names in existing forms.
- Changing X extraction, mounting, or placement.
- Creating a universal metadata-summary component.

## Acceptance Criteria

- Every saved metadata value currently shown in the X feed panel, X hover summary, dashboard account rows or latest-note display, and toolbar-popup suggestions has a visible canonical field label.
- Role and company are independently identifiable wherever both are displayed.
- Empty fields do not leave empty labels or placeholders.
- Names, handles, state, status, and action text remain concise and unchanged.
- Labels remain readable and associated with their values when compact layouts wrap.
- Existing interaction, persistence, editor, X integration, and accessibility behavior continues to pass automated verification.
