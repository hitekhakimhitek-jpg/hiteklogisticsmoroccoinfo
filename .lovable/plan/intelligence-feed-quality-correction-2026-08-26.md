# Intelligence feed quality correction

## Goal
Make every visible intelligence card unique, article-based, readable, and fully consistent with the selected English or French language.

## Changes
1. **Critical port congestion**
   - Add a deterministic severity rule: confirmed port congestion is Critical, including global and China port congestion.
   - Preserve the existing IT-specific severity cap.

2. **Event-level deduplication**
   - Normalize titles and canonical URLs before insertion.
   - Detect near-identical recent headlines/event subjects across different source URLs.
   - Keep one canonical card and update it with the newest/best source rather than publishing another card.
   - Reprocess existing duplicate port-congestion cards so only one remains visible.

3. **Reject section and landing pages**
   - Expand article validation to reject titles such as “Air Cargo News”, “Rail News”, “Container Shipping News”, and similar publisher section labels.
   - Require article-like title/content evidence before publication.

4. **Clean summaries**
   - Strip URLs, markdown, hashtags, newsletter/signup calls to action, navigation fragments, and publisher promotional boilerplate.
   - Produce a concise factual recap when the scraped description is noisy or incomplete.
   - Add a short summary field to each card using the cleaned article description.

5. **Homogeneous language**
   - Normalize stored intelligence into English during ingestion when a source is French or another language.
   - Make the English view translate every non-English card field into English.
   - Keep French translation all-or-nothing per card across title, summary, impact, and action; invalidate stale mixed-language translation cache.

6. **Regression and live-data validation**
   - Add tests for port-congestion severity, JOC section-page rejection, duplicate headline matching, and noisy-summary cleanup.
   - Deploy the affected functions, reprocess the current 14-day dataset, merge/archive duplicates and invalid section cards, then verify feed/count/map consistency.

## Technical details
- Centralize deterministic cleanup and event fingerprinting in the shared intelligence utilities so ingestion and reprocessing use identical rules.
- Keep the canonical feed RPC as the single source of truth; no frontend-only hiding of bad records.
- Verify function type checks/tests, deployment responses, database results, current build health, and rendered EN/FR cards.
