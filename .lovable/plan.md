# New Sources + Country Holiday Calendar

## Phase 1 — Register the new sources

Add all requested publishers to the source catalogue used by the news-fetching pipeline and to the Settings source list, enabled by default:

- Carrier / forwarder advisories: SEKO Logistics, Kuehne+Nagel, Hillebrand Gori, Maersk, MSC, CMA CGM, Hapag-Lloyd
- Maritime & logistics press: The Maritime Executive, ICIS, Supply Chain Brain, Logistics Management, Baird Maritime, MarineLink
- Risk & visibility platforms: project44, Everstream Analytics, Resilinc

Each gets site-scoped disruption queries plus domain-to-source-name mapping so scraped links are labelled correctly in the feed.

## Phase 2 — Prioritize them in the crawl

- Move the carrier advisories and The Maritime Executive into the "core" set that runs on every scheduled run (today only five sources do).
- Add the advisory / insight pages as direct-scrape targets, since advisory pages are poorly covered by search indexes.
- Raise their weight in the feed source ranking so their items sort above generic press.
- Stay inside the Firecrawl rate budget: core grows modestly, the remaining new sources join the existing daily rotation.

## Phase 3 — Disaster and weather early-warning feeds

- New scheduled backend function pulling GDACS alerts (public feed, no key) plus JTWC / regional storm warnings.
- Cross-reference each alert's coordinates against known port and airport locations; when an alert falls near a logistics hub, create an intelligence item with coordinates so it appears on the map before the maritime press reports it.
- Same 14-day window, severity rules, and auto-archiving as the rest of the feed.

## Phase 4 — Country holiday calendar on the Disruption Map

- Clicking a country on the map opens a side panel listing that country's upcoming public holidays (next ~90 days): date, local name, and a flag when it likely affects port or customs operations.
- Holidays come from a free public holiday API (no key) via a backend function, cached in a `country_holidays` table refreshed weekly so the map stays fast.
- Panel text follows the EN/FR language toggle.
- Country clicks use a lightweight world-boundary layer on the existing Leaflet map; disruption markers and clustering keep working unchanged.

## Phase 5 — Verify

- Run a live scrape and confirm items from the new sources land with correct source labels and publication dates.
- Confirm hazard-derived items appear on the map.
- Click several countries and confirm holidays render correctly in both languages.

## Technical notes

- Source config: `supabase/functions/fetch-news/index.ts` (`SOURCE_QUERIES`, `CORE_SOURCES`, direct-scrape list, domain map) and defaults in `src/hooks/useSettings.ts`, `src/hooks/useAppliedSettings.ts`, `src/pages/SettingsPage.tsx`.
- Hazard alerts: new `supabase/functions/sync-hazard-alerts`, scheduled alongside the existing 9 AM chain.
- Holidays: new `supabase/functions/sync-holidays` writing to a `country_holidays` table (public read, admin write, with GRANTs), consumed by `src/pages/DisruptionMap.tsx`.