# Hitek Intelligence Reliability and Data-Quality Overhaul

## Goal
Make the existing dashboard a smaller, trustworthy decision feed by consolidating its current collection, classification, enrichment, aggregation, and reporting paths around `intelligence_items`. Preserve the current visual design except for a compact admin quality view and necessary count/digest metadata.

## Audit findings to address
- Two partially overlapping paths currently publish cards: `news_entries → enrich-intel → intelligence_items` and `raw_items → analyze-intel → supply_chain_events/intelligence_items`. Their prompts, thresholds, department rules, severity rules, deduplication, and fallback behavior disagree.
- The non-AI fallback defaults too easily to Operations, assigns generic shipment actions, and can publish “Automatic summary unavailable.”
- Article validation is URL/text heuristic-based and misses canonical/schema/article metadata; deduplication is mostly exact URL only.
- `intelligence_items` lacks the requested relevance, classification-confidence, severity-score, processing-state, decision-reason, and processing-error fields.
- The feed and KPI counts run separate broad queries and then repeat filtering/clamping in the browser. Active department filters do not update the KPI query.
- The weekly digest uses `created_at`, UTC week boundaries, category buckets, and cached rows that are not tied to the same canonical visible-record query as the feed.
- Recent production data contains implausible classifications and severities; current 14-day totals include unusually many Critical records.
- Source tiers exist, but are not consistently used in acceptance, classification confidence, or ranking. Several low-value generic IT sources are still queried broadly.
- Automation is bounded by worker time, but lacks a durable single-flight lease/circuit-breaker state across the full chained pipeline; downstream failures can leave stages inconsistent.

## Implementation

### 1. Canonical quality schema and database query layer
- Extend `intelligence_items` with:
  - `relevance_score` (0–100)
  - `department_confidence` (0–1)
  - `severity_score` (0–100)
  - `classification_reason`
  - `processing_status` (`discovered`, `rejected_irrelevant`, `rejected_non_article`, `duplicate`, `processing`, `enriched`, `published`, `failed`, `review_required`)
  - `processing_error`, `canonical_url`, `source_tier`, and `ingested_at`
- Add matching quality/decision fields to the staging record where needed so rejected and review-required candidates remain auditable without becoming public cards.
- Add constraints and indexes for score ranges, canonical URL, processing status, publication date, and feed filters.
- Add a canonical database function for visible intelligence: published, complete, verified, relevance >= 60, confidence >= 0.70, non-archived, and inside the requested publication-date range.
- Add a canonical aggregation function using exactly the same predicates and optional department/severity filters. The feed, map, KPI cards, and weekly digest will use this shared database contract.
- Add an `Africa/Casablanca` week-boundary helper and return start/end dates with digest records.
- Add a durable pipeline-control/lease record for single-flight execution, pause reason, retry state, and last successful stage. Keep all admin-only telemetry protected by existing Hitek admin access rules.

### 2. One shared decision engine, not a parallel pipeline
- Create a shared server-side quality module used by `fetch-news`, `enrich-intel`, and `analyze-intel` for:
  - URL normalization/canonicalization and landing-page rejection
  - source tier lookup
  - deterministic relevance pre-screening and Hitek geography/corridor/industry boosts
  - strict single-primary-department guardrails
  - severity scoring and hard caps
  - department-specific action generation
  - required-field validation and publish eligibility
  - normalized duplicate-title similarity checks
- Keep the current collectors and event clustering, but route all candidate publication decisions through the same quality contract.
- Stop `classify-sections` from acting as a competing classification path; retain only any still-used legacy scoring behavior until callers are migrated, then remove its publication influence.

### 3. Strong article and duplicate validation
- Reject known landing/listing/search/marketing/author/archive paths, including white papers, magazine, media kit, special reports, feedback portals, and source homepages.
- Require a credible combination of title, body length, publication metadata, canonical URL, author/publisher metadata, and Article/NewsArticle schema signals.
- Store canonical URLs and deduplicate by canonical URL, normalized source + title, and conservative title similarity. Keep syndicated versions only when they add material information or stronger authority.
- Record rejection/duplicate reasons and source-run metrics instead of silently dropping candidates.

### 4. Relevance, department, severity, and action quality
- Replace broad prompts with a strict structured classification contract using title, content, source, URL, source tier, metadata, geography, and infrastructure exposure.
- Publish automatically only at relevance >= 60 and department confidence >= 0.70. Keep 40–59 or low-confidence candidates as `review_required`; reject below 40.
- Enforce one primary department with deterministic contradiction guards:
  - maritime/transport disruption cannot become IT
  - enterprise cyber/software risk cannot become Operations unless the affected object is a logistics operating system
  - tourism, museums, generic AI, consumer tech, generic release notes, opinion, and marketing content are rejected without a specific Hitek impact
- Build severity from relevance, immediacy, proximity/corridor exposure, probability/confidence, operational scale, deadlines, financial exposure, and active cyber exploitation.
- Require Critical to represent realistic action within 24 hours. Preserve the existing IT cap, with Critical allowed only for actively exploited/core-service incidents that plausibly affect Hitek now.
- Generate department-specific recommended actions from strict templates plus article facts. Use “Monitor only — no immediate operational action required.” where no concrete action exists.

### 5. Resilient enrichment and job execution
- Generate a maximum two-sentence summary, concrete Hitek impact, department-specific action, explicit time horizon, geography, affected mode, and decision reasons.
- Use bounded retry with backoff for retryable AI failures, then a smaller simplified request, then a deterministic department-aware fallback. Never publish the current “Automatic summary unavailable” placeholder.
- Persist enrichment failures separately and move incomplete results to `failed`/`review_required` rather than exposing them.
- Add durable single-flight locking, bounded batch sizes, idempotent progress, and persisted circuit-breaker behavior for 402/403/repeated 429 responses across scheduled and chained entry points.
- Gate downstream calls on actual remaining work and record every stage outcome in ingestion telemetry.

### 6. Canonical feed, map, counts, and weekly digest
- Replace browser-side visibility filters and severity overrides with the canonical backend feed function.
- Make dashboard counts accept the active department/severity/date filters and derive from the same canonical predicate; verify Total = Critical + Important + Awareness.
- Make the map consume the same canonical records and date range as the dashboard, plotting records with stored or validated inferred geography without inventing extra news.
- Rebuild weekly digest generation around `Africa/Casablanca` boundaries and publication dates, not `created_at` UTC boundaries.
- Store and display digest start date, end date, accepted total, Critical, Important, and Awareness counts. Before emitting “Quiet period,” query the canonical dataset for that exact range.
- Preserve Global → Operational → Financial display order while ensuring all summaries are generated only from accepted canonical records.

### 7. Admin quality view
- Add an admin-only Quality section (within the existing Settings/admin area or a dedicated protected route) showing:
  - per-item scores, department/confidence, severity score, reasons, source/tier/URL, status, duplicate/rejection details, ingestion and publication timestamps, and errors
  - last-24-hour discovered, accepted, rejected, duplicate, failed, and review counts
  - enrichment success %, low-confidence %, irrelevant rejection %, duplicate %, and articles by department
  - pipeline/source health and last successful run
- Keep this out of the normal management feed.

### 8. Automated validation tests
- Extract pure quality rules into testable modules and add 25+ table-driven cases covering every supplied example plus ambiguous cross-department, landing-page, low-confidence, duplicate, severity, and action cases.
- Add database/query consistency tests for canonical visibility, filtered counts, 14-day bounds, and Casablanca week boundaries.
- Add function-level tests for AI failure fallback and processing-state transitions.

### 9. Reprocess recent data safely
- Snapshot/audit current active records, then re-run the last 14 days through the new shared relevance, department, severity, impact, and action rules.
- Archive/reclassify landing pages, irrelevant stories, malformed records, weak-confidence items, and duplicates; retain useful history rather than deleting it.
- Regenerate the current weekly digest from the cleaned canonical records.
- Compare before/after samples and metrics, specifically validating maritime attacks, Microsoft/CISA vulnerabilities, ICS2, Morocco investments, tourism noise, JOC landing pages, and port strikes.

## Verification
- Run all new quality and function tests.
- Deploy and directly invoke each changed backend function; inspect the response and function logs.
- Query recent records to confirm required fields, thresholds, unique primary departments, credible Critical items, and no visible incomplete states.
- Reconcile feed totals, severity totals, department totals, map records, and weekly digest counts for the same date window.
- Exercise the dashboard and protected admin quality view in the browser at desktop and mobile widths.
- Confirm the scheduled chain, lease behavior, last-success timestamps, and current digest in the live backend.
