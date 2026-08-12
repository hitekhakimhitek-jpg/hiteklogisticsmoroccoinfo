// Per-source health + run tracking.
//
// Hard rule (non-negotiable): HTTP 200 with zero parsed items is NEVER a
// success. It is recorded as PARSER_FAILURE / SOURCE_DEGRADED so a broken
// source can never stay silently broken.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ParseStatus = "ok" | "empty" | "parser_failure" | "fetch_failure" | "skipped";
export type HealthStatus = "healthy" | "degraded" | "broken" | "stale" | "unknown";

export interface SourceRunResult {
  sourceName: string;
  sourceUrl?: string;
  sourceType?: string;
  fetchMethod?: string;
  httpStatus?: number;
  pagesRequested?: number;
  itemsDiscovered: number;
  itemsNew?: number;
  itemsUpdated?: number;
  itemsDuplicates?: number;
  itemsRejected?: number;
  latestPublicationAt?: string | null;
  startedAt: number;
  error?: string | null;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function classify(r: SourceRunResult): { parse: ParseStatus; status: HealthStatus } {
  if (r.error && r.itemsDiscovered === 0) {
    const fetchFail = r.httpStatus === undefined || r.httpStatus >= 400 || r.httpStatus === 0;
    return { parse: fetchFail ? "fetch_failure" : "parser_failure", status: "broken" };
  }
  if (r.itemsDiscovered === 0) {
    // HTTP OK but nothing extracted → degraded, never "healthy".
    if (r.httpStatus && r.httpStatus < 400) return { parse: "parser_failure", status: "degraded" };
    return { parse: "fetch_failure", status: "broken" };
  }
  return { parse: "ok", status: "healthy" };
}

/** Age (hours) past which a source with no new item is considered stale. */
function staleHours(sourceType?: string): number {
  switch (sourceType) {
    case "weather":
    case "hazard":
      return 12;
    case "carrier":
    case "authority":
      return 96;
    default:
      return 72;
  }
}

export async function recordSourceRun(
  db: SupabaseClient,
  runId: string | null,
  r: SourceRunResult,
): Promise<void> {
  const { parse, status } = classify(r);
  const now = new Date().toISOString();
  const duration = Date.now() - r.startedAt;

  await db.from("source_runs").insert({
    run_id: runId,
    source_name: r.sourceName,
    started_at: new Date(r.startedAt).toISOString(),
    completed_at: now,
    status: parse === "ok" ? "success" : parse === "parser_failure" ? "PARSER_FAILURE" : "SOURCE_DEGRADED",
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

  const ok = parse === "ok";
  const consecutive = ok ? 0 : (prev?.consecutive_failures ?? 0) + 1;
  const lastItemAt = r.itemsDiscovered > 0 ? now : (prev?.last_item_detected_at ?? null);
  const latestPub = r.latestPublicationAt ?? prev?.latest_source_publication_at ?? null;

  const ageMs = lastItemAt ? Date.now() - new Date(lastItemAt).getTime() : Infinity;
  const stale = ageMs > staleHours(r.sourceType) * 3600_000;

  let finalStatus: HealthStatus = status;
  if (ok && stale) finalStatus = "stale";
  if (consecutive >= 3) finalStatus = "broken";

  await db.from("source_health").upsert(
    {
      source_name: r.sourceName,
      source_url: r.sourceUrl ?? null,
      source_type: r.sourceType ?? null,
      parser_method: r.fetchMethod ?? null,
      http_status: r.httpStatus ?? null,
      parse_status: parse,
      status: finalStatus,
      last_attempt_at: now,
      last_success_at: ok ? now : (prev?.last_success_at ?? null),
      last_item_detected_at: lastItemAt,
      latest_source_publication_at: latestPub,
      items_found_last_run: r.itemsDiscovered,
      consecutive_failures: consecutive,
      stale,
      last_error: r.error ?? null,
    },
    { onConflict: "source_name" },
  );
}
