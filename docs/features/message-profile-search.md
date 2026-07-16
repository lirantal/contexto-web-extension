# Feature: Message And Profile Search

The MVP supports public X search URL generation for profile-specific interactions.

The saved-contact feed panel can open a combined live search for public posts in both directions: `(from:viewer to:author) OR (from:author to:viewer)`. It validates and normalizes the configured `myXHandle` and saved author handle before building the URL.

The shortcut is hidden when the viewer handle is missing or invalid or settings cannot be loaded. It opens X in a safe new tab and does not create a Contexto search-history record.

Saved contacts also support a catch-up search for `from:contact since:YYYY-MM-DD`, where the date comes from the last explicit catch-up checkpoint. X search is date-granular, so posts already reviewed earlier on the checkpoint day can reappear. Before the first checkpoint, Contexto opens `from:contact` without a date constraint.

Opening a catch-up search does not advance its checkpoint or create search history. The user must explicitly select **Mark caught up** in the feed panel or dashboard.

Private DM bulk indexing is intentionally out of scope. Contexto does not scrape private X message history or call private X APIs.

A future safe enhancement could add local filtering of currently loaded visible DM DOM only, but that should remain explicitly user-triggered and documented because the data is sensitive.
