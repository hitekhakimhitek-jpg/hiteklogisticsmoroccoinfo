// Per-source health + run tracking.
//
// Status is derived from what actually happened, not from `found === 0`:
//   healthy       fetch OK, records parsed, valid records produced
//   no_new_items  fetch OK, parser OK, nothing new published (NOT a failure)
//   degraded      fetch OK but most records invalid, fallback used, or stale
//   broken        repeated fetch/parse failure (HTTP >= 400, timeout, exception)

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ParseStatus = "ok" | "empty" | "parser_failure" | "fetch_failure" | "skipped";
export type HealthStatus = "healthy" | "no_new_items" | "degraded" | "broken" | "unknown";

export interface SourceRunResult {
  sourceName: string;
  sourceUrl?: string;
  sourceType?: string;
  fetchMethod?: string;
  httpStatus?: number;
  pagesRequested?: number;
  itemsDiscovered: number;
  itemsValid?: number;
  itemsNew?: number;
  itemsUpdated?: number;
  itemsDuplicates?: number;
  itemsRejected?: number;
  latestPublicationAt?: string | null;
  startedAt: number;
  /** A real failure (network, HTTP, parser crash). Never set just because nothing was found. */
  error?: string | null;
  /** Set when the raw response parsed but produced no structural records at all. */
  parserEmpty?: boolean;
  fallbackUsed?: boolean;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function describeHttp(status?: number): string {
  if (!status) return "Network error or timeout";
  if (status === 403) return "HTTP 403 — source blocks automated access";
  if (status === 404) return "HTTP 404 — endpoint moved or removed";
  if (status === 410) return "HTTP 410 — endpoint discontinued";
  if (status === 429) return "HTTP 429 — rate limited";
  if (status >= 500) return `HTTP ${status} — source server error`;
  return `HTTP ${status}`;
}

export interface Classification {
  parse: ParseStatus;
  status: HealthStatus;
  failure: boolean;
  reason: string;
}

export function classify(r: SourceRunResult): Classification {
  const valid = r.itemsValid ?? Math.max(0, r.itemsDiscovered - (r.itemsRejected ?? 0));
  const invalid = Math.max(0, r.itemsDiscovered - valid);
  const httpFail = r.httpStatus === 0 || (r.httpStatus !== undefined && r.httpStatus >= 400);

  if (r.error && r.itemsDiscovered === 0) {
    return {
      parse: httpFail || r.httpStatus === undefined ? "fetch_failure" : "parser_failure",
      status: "broken",
      failure: true,
      reason: httpFail ? `${describeHttp(r.httpStatus)}${r.error ? ` (${r.error.slice(0, 80)})` : ""}` : r.error.slice(0, 140),
    };
  }
  if (r.itemsDiscovered === 0) {
    if (r.parserEmpty) {
      return { parse: "parser_failure", status: "degraded", failure: true, reason: "Response received but parser returned no records" };
    }
    return { parse: "empty", status: "no_new_items", failure: false, reason: "Feed valid — no new publications" };
  }
  if (valid === 0) {
    return { parse: "ok", status: "degraded", failure: false, reason: `${r.itemsDiscovered} records found, all failed validation` };
  }
  if (r.fallbackUsed) {
    return { parse: "ok", status: "degraded", failure: false, reason: "Primary feed unavailable — official fallback page used" };
  }
  if (invalid > valid) {
    return { parse: "ok", status: "degraded", failure: false, reason: `${r.itemsDiscovered} records found, ${invalid} failed validation` };
  }
  return {
    parse: "ok",
    status: "healthy",
    failure: false,
    reason: invalid > 0 ? `${valid} valid, ${invalid} rejected (outdated/duplicate/invalid)` : `${valid} valid records`,
  };
}

/** Consecutive real failures before a source is declared broken. */
export const BROKEN_AFTER = 3;

export function finalStatus(c: Classification, consecutiveFailures: number): HealthStatus {
  if (c.failure && consecutiveFailures < BROKEN_AFTER && c.status === "broken") return "degraded";
  if (consecutiveFailures >= BROKEN_AFTER) return "broken";
  return c.status;
}

export async function recordSourceRun(
  db: SupabaseClient,
  runId: string | null,
  r: SourceRunResult,
): Promise<void> {
  const c = classify(r);
  const now = new Date().toISOString();
  const duration = Date.now() - r.startedAt;
  const valid = r.itemsValid ?? Math.max(0, r.itemsDiscovered - (r.itemsRejected ?? 0));

  await db.from("source_runs").insert({
    run_id: runId,
    source_name: r.sourceName,
    started_at: new Date(r.startedAt).toISOString(),
    completed_at: now,
    status: c.failure ? (c.parse === "parser_failure" ? "PARSER_FAILURE" : "SOURCE_DEGRADED") : c.status === "no_new_items" ? "NO_NEW_ITEMS" : "success",
    http_status: r.httpStatus ?? null,
    fetch_method: r.fetchMethod ?? null,
    pages_requested: r.pagesRequested ?? 1,
    items_discovered: r.itemsDiscovered,
    items_new: r.itemsNew ?? 0,
    items_updated: r.itemsUpdated ?? 0,
    items_duplicates: r.itemsDuplicates ?? 0,
    items_rejected: r.itemsRejected ?? 0,
    duration_ms: duration,
    errors: r.error ?? null,
  });

  const { data: prev } = await db
    .from("source_health")
    .select("consecutive_failures, last_success_at, last_item_detected_at, latest_source_publication_at")
    .eq("source_name", r.sourceName)
    .maybeSingle();

  const consecutive = c.failure ? (prev?.consecutive_failures ?? 0) + 1 : 0;
  const lastItemAt = r.itemsDiscovered > 0 ? now : (prev?.last_item_detected_at ?? null);
  const latestPub = r.latestPublicationAt ?? prev?.latest_source_publication_at ?? null;

  await db.from("source_health").upsert(
    {
      source_name: r.sourceName,
      source_url: r.sourceUrl ?? null,
      source_type: r.sourceType ?? null,
      parser_method: r.fetchMethod ?? null,
      http_status: r.httpStatus ?? null,
      parse_status: c.parse,
      status: finalStatus(c, consecutive),
      last_attempt_at: now,
      last_success_at: c.failure ? (prev?.last_success_at ?? null) : now,
      last_item_detected_at: lastItemAt,
      latest_source_publication_at: latestPub,
      items_found_last_run: r.itemsDiscovered,
      items_valid_last_run: valid,
      items_inserted_last_run: r.itemsNew ?? 0,
      items_invalid_last_run: Math.max(0, r.itemsDiscovered - valid),
      latency_ms: duration,
      failure_reason: c.reason,
      fallback_used: r.fallbackUsed ?? false,
      consecutive_failures: consecutive,
      stale: false,
      last_error: r.error ?? null,
    },
    { onConflict: "source_name" },
  );
}
