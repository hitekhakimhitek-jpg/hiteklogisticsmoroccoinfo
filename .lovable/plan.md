# Global Logistics Intelligence Scraper — Phased Upgrade

Turning the dashboard from "what logistics articles were published today" into a worldwide early-warning system. This is a large program, so it is split into phases that each ship something working. Nothing existing is removed.

## Current state (from the audit pass)

- Ingestion is essentially one big function (`fetch-news`, ~1500 lines) that goes through a single provider (Firecrawl search/map/scrape) for every source. There is no per-source fetch method, so a source that publishes an RSS, CAP or JSON feed is still discovered via web search.
- Hazards come only from GDACS RSS (`sync-hazard-alerts`), matched against a hardcoded list of 34 hubs. No JTWC / WMO / NMC / JMA / NHC / PAGASA ingestion at all — which is exactly the gap in the example.
- Run telemetry exists (`ingestion_runs`) but is per-run, not per-source: a source can return HTTP 200 with zero parsed items and nothing is recorded as broken.
- Relevance filtering happens during collection (URL/keyword rejection before storage), so information is discarded before it is ever analysed.
- There is one severity score, no separate global-impact vs Hitek-relevance, no event clustering (same storm from 4 agencies = 4 cards), and no forecast/watch/resolved status.

## Phase 1 — Source registry + health tracking (foundation)

- New `sources` table: name, url, type, tier, fetch method, polling interval, enabled.
- New `source_health` table with the requested fields (last attempt/success/item detected, http status, parse status, parser method, consecutive failures, stale flag, last error) and `source_runs` for per-source run logging.
- Seed it with every source currently configured in the code so nothing is lost.
- Hard rule wired in from the start: HTTP 200 + zero parsed items = `PARSER_FAILURE`, never "success".

## Phase 2 — Multi-method collector

- A collector layer with adapters tried in the documented order: JSON/API → RSS/Atom/XML/CAP → sitemap → semantic HTML (JSON-LD, OpenGraph, `<article>`) → Firecrawl scrape → flag for review.
- Per-source polling intervals, conditional requests (ETag / Last-Modified), and URL-level dedup so re-fetching is cheap.
- `fetch-news` keeps working and becomes one collector among several.

## Phase 3 — Weather & natural-hazard collector (the priority gap)

- Dedicated `collect-hazards` function with source-specific adapters: JTWC (raw TC warning text + tracks), NOAA/NHC (CAP + JSON), JMA/RSMC Tokyo, WMO SWIC, China NMC, PAGASA, HKO, Taiwan CWA, IMD, Australian BoM, plus existing GDACS.
- Parses advisories, not articles: storm name, position, forecast track, max wind, warning level, affected area.
- Multilingual: original + translated title/summary, detected language stored.

## Phase 4 — Geographic risk engine

- `logistics_infrastructure` table: ports, terminals, airports, industrial zones, border crossings, rail/road corridors, canals, straits and chokepoints (Suez, Panama, Hormuz, Malacca, Bab el-Mandeb, Bosporus, Gibraltar, Taiwan Strait, Channel).
- Geospatial matching of hazard positions and forecast tracks against that infrastructure, producing affected ports / airports / lanes / industrial regions with a confidence value.

## Phase 5 — Intelligence pipeline (collect first, filter second)

- Raw collection stored before any relevance judgement; analysis runs as a separate stage.
- Structured-JSON LLM analysis returning `relevant`, `event_type`, `event_status` (actual / emerging / forecast / watch / resolved), `global_logistics_impact_score`, `hitek_relevance_score`, severity, confidence, countries, infrastructure, transport modes, summary, logistics impact, next watchpoint — schema-validated, malformed responses rejected and retried.
- Second-order reasoning prompt (typhoon + Ningbo = relevant even with no mention of "supply chain").
- Score → severity bands (80+/55+/35+) plus hard overrides for chokepoint closures, major port closures, imminent cyclone threat to a port cluster, large multi-day strikes, customs system failures, logistics cyberattacks.
- Early-warning override so a high-confidence short-horizon forecast can reach Critical before disruption occurs.

## Phase 6 — Event clustering & updates

- `events` table: reports from JTWC + JMA + NMC + Reuters + a carrier advisory collapse into one supply-chain event with best title, latest status, sources, source count, first detected, last updated.
- Updates (track shift, intensity change, port suspension) update the event and recalculate severity instead of being dropped as duplicates; event history is kept.
- `EVENT_SEVERITY` and `SOURCE_CONFIDENCE` stay separate — extra corroborating sources raise confidence, not severity.

## Phase 7 — Frontend

- Event cards answer: what happened / where / why it matters / when / what could be affected / what to watch. Existing design and the Operations / Compliance / Finance / Commercial / IT categories are preserved, with multi-category support.
- Admin Source Coverage view (green / amber / red) on the settings page showing per-source status, last check, last successful extraction, latest item, item count and last error.

## Phase 8 — Tests, backfill, validation report

- Source reachability tests, parser fixture tests (fixtures stored; zero records = failing test), intelligence classification tests, dedup and update tests.
- The specific weather regression test: an official cyclone advisory with no newspaper coverage must be detected → ingested → parsed → geolocated → exposure-matched → scored → displayed.
- 72-hour backfill from high-priority sources through clustering and scoring.
- Final validation report with the requested counts, the source-by-source table, and 10 worked examples explaining each severity.

## Notes

- No paywalls, CAPTCHAs or authentication are bypassed; rate limits are respected and official feeds are preferred over scraping.
- Phases 1-3 are where the current failure actually lives, so they deliver most of the visible improvement.
