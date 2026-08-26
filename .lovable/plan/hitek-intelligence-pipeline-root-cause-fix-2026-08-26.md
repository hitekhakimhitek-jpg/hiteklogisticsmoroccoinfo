# Hitek Intelligence Pipeline Root-Cause Fix

## Goal
Replace the current volume-oriented news flow with one auditable Hitek decision-intelligence pipeline. Every visible item must pass article validation and Hitek relevance, have one verified department, a Hitek-specific urgency score, clean content, and a meaningful impact/action. Reprocess current data and regenerate the digest from the same canonical dataset.

## Confirmed root causes
- The quality migration gave every legacy row publishable defaults (`relevance_score=60`, `department_confidence=0.70`, `severity_score=40`, `processing_status=published`), immediately legitimizing unreviewed historical data.
- AI failure is intentionally converted into a publishable heuristic draft. That fallback defaults to Operations, promotes words such as `attack`, `warning`, and `closure`, and generates generic freight/shipment actions. It is the direct cause of the supplied bad examples.
- The enrichment prompt explicitly says to classify irrelevant input rather than reject it. Its deterministic quality rule accepts articles from broad freight keywords and defaults unmatched stories to Operations.
- `fetch-news → news_entries → enrich-intel` and `raw_items → analyze-intel → intelligence_items` can both publish. They use different relevance, department, severity, fallback, and deduplication logic.
- Hazard/event severity uses global logistics impact and broad headline triggers as the displayed Hitek severity. It does not require direct/immediate Hitek exposure.
- Existing article validation misses requested landing-page/title patterns and title cleanup. Deduplication is mostly exact URL.
- The canonical query checks non-empty text but cannot distinguish meaningful enrichment from the legacy fallback strings.
- The frontend mutates IT severity after querying, while digest generation uses stored severity. This creates multiple definitions of the visible dataset.
- Current live evidence: 332 published records in 30 days; 256 contain the unavailable-impact fallback, 56 contain the generic shipment action, and the 14-day canonical set contains 282 items including 24 Critical. The exact supplied examples exist with the incorrect values.
- Scheduling is duplicated: a daily run and eight additional evening batches can feed overlapping paths. Some ingestion runs remain stuck in `running`.

## Implementation

### 1. Make one server-side decision contract
- Replace the permissive shared quality helper with a deterministic, testable decision engine used by both news and hazard/event ingestion.
- Add explicit results: `relevance_status` (`accept`, `review`, `reject`), `relevance_score`, `source_severity`, `hitek_severity`, `hitek_severity_score`, `department`, `department_confidence`, reason codes, and publish eligibility.
- Enforce relevance before classification. Generic AI, tourism/culture, unrelated PR/business news, generic US trucking layoffs, unrelated software, release notes, and non-article pages fail before enrichment.
- Use explicit Hitek geography, corridors, transport modes, compliance themes, industries, commercial opportunities, and enterprise-technology applicability as positive evidence. Freight vocabulary alone is insufficient.

### 2. Enforce department and severity guardrails
- Add deterministic precedence rules so cyber/CVE/software-security stories resolve to IT and vessel/port/route/piracy stories resolve to Operations before AI output is accepted.
- Add Compliance, Commercial, and Finance semantic rules with contradiction checks; prevent incidental money references from assigning Finance.
- Compute Hitek severity independently of publisher language. Headline words such as “critical”, “urgent”, “severe”, “major”, “warning”, or “alert” cannot raise Hitek severity by themselves.
- Require evidence of direct or highly probable exposure plus action within 24 hours for Critical (80–100). Use Important for 55–79, Awareness for 35–54, and reject below 35.
- Cap Commercial at Important. Apply technology usage and active-exploitation evidence to IT severity; unknown usage is Important at most, not-used software is normally rejected, and only confirmed-used/actively exploited or actual Hitek compromise can become Critical.

### 3. Fix enrichment and publication states
- Change the pipeline to `discovered → validated → relevance_checked → classified → enriched → published`, with `rejected_irrelevant`, `rejected_non_article`, `duplicate`, `review_required`, and `enrichment_failed` terminal/holding states.
- Do not convert AI errors, invalid JSON, timeouts, 402/403/429 responses, or missing fields into published generic drafts.
- Allow deterministic enrichment only when it produces a complete, rule-specific impact and action; otherwise hold the record as `enrichment_failed`/`review_required`.
- Generate impact first, then derive a department-specific action from that impact. Customer/shipment notification is allowed only when likely shipment exposure and credible service impact are present.
- Block publication when impact/action/classification is missing, generic, contradictory, or contains known fallback text.

### 4. Clean and validate articles
- Add shared canonical URL, clean-title, clean-summary, article-evidence, and non-article detection utilities.
- Strip markdown headings, author fragments, HTML/table/navigation/image artifacts, `.svg` debris, tracking text, and repeated source suffixes.
- Reject requested landing patterns and titles, including white papers, reports hubs, magazines, directories, categories/tags/topics, media kits, newsletters, release notes, search, author, feedback pages, and not-found pages unless strong dated article metadata proves otherwise.
- Deduplicate by canonical URL, normalized source/title, and conservative title similarity; retain a single best/corroborated record.

### 5. Add the Hitek technology profile
- Create an admin-only `hitek_technologies` table with technology name, aliases, usage state (`used`, `not_used`, `unknown`), notes, and timestamps.
- Add secure grants/RLS using the existing Hitek-admin rule; backend functions may read it, only Hitek admins may manage it.
- Add a Settings section to configure the list and use it in IT relevance/severity decisions. Seed examples as `unknown`, never as assumed-used.

### 6. Consolidate publication paths and schedules
- Route both collected news and hazard/event records through the shared validation, relevance, classification, severity, enrichment, and publication gate.
- Remove `classify-sections` from publication decisions and prevent either legacy path from inserting directly as published.
- Keep one coordinated daily 09:00 Morocco ingestion orchestration with bounded source batches, a durable lease, explicit stage telemetry, stale-run recovery, and downstream digest/report generation only after processing completes.
- Preserve hazard collection where needed, but make it feed the same decision gate rather than a separate severity system.

### 7. Canonical query, counts, map, and digest
- Strengthen `canonical_intelligence` so only clean, complete, accepted, enriched, published records are returned, excluding known placeholders and invalid article pages.
- Store the final Hitek severity in the database; remove frontend severity mutation.
- Derive cards, KPI totals, department counts, map markers, and digest source rows from the same canonical result and date bounds. Use the canonical counts function for aggregate validation and assert total equals the three severity bands.
- Regenerate weekly digests only after reprocessing, using the cleaned canonical records and Morocco week bounds.

### 8. Reprocess current data safely
- Snapshot before-metrics for all active records from the last 30 days.
- Move every candidate out of `published`, rerun article validation, cleanup, deduplication, relevance, department, Hitek severity, and enrichment, then republish only qualifying records.
- Preserve rejected/review/failed records for audit instead of deleting them.
- Record before/after status, department, and severity so the final report can state rejected, reclassified, and Critical counts.
- Regenerate the current weekly digest after the canonical set is finalized.

### 9. Regression and live acceptance verification
- Add table-driven tests for the exact ten supplied stories, including technology states for Elementor/Zimbra, and assert department, relevance status, Hitek severity bounds, and action language.
- Add tests for publisher-severity isolation, landing-page blocking, title cleanup, publication completeness, maritime/cyber contradiction guards, and count reconciliation.
- Deploy and invoke changed functions, inspect function logs/results, and query the reprocessed database.
- Open the dashboard, map, Settings technology profile, and weekly digest. Verify every acceptance condition, including no generic cyber under Operations, no maritime attack under IT, no fallback enrichment, no landing/noise/dirty-title records, meaningful impacts/actions, rare evidence-based Critical items, synchronized surfaces, and exact count reconciliation.
- Report root causes, changed files/functions, rejected and reclassified totals, remaining Critical count, final severity/department counts, and all regression results.

## Technical changes
- Database migration: extend processing/relevance fields and enums, add technology profile and reprocessing audit support, strengthen canonical functions/indexes, and update schedule orchestration. All new public tables include grants, RLS, and admin policies.
- Backend: refactor `_shared/intel-quality.ts`; add shared article normalization/decision helpers; update `fetch-news`, `enrich-intel`, `analyze-intel`, and `generate-weekly-digest`; add deterministic tests.
- Frontend: remove client severity clamping/fallback assumptions, consume stored canonical decisions, and add the admin technology-profile control to Settings.
