# Holiday Map Interaction and Scraping Reliability

## Goal
Show full country names in the holiday calendar, let a country click open that country's holiday panel on the map, and repair/test the scraping pipeline so every configured source is actually monitored with visible per-source outcomes.

## Holiday calendar
- Resolve every ISO-2 code to its full English/French country name instead of displaying two-letter fallbacks.
- Make each country entry an accessible interactive control.
- Lift the selected-country state to the map page so clicking a calendar country scrolls/focuses the map, fits the country boundary, highlights it, and opens the existing holiday popup with all upcoming holidays.
- Keep region filtering and coherent French holiday translation intact.

## Scraping audit findings to address
- The database currently contains only hazard/weather registry rows; built-in news, authority, carrier, risk, and IT sources are not synchronized by `fetch-news`, so there is no news-source health coverage.
- `fetch-news` rotates most sources by calendar day and checks only eight non-core sources, which means a single daily run cannot check every source and some sources wait several days.
- The global Firecrawl limiter allows about 10 requests/minute within a 145-second worker budget, while the run plans many searches plus direct map/scrape calls. Later custom, advisory, and Morocco passes are routinely skipped when the budget is low.
- Search result attribution is inferred from returned domains rather than the planned source, and the function records only run-level telemetry—not a success/failure result for every configured news source.
- Direct source discovery often has no landing-page link fallback outside the primary sources, and strict date/readability/HEAD checks can silently discard valid publisher results.
- The current custom-source row is a WMO URL, while built-in news registry rows are absent; registry synchronization must preserve admin-added custom sources.

## Scraping repair
- Synchronize the built-in news registry at the start of every news run without overwriting custom sources.
- Replace the one-large-run rotation with deterministic source batches: every source gets a due check, while each invocation processes a bounded batch that fits the provider limit; schedule consecutive batches so all enabled sources are covered daily.
- Use a per-source collection routine with ordered fallbacks: provider search, site map, landing-page link harvest, then direct article scrape. Reuse unseen-URL filtering and preserve real publication dates.
- Track each source in `source_runs` / `source_health`, including method, HTTP/provider status, discovered/accepted/new/rejected counts, and explicit failure reason. A 200 with zero parsed items remains degraded, never healthy.
- Preserve priority treatment for JOC, The Loadstar, major carriers, official authorities, and user-added sources, but prevent them from consuming the entire run budget.
- Refine validation so trusted bot-blocked publishers are accepted when Firecrawl produced coherent article content, while stale, mismatched, index, paywall, and broken-link records remain rejected.
- Keep the 14-day display rule and logistics-impact classification; do not widen stale content into the dashboard.

## Verification and live rescrape
- Add focused tests for country-name resolution/country selection and scraper URL/date/source attribution/fallback behavior.
- Deploy the updated ingestion functions.
- Run controlled forced batches and the downstream analysis/enrichment chain.
- Verify every enabled source has a fresh health/run record, inspect failed/degraded sources individually, and confirm new dashboard items have accurate dates, matching source links, and correct priority.
- Test the holiday calendar interaction in English and French in the browser, including map focus and popup content.

## Technical notes
- Frontend changes will be limited to the holiday calendar/map state and map controls.
- Backend changes will reuse the existing Firecrawl direct-API connection mode and existing Cloud tables/functions; no secrets or new provider are required.
- If provider capacity cannot physically cover all sources in one invocation, coverage will be split into multiple bounded invocations rather than silently skipping sources.
