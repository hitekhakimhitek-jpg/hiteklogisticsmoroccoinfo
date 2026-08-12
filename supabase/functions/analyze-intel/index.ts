// Intelligence pipeline — the stage AFTER collection.
//
//   raw_items → normalize → logistics impact analysis → severity scoring →
//   event clustering → intelligence_items (dashboard)
//
// Collection never decides what matters. Everything is captured first and
// judged here, so an official cyclone advisory that never mentions the words
// "supply chain" can still reach the dashboard as a critical early warning.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireHitekAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/health.ts";
import { loadInfrastructure, exposureFromText, Infra } from "../_shared/geo.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-2.5-flash";

type Severity = "act_now" | "this_week" | "awareness";
type Department = "operations" | "compliance" | "finance" | "commercial" | "it";

interface Analysis {
  relevant: boolean;
  event_type: string;
  event_status: "actual_disruption" | "emerging_risk" | "forecast_risk" | "watch" | "resolved";
  global_logistics_impact_score: number;
  hitek_relevance_score: number;
  severity: "critical" | "important" | "awareness";
  confidence: "high" | "medium" | "low";
  countries: string[];
  infrastructure: string[];
  transport_modes: string[];
  departments: Department[];
  event_key: string;
  event_name: string;
  summary: string;
  logistics_impact: string;
  next_watchpoint: string;
  what_happened: string;
  reasoning_short: string;
}

const SYSTEM_PROMPT = `You are the intelligence analyst for Hitek Logistic, an international freight-forwarding company based in Morocco.

Your job is NOT to ask "does this text mention logistics?". It is to reason:
"Could the event described here materially affect the movement, availability, cost, timing or legality of goods anywhere in the world?"

Reason about SECOND-ORDER EFFECTS. Examples that ARE relevant even without the word logistics:
- Typhoon forecast near Ningbo/Shanghai -> port, vessel, trucking and factory impact
- Flooding on the German Rhine -> barge capacity, inland freight
- Earthquake near Taiwan semiconductor plants -> component supply
- Strike in Rotterdam -> terminal throughput
- Drone attacks in the Red Sea -> routing, insurance, transit time
- Low water in the Panama Canal -> transits, freight rates
- Cyberattack on a customs platform -> clearance delays

Return TWO INDEPENDENT scores 0-100:
- global_logistics_impact_score: worldwide supply-chain importance
- hitek_relevance_score: importance specifically for a Morocco-based forwarder trading with Europe, the Mediterranean, Asia and North America
A disruption in Singapore can be globally critical even if Morocco relevance is moderate. Never conflate them.

Judge severity from: operational seriousness, geographic importance of the node, how far disruption can propagate, time to impact, confidence, expected duration, exposure across vessels/ports/trucking/rail/air/factories/inventory/customs, and source authority.

EARLY WARNING: a high-confidence official forecast may be critical BEFORE disruption occurs when time to impact is short and exposed infrastructure is strategically significant. Do not wait for a port to close.

FALSE POSITIVES: a tropical storm over open ocean with no infrastructure exposure is low relevance. The same storm crossing a major port cluster is critical.

event_key: a short stable slug identifying the underlying real-world event (e.g. "typhoon-koinu-east-china", "rotterdam-dockworker-strike-2026"). Reports from different agencies about the SAME event MUST produce the SAME key.

Return STRICT JSON only, no prose, no markdown.`;

function schemaPrompt(): string {
  return `Respond with exactly this JSON shape:
{"relevant":boolean,"event_type":string,"event_status":"actual_disruption"|"emerging_risk"|"forecast_risk"|"watch"|"resolved","global_logistics_impact_score":0-100,"hitek_relevance_score":0-100,"severity":"critical"|"important"|"awareness","confidence":"high"|"medium"|"low","countries":string[],"infrastructure":string[],"transport_modes":string[],"departments":("operations"|"compliance"|"finance"|"commercial"|"it")[],"event_key":string,"event_name":string,"summary":string,"logistics_impact":string,"next_watchpoint":string,"what_happened":string,"reasoning_short":string}`;
}

function validate(o: unknown): Analysis | null {
  if (!o || typeof o !== "object") return null;
  const a = o as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 100 ? Math.round(v) : null);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") as string[] : []);
  const g = num(a.global_logistics_impact_score);
  const h = num(a.hitek_relevance_score);
  if (typeof a.relevant !== "boolean" || g === null || h === null) return null;
  if (!["actual_disruption", "emerging_risk", "forecast_risk", "watch", "resolved"].includes(String(a.event_status))) return null;
  if (!["critical", "important", "awareness"].includes(String(a.severity))) return null;
  if (typeof a.event_key !== "string" || !a.event_key.trim()) return null;
  const deps = arr(a.departments).filter((d) =>
    ["operations", "compliance", "finance", "commercial", "it"].includes(d)
  ) as Department[];
  return {
    relevant: a.relevant,
    event_type: String(a.event_type ?? "other"),
    event_status: a.event_status as Analysis["event_status"],
    global_logistics_impact_score: g,
    hitek_relevance_score: h,
    severity: a.severity as Analysis["severity"],
    confidence: (["high", "medium", "low"].includes(String(a.confidence)) ? a.confidence : "medium") as Analysis["confidence"],
    countries: arr(a.countries),
    infrastructure: arr(a.infrastructure),
    transport_modes: arr(a.transport_modes),
    departments: deps.length ? deps : ["operations"],
    event_key: a.event_key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 120),
    event_name: String(a.event_name ?? "").slice(0, 200),
    summary: String(a.summary ?? "").slice(0, 2000),
    logistics_impact: String(a.logistics_impact ?? "").slice(0, 2000),
    next_watchpoint: String(a.next_watchpoint ?? "").slice(0, 500),
    what_happened: String(a.what_happened ?? "").slice(0, 1000),
    reasoning_short: String(a.reasoning_short ?? "").slice(0, 500),
  };
}

async function analyze(input: Record<string, unknown>): Promise<Analysis | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${schemaPrompt()}\n\nINPUT:\n${JSON.stringify(input).slice(0, 12000)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429 || res.status === 402) {
      throw new Error(`ai gateway ${res.status}`);
    }
    if (!res.ok) continue;
    const json = await res.json();
    try {
      const parsed = validate(JSON.parse(json.choices?.[0]?.message?.content ?? "{}"));
      if (parsed) return parsed;
    } catch { /* malformed → retry once, never accepted */ }
  }
  return null;
}

// ---------- deterministic overrides ----------

const CHOKEPOINTS = /(suez|panama canal|hormuz|bab el-mandeb|bab al-mandab|malacca|gibraltar|bosporus|bosphorus|taiwan strait|red sea)/i;

interface OverrideResult { score: number; severity: Severity; reason: string | null }

function bandToSeverity(score: number): Severity {
  if (score >= 80) return "act_now";
  if (score >= 55) return "this_week";
  return "awareness";
}

function applyOverrides(a: Analysis, text: string, exposure: { maxImportance: number; ports: string[] }): OverrideResult {
  let score = a.global_logistics_impact_score;
  let reason: string | null = null;
  const t = text.toLowerCase();

  const hard: Array<[boolean, string]> = [
    [CHOKEPOINTS.test(t) && /(closed|closure|blocked|suspend|halt|attack|struck|restrict)/.test(t), "strategic chokepoint disruption"],
    [/(port|terminal)/.test(t) && /(closed|closure|shut|suspend operations|halt operations)/.test(t) && exposure.maxImportance >= 75, "major port closure"],
    [/(strike|industrial action|walkout)/.test(t) && /(day|week|indefinite|multi)/.test(t) && exposure.maxImportance >= 70, "large multi-day transport strike"],
    [/(customs|border|clearance)/.test(t) && /(outage|down|failure|offline|suspend)/.test(t), "customs / border system failure"],
    [/(cyberattack|ransomware|hacked|cyber incident)/.test(t) && /(port|terminal|carrier|customs|airport|logistics)/.test(t), "cyberattack on logistics infrastructure"],
    [/(earthquake|tsunami)/.test(t) && exposure.maxImportance >= 80, "major earthquake near strategic infrastructure"],
    [/(ban|prohibition|embargo|sanction)/.test(t) && /(immediate|with immediate effect|effective immediately)/.test(t), "immediate-effect regulatory prohibition"],
  ];
  for (const [hit, why] of hard) {
    if (hit) { score = Math.max(score, 85); reason = why; break; }
  }

  // Early-warning override: high-confidence short-horizon forecast against
  // significant exposure can be critical before the disruption happens.
  if (
    !reason &&
    (a.event_status === "forecast_risk" || a.event_status === "emerging_risk") &&
    a.confidence === "high" &&
    exposure.maxImportance >= 75 &&
    a.global_logistics_impact_score >= 60
  ) {
    score = Math.max(score, 80);
    reason = "early-warning override: high-confidence forecast against major infrastructure";
  }
  return { score, severity: bandToSeverity(score), reason };
}


// ---------- routine local weather ----------
// Met agencies publish hundreds of short-lived local advisories a day. They are
// real, but they are business-as-usual: they must collapse into a single
// recurring event per country and normally stay below the display threshold.
const ROUTINE_WEATHER = /(heavy rain|extreme rainfall|thundery|thunderstorm|storm warning|severe weather warning|shower|lightning|wind advisory|strong wind|gale|fog|mist|haze|heat ?wave|canicule|extreme heat|heat (advisory|warning)|high temperature|frost|snow(fall)? warning|dust|hail|smog|air quality|cold wave|rainfall (yellow|blue|orange))/i;
const NON_ROUTINE = /(typhoon|hurricane|tropical cyclone|storm surge|red (alert|warning)|black rainstorm|evacuat|state of emergency|port (closed|closure|suspend)|airport clos|flood emergency|tsunami|earthquake|landfall|signal no\.? ?[89]|super typhoon)/i;

function isRoutineWeather(a: Analysis, text: string): boolean {
  if (/(strike|cyber|sanction|tariff|customs|conflict|attack|closure)/i.test(a.event_type)) return false;
  if (NON_ROUTINE.test(text)) return false;
  return ROUTINE_WEATHER.test(text);
}

function routineClusterKey(a: Analysis): string {
  const country = (a.countries?.[0] ?? "global").toLowerCase().replace(/[^a-z]+/g, "-");
  const family = /heat ?wave|canicule|extreme heat|high temperature/i.test(a.summary ?? "")
    ? "heat"
    : /snow|frost|cold/i.test(a.summary ?? "")
    ? "cold"
    : /wind|gale|storm/i.test(a.summary ?? "")
    ? "wind"
    : "rain";
  return `routine-weather:${country}:${family}`;
}

function horizon(status: Analysis["event_status"]): string {
  switch (status) {
    case "actual_disruption": return "today";
    case "emerging_risk": return "this_week";
    case "forecast_risk": return "this_week";
    case "watch": return "this_month";
    default: return "horizon";
  }
}

function confidenceScore(sourceCount: number, base: Analysis["confidence"]): number {
  const b = base === "high" ? 75 : base === "medium" ? 55 : 35;
  return Math.min(100, b + Math.max(0, sourceCount - 1) * 8);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireHitekAdmin(req);
  if (denied) return denied;

  const db = serviceClient();
  let limit = 40;
  let sinceHours = 336; // 14 days
  try {
    const body = await req.json();
    if (Number.isFinite(body?.limit)) limit = Math.min(Math.max(1, Number(body.limit)), 120);
    if (Number.isFinite(body?.since_hours)) sinceHours = Math.min(Math.max(1, Number(body.since_hours)), 720);
  } catch { /* defaults */ }

  const infra: Infra[] = await loadInfrastructure(db);
  const cutoff = new Date(Date.now() - sinceHours * 3600_000).toISOString();

  // Pull a wider candidate pool than we can afford to send to the model, then
  // rank deterministically so the most logistics-exposed items go first.
  const { data: pool, error } = await db
    .from("raw_items")
    .select("*")
    .eq("analysis_status", "pending")
    .gte("collected_at", cutoff)
    .order("collected_at", { ascending: false })
    .limit(Math.min(600, limit * 10));
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  // ---------- deterministic pre-screen (keeps LLM spend sane) ----------
  // Local weather warnings for places with no logistics infrastructure nearby
  // and no strategic vocabulary can never clear the display threshold.
  const STRATEGIC = /(port|terminal|harbou?r|airport|canal|strait|shipping|vessel|container|freight|cargo|rail|highway|customs|border|strike|typhoon|hurricane|cyclone|tsunami|earthquake|blockade|sanction|tariff|closure|closed|suspend|evacuat|red alert|orange alert|severe|extreme)/i;

  type Ranked = { row: Record<string, unknown>; score: number; exp: ReturnType<typeof exposureFromText>; geo: Record<string, unknown> };
  const ranked: Ranked[] = [];
  const prescreened: string[] = [];

  for (const row of pool ?? []) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const geoExposure = (payload.exposure ?? {}) as Record<string, unknown>;
    const text = `${row.original_title} ${row.original_summary ?? ""}`;
    const exp = exposureFromText(infra, text);
    const importance = Math.max(Number(geoExposure.max_importance ?? 0), exp.maxImportance);
    const hasExposure = importance > 0 ||
      (geoExposure.ports as string[] ?? []).length > 0 ||
      (geoExposure.airports as string[] ?? []).length > 0 ||
      (geoExposure.lanes as string[] ?? []).length > 0;
    if (!hasExposure && !STRATEGIC.test(text)) {
      prescreened.push(row.id as string);
      continue;
    }
    const tier = Number(payload.tier ?? 3);
    ranked.push({
      row,
      exp,
      geo: geoExposure,
      score: importance * 2 + (STRATEGIC.test(text) ? 20 : 0) + (tier === 1 ? 15 : 0),
    });
  }

  if (prescreened.length) {
    for (let i = 0; i < prescreened.length; i += 200) {
      await db.from("raw_items")
        .update({ analysis_status: "rejected", rejection_reason: "no logistics infrastructure exposure (pre-screen)", impact_score: 0 })
        .in("id", prescreened.slice(i, i + 200));
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const pending = ranked.slice(0, limit).map((r) => r.row);

  const stats = { processed: 0, pre_screened: prescreened.length, relevant: 0, rejected: 0, events_created: 0, events_updated: 0, items_written: 0, failed: 0 };
  const examples: Array<Record<string, unknown>> = [];
  const deadline = Date.now() + 130_000;

  for (const row of pending ?? []) {
    if (Date.now() > deadline) break;
    stats.processed++;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const text = `${row.original_title} ${row.original_summary ?? ""} ${row.body ?? ""}`.slice(0, 12000);
    const geoExposure = (payload.exposure ?? {}) as Record<string, unknown>;
    const textExposure = exposureFromText(infra, text);
    const ports = [...new Set([...(geoExposure.ports as string[] ?? []), ...textExposure.ports])];
    const airports = [...new Set([...(geoExposure.airports as string[] ?? []), ...textExposure.airports])];
    const lanes = [...new Set([...(geoExposure.lanes as string[] ?? []), ...textExposure.lanes])];
    const industrial = [...new Set([...(geoExposure.industrial as string[] ?? []), ...textExposure.industrial])];
    const maxImportance = Math.max(Number(geoExposure.max_importance ?? 0), textExposure.maxImportance);
    const maxHitek = Math.max(Number(geoExposure.max_hitek_relevance ?? 0), textExposure.maxHitekRelevance);

    let a: Analysis | null = null;
    try {
      a = await analyze({
        headline: row.original_title,
        description: row.original_summary,
        body: (row.body ?? "").slice(0, 6000),
        source: row.source_name,
        source_type: row.source_type,
        source_tier: payload.tier ?? 3,
        publication_time: row.published_at,
        language: row.source_language,
        countries: row.countries,
        coordinates: row.latitude !== null ? { lat: row.latitude, lon: row.longitude } : null,
        hazard_type: payload.hazard_type ?? null,
        maximum_wind_kt: payload.maximum_wind ?? null,
        forecast_track: payload.forecast_track ?? [],
        exposed_infrastructure: { ports, airports, lanes, industrial, max_importance: maxImportance },
      });
    } catch (e) {
      stats.failed++;
      console.error("analysis failed:", (e as Error).message);
      break; // rate limited / out of credits — stop cleanly, retry next run
    }

    if (!a) {
      stats.failed++;
      await db.from("raw_items").update({ analysis_status: "failed", rejection_reason: "invalid model response" }).eq("id", row.id);
      continue;
    }

    const ov = applyOverrides(a, text, { maxImportance, ports });
    const routine = isRoutineWeather(a, text);
    // Routine advisories are capped below the display threshold unless they sit
    // on a top-tier node AND the override flagged a genuine disruption.
    const finalScore = routine && !ov.reason ? Math.min(ov.score, 30) : ov.score;
    const severity = routine && !ov.reason ? "awareness" as Severity : ov.severity;
    const hitekScore = Math.max(a.hitek_relevance_score, Math.round(maxHitek * 0.6));

    if (!a.relevant || finalScore < 35) {
      stats.rejected++;
      await db.from("raw_items").update({
        analysis_status: "rejected",
        rejection_reason: routine ? "routine local weather advisory (recurring)" : a.relevant ? `below display threshold (${finalScore})` : a.reasoning_short || "not logistics relevant",
        impact_score: finalScore,
      }).eq("id", row.id);
      continue;
    }
    stats.relevant++;

    // ---------- event clustering ----------
    const clusterKey = routine ? routineClusterKey(a) : a.event_key;
    const { data: existing } = await db
      .from("supply_chain_events")
      .select("*")
      .eq("cluster_key", clusterKey)
      .maybeSingle();

    const sourceEntry = {
      source_name: row.source_name,
      source_type: row.source_type,
      url: row.url,
      title: row.original_title,
      published_at: row.published_at,
    };

    let eventId: string;
    if (existing) {
      const sources = [...(existing.sources as Array<Record<string, unknown>> ?? [])];
      if (!sources.some((s) => s.url === row.url)) sources.push(sourceEntry);
      const sourceCount = new Set(sources.map((s) => s.source_name)).size;
      // A newer report about a developing event is an UPDATE, never a duplicate.
      const escalated = finalScore > (existing.global_logistics_impact_score ?? 0) ||
        severity !== existing.severity || a.event_status !== existing.event_status;
      const upd = {
        title: escalated ? (a.event_name || existing.title) : existing.title,
        summary: escalated ? a.summary : existing.summary,
        logistics_impact: a.logistics_impact || existing.logistics_impact,
        next_watchpoint: a.next_watchpoint || existing.next_watchpoint,
        event_status: a.event_status,
        severity: escalated ? severity : existing.severity,
        global_logistics_impact_score: Math.max(finalScore, existing.global_logistics_impact_score ?? 0),
        hitek_relevance_score: Math.max(hitekScore, existing.hitek_relevance_score ?? 0),
        departments: [...new Set([...(existing.departments ?? []), ...a.departments])],
        countries: [...new Set([...(existing.countries ?? []), ...a.countries])],
        affected_ports: [...new Set([...(existing.affected_ports ?? []), ...ports])],
        affected_airports: [...new Set([...(existing.affected_airports ?? []), ...airports])],
        affected_shipping_lanes: [...new Set([...(existing.affected_shipping_lanes ?? []), ...lanes])],
        affected_industrial_regions: [...new Set([...(existing.affected_industrial_regions ?? []), ...industrial])],
        transport_modes: [...new Set([...(existing.transport_modes ?? []), ...a.transport_modes])],
        sources,
        source_count: sourceCount,
        // Corroboration raises CONFIDENCE, never severity.
        confidence_score: confidenceScore(sourceCount, a.confidence),
        source_confidence: a.confidence,
        last_updated_at: new Date().toISOString(),
        is_active: a.event_status !== "resolved",
        resolved_at: a.event_status === "resolved" ? new Date().toISOString() : null,
        latitude: existing.latitude ?? row.latitude,
        longitude: existing.longitude ?? row.longitude,
        maximum_wind: (payload.maximum_wind as number | null) ?? existing.maximum_wind,
        forecast_track: (payload.forecast_track as unknown[])?.length ? payload.forecast_track : existing.forecast_track,
      };
      await db.from("supply_chain_events").update(upd).eq("id", existing.id);
      await db.from("event_updates").insert({
        event_id: existing.id,
        source_name: row.source_name,
        change_summary: escalated
          ? `Updated by ${row.source_name}: status ${existing.event_status} → ${a.event_status}, score ${existing.global_logistics_impact_score} → ${finalScore}`
          : `Corroborated by ${row.source_name}`,
        severity: upd.severity,
        event_status: a.event_status,
        global_logistics_impact_score: upd.global_logistics_impact_score,
        snapshot: { title: row.original_title, url: row.url },
      });
      eventId = existing.id;
      stats.events_updated++;
    } else {
      const { data: created, error: cErr } = await db.from("supply_chain_events").insert({
        cluster_key: clusterKey,
        title: a.event_name || row.original_title,
        summary: a.summary,
        logistics_impact: a.logistics_impact,
        next_watchpoint: a.next_watchpoint,
        event_type: a.event_type,
        event_status: a.event_status,
        severity,
        departments: a.departments,
        global_logistics_impact_score: finalScore,
        hitek_relevance_score: hitekScore,
        source_confidence: a.confidence,
        confidence_score: confidenceScore(1, a.confidence),
        countries: a.countries,
        affected_ports: ports,
        affected_airports: airports,
        affected_shipping_lanes: lanes,
        affected_industrial_regions: industrial,
        transport_modes: a.transport_modes,
        latitude: row.latitude,
        longitude: row.longitude,
        forecast_track: payload.forecast_track ?? null,
        maximum_wind: payload.maximum_wind ?? null,
        hazard_type: payload.hazard_type ?? null,
        event_name: a.event_name,
        sources: [sourceEntry],
        source_count: 1,
        primary_source_url: row.url,
        event_started_at: row.published_at,
      }).select("id").single();
      if (cErr) { stats.failed++; continue; }
      eventId = created.id;
      stats.events_created++;
    }

    // ---------- dashboard item ----------
    const dept = a.departments[0] ?? "operations";
    const cappedSeverity: Severity = dept === "it" && severity === "act_now" ? "this_week" : severity;
    const { data: dupItem } = await db
      .from("intelligence_items")
      .select("id")
      .eq("source_url", row.url)
      .maybeSingle();

    if (!dupItem) {
      const { data: item } = await db.from("intelligence_items").insert({
        headline: a.event_name || row.original_title,
        summary: `${a.what_happened || a.summary}`.slice(0, 2000),
        impact: a.logistics_impact || a.summary,
        action_required: a.next_watchpoint || "Monitor for further updates.",
        department: dept,
        severity: cappedSeverity,
        time_to_impact: horizon(a.event_status),
        affected_tags: [...new Set([...ports, ...lanes, ...a.countries])].slice(0, 8),
        source_name: row.source_name,
        source_url: row.url,
        status: "new",
        is_ai_draft: false,
        language: row.source_language ?? "en",
        publication_date: row.published_at ? row.published_at.slice(0, 10) : null,
        event_date: row.published_at ? row.published_at.slice(0, 10) : null,
        verification_status: (payload.tier === 1 || row.source_type === "weather" || row.source_type === "hazard") ? "verified" : "partially_verified",
        category: a.event_type,
        country: a.countries[0] ?? null,
        latitude: row.latitude,
        longitude: row.longitude,
        transport_modes: a.transport_modes,
        port_affected: ports[0] ?? null,
        airport_affected: airports[0] ?? null,
        lane_affected: lanes[0] ?? null,
        why_it_matters_to_hitek: a.logistics_impact,
        suggested_action: a.next_watchpoint,
        action_required_bool: cappedSeverity !== "awareness",
      }).select("id").single();
      if (item) stats.items_written++;
      await db.from("raw_items").update({
        analysis_status: "analyzed", impact_score: finalScore, event_id: eventId, intel_item_id: item?.id ?? null,
      }).eq("id", row.id);
    } else {
      await db.from("raw_items").update({ analysis_status: "analyzed", impact_score: finalScore, event_id: eventId, intel_item_id: dupItem.id }).eq("id", row.id);
    }

    if (examples.length < 12) {
      examples.push({
        source: row.source_name,
        headline: row.original_title.slice(0, 140),
        event_status: a.event_status,
        global_score: finalScore,
        hitek_score: hitekScore,
        severity: cappedSeverity,
        override: ov.reason,
        exposure: [...ports, ...lanes].slice(0, 4),
        why: a.reasoning_short,
      });
    }
  }

  return new Response(JSON.stringify({ ...stats, examples }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
