import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireHitekAdmin, isSafeExternalUrl } from "../_shared/auth.ts";
import {
  assessIntelligenceQuality,
  buildHitekImpactAction,
  departmentAction,
  deterministicSummary,
} from "../_shared/intel-quality.ts";
import { areLikelyDuplicateTitles, canonicalizeUrl, cleanSummary, cleanTitle, nonArticleReason } from "../_shared/intel-article.ts";

const DEPARTMENTS = ["operations", "compliance", "finance", "commercial", "it"] as const;
const SEVERITIES = ["act_now", "this_week", "awareness"] as const;
const HORIZONS = ["today", "this_week", "this_month", "horizon"] as const;
const CATEGORIES = ["operational", "financial", "global"] as const;
const MODES = ["sea", "air", "road", "rail"] as const;
const CURRENT_YEAR = new Date().getUTCFullYear();
const CURRENT_YEAR_START = Date.UTC(CURRENT_YEAR, 0, 1);
const ROLLING_NEWS_CUTOFF = Date.now() - 14 * 24 * 60 * 60 * 1000;
const PAYWALL_RE = /\b(only available to subscribers|subscriber(?:s)? only|thirty-day free trial|30-day free trial|subscribe to read|subscription required|premium content|sign in to continue|login to continue|become a subscriber|already a subscriber)\b/i;
const BAD_ARTICLE_PATH = /\/(tag|tags|sujet|category|categories|categorie|topic|topics|author|authors|section|sections|page|search|recherche|auteur)(\/|$)/i;

function isCurrentDate(date: string | null | undefined): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  return !Number.isNaN(t) && t >= CURRENT_YEAR_START && t >= ROLLING_NEWS_CUTOFF && t <= Date.now() + 86400000;
}

function looksLikeArticleUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (!path || path === "/" || path.length < 8) return false;
    if (BAD_ARTICLE_PATH.test(path)) return false;
    if (/\.(jpg|jpeg|png|gif|pdf|mp4|css|js|xml)$/i.test(path)) return false;
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 2) return true;
    // Many publishers (The Loadstar, etc.) serve articles at a single slug:
    // /seven-msc-box-ships-go-dark. Accept long hyphenated slugs as articles.
    const slug = segments[0] || "";
    return slug.length >= 15 && (slug.match(/-/g) || []).length >= 2;
  } catch {
    return false;
  }
}

function contentLooksReadable(markdown?: string, title?: string): boolean {
  const text = `${title || ""}\n${markdown || ""}`.trim();
  return text.length >= 180 && !PAYWALL_RE.test(text);
}

function extractPubDate(meta: any, markdown?: string): string | null {
  const candidates: any[] = [
    meta?.publishedTime, meta?.publishDate, meta?.publishedDate, meta?.datePublished,
    meta?.published_time, meta?.["article:published_time"], meta?.["og:article:published_time"],
    meta?.["og:published_time"], meta?.pubdate, meta?.date,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    const d = new Date(c);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + 86400000) {
      const iso = d.toISOString().split("T")[0];
      return isCurrentDate(iso) ? iso : null;
    }
  }
  if (typeof markdown === "string" && markdown.length > 0) {
    // Search a wider window — Media24, Hespress and many outlets render the date in a sidebar/footer.
    const haystack = markdown.substring(0, 12000);
    const FR_MONTHS: Record<string, number> = {
      janvier:1, "février":2, fevrier:2, mars:3, avril:4, mai:5, juin:6,
      juillet:7, "août":8, aout:8, septembre:9, octobre:10, novembre:11, "décembre":12, decembre:12,
    };
    const EN_MONTHS: Record<string, number> = {
      january:1, february:2, march:3, april:4, may:5, june:6, july:7,
      august:8, september:9, october:10, november:11, december:12,
      jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12,
    };
    const tryDate = (y: number, m: number, d: number): string | null => {
      if (!y || !m || !d) return null;
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (isNaN(dt.getTime())) return null;
      if (dt.getTime() > Date.now() + 2 * 86400000) return null;
      const iso = dt.toISOString().split("T")[0];
      return isCurrentDate(iso) ? iso : null;
    };
    // 1) ISO YYYY-MM-DD
    const iso = haystack.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) {
      const r = tryDate(+iso[1], +iso[2], +iso[3]);
      if (r) return r;
    }
    // 2) "19 juin 2026" / "19 June 2026" / "June 19, 2026"
    const monthName = haystack.match(
      /\b(\d{1,2})(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(20\d{2})\b/i,
    ) || haystack.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i,
    );
    if (monthName) {
      const groups = monthName.slice(1).map((s) => s.toLowerCase());
      let day: number, mon: number, yr: number;
      if (/^\d+$/.test(groups[0])) {
        day = +groups[0]; mon = FR_MONTHS[groups[1]] || EN_MONTHS[groups[1]]; yr = +groups[2];
      } else {
        mon = EN_MONTHS[groups[0]] || FR_MONTHS[groups[0]]; day = +groups[1]; yr = +groups[2];
      }
      const r = tryDate(yr, mon, day);
      if (r) return r;
    }
    // 3) Numeric DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY (assume day-first; common on FR/AR sites)
    const num = haystack.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/);
    if (num) {
      const r = tryDate(+num[3], +num[2], +num[1]);
      if (r) return r;
    }
  }
  return null;
}

type Drafted = {
  headline: string;
  summary: string;
  impact: string;
  action_required: string;
  department: typeof DEPARTMENTS[number];
  severity: typeof SEVERITIES[number];
  time_to_impact: typeof HORIZONS[number];
  affected_tags: string[];
  owner?: string | null;
  // Phase 4 unified enrichment
  category: typeof CATEGORIES[number];
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  event_date: string | null;
  transport_modes: string[];
  port_affected: string | null;
  airport_affected: string | null;
  carrier_affected: string | null;
  lane_affected: string | null;
  why_it_matters_to_hitek: string;
  affected_lanes_or_customers: string | null;
  suggested_action: string;
  action_required_bool: boolean;
  relevance_score: number;
  department_confidence: number;
  severity_score: number;
  classification_reason: string;
  relevance_status: "accept" | "review" | "reject";
  source_severity: string | null;
  clean_title: string;
  clean_summary: string;
  decision_reasons: string[];
  enrichment_version: string;
};

type TechnologyUsage = Record<string, "used" | "not_used" | "unknown">;

async function loadTechnologyUsage(supabase: any): Promise<TechnologyUsage> {
  const { data, error } = await supabase.from("hitek_technologies").select("name,aliases,usage_status");
  if (error) {
    console.error("technology profile unavailable:", error.message);
    return {};
  }
  const usage: TechnologyUsage = {};
  for (const row of data || []) {
    const names = [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])].filter(Boolean);
    usage[names.join("|").toLowerCase()] = row.usage_status;
  }
  return usage;
}

function hardenDraft(
  draft: Drafted,
  source: { headline?: string | null; summary?: string | null; content?: string | null; sourceName?: string | null; sourceUrl?: string | null; country?: string | null },
  technologyUsage: TechnologyUsage,
): Drafted {
  const clean_title = cleanTitle(draft.headline || source.headline, source.sourceName);
  const clean_summary = cleanSummary(draft.summary || source.summary || source.content);
  const quality = assessIntelligenceQuality({
    headline: clean_title,
    summary: clean_summary,
    content: source.content,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    country: draft.country || source.country,
    department: draft.department,
    technologyUsage,
  });
  const copy = buildHitekImpactAction({ headline: clean_title, summary: clean_summary, assessment: quality });
  const articleFailure = source.sourceUrl
    ? nonArticleReason({ title: clean_title, url: source.sourceUrl, content: source.content || clean_summary })
    : null;
  return {
    ...draft,
    headline: clean_title,
    summary: deterministicSummary(clean_title, clean_summary),
    impact: copy.impact,
    action_required: copy.action,
    suggested_action: copy.action,
    why_it_matters_to_hitek: copy.impact,
    action_required_bool: quality.severity !== "awareness",
    department: quality.department,
    severity: quality.severity,
    relevance_score: quality.relevanceScore,
    department_confidence: quality.departmentConfidence,
    severity_score: quality.severityScore,
    classification_reason: quality.classificationReason,
    relevance_status: articleFailure ? "reject" : quality.relevanceStatus,
    source_severity: quality.sourceSeverity,
    clean_title,
    clean_summary,
    decision_reasons: articleFailure ? [...quality.decisionReasons, articleFailure] : quality.decisionReasons,
    enrichment_version: "hitek-v2",
  };
}

async function findRecentDuplicate(supabase: any, headline: string, sourceUrl: string | null): Promise<string | null> {
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const canonical = canonicalizeUrl(sourceUrl);
  const { data, error } = await supabase
    .from("intelligence_items")
    .select("id,headline,clean_title,canonical_url,source_url")
    .gte("publication_date", cutoff)
    .neq("processing_status", "duplicate")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const duplicate = (data || []).find((row: any) => {
    const existingUrl = row.canonical_url || canonicalizeUrl(row.source_url);
    return (canonical && existingUrl === canonical) || areLikelyDuplicateTitles(row.clean_title || row.headline, headline);
  });
  return duplicate?.id ?? null;
}

const SYSTEM_PROMPT = `You triage external signals for Hitek Logistic Morocco, a freight-forwarding company at Tanger Med. Convert a raw news item into one actionable Intelligence Item. Write plainly. No marketing. No hedging.

Departments:
- operations: disruptions, road/port/border events, congestion, cutoffs, carrier delays, weather.
- compliance: regulatory changes, new document requirements, customs rule updates, legal changes.
- finance: surcharges (BAF/fuel), duty/tariff changes, FX moves, sanctions, economic signals affecting cost.
- commercial: macro rate environment, capacity, demand signals.
- it: AI/tech developments, automation tools, cybersecurity relevant to logistics IT.

Category (high-level bucket, separate from department):
- operational: physical movement, ports/airports/lanes, weather, congestion, strikes, security.
- financial: rates, surcharges, tariffs, duties, FX, sanctions, macro cost signals.
- global: geopolitics, broad trends, IT/tech, regulatory horizon-scanning that isn't immediately operational or financial.

Severity (be strict):
- act_now: RARE. A confirmed closure, stoppage, binding immediate rule, or direct disruption requires action today and affects exposed shipments.
- this_week: Significant and actionable, but operations are not currently stopped. It affects upcoming shipments, near-term costs, or compliance reviews.
- awareness: horizon scanning, trends, background context. No immediate action.

Department ownership is strict: Operations owns physical movement; Compliance owns binding rules/documents; Finance owns direct cost/cash exposure; Commercial owns rates/capacity/customer demand; IT owns systems and cyber. Choose one primary owner only.

IMPORTANT RULE (IT severity): Items in department "it" are capped at "this_week" (Important). Cybersecurity incidents, hacks, ransomware, data breaches, CVEs and software flaws are ALWAYS at most "this_week" — never "act_now". The ONLY exception allowing "act_now" for IT is a major outage, breaking change or forced migration of core business software Hitek actually operates on (Microsoft Teams, OneDrive, SharePoint, Outlook/Exchange, Microsoft 365/Windows, CargoWise, SAP, or the customs/port declaration platforms) that stops people working today.

time_to_impact: today | this_week | this_month | horizon.

affected_tags: 1-4 short chips (locations, modes, lanes, doc types), e.g. ["Tanger Med","Road"], ["Europe import","Customs"], ["Ocean","Pricing"], ["AI","Cybersecurity"]. No sentences.

impact: one sentence describing who/what is affected concretely. No fluff.
action_required: one sentence with the next concrete step for the owner. If nothing to do, write "Monitor only.".

Geography:
- country: ISO country name in English (e.g. "Morocco", "Spain", "France", "Global"). Use "Global" only when truly worldwide.
- latitude/longitude: best-guess decimal coordinates of the most affected place (port, city, border). Null only if truly unknowable.
- event_date: YYYY-MM-DD of when the event happens / takes effect. If unclear, use the publication date.

Transport & assets:
- transport_modes: subset of ["sea","air","road","rail"]. Empty if not transport-specific.
- port_affected / airport_affected / carrier_affected / lane_affected: name the specific asset if mentioned, else null.

Hitek-specific enrichment:
- why_it_matters_to_hitek: one sentence explaining the concrete impact on a Morocco-based freight forwarder operating at Tanger Med with Europe/Africa lanes.
- affected_lanes_or_customers: short phrase like "Morocco-Spain road" or "Tanger Med ocean exports", null if not lane-specific.
- suggested_action: one concrete next step (e.g. "Reroute via Algeciras", "Update customs templates", "Brief sales team"). Use "Monitor only." if no action.
- action_required_bool: true if a concrete action is needed, false for awareness-only.

Return ONLY a JSON object matching the schema. No prose, no fences.`;

function jsonOnly(s: string): string {
  return s.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

// Core business software Hitek depends on. A major outage / breaking update to
// one of these is the only case where an IT item may stay Critical.
const CORE_SOFTWARE =
  /(microsoft\s*teams|onedrive|sharepoint|outlook|exchange online|microsoft\s*365|office\s*365|\bm365\b|windows|azure ad|entra id|cargowise|\bsap\b|portnet|badr|customs platform)/i;
const MAJOR_DISRUPTION =
  /(outage|down|offline|unavailable|disruption|migration|end of (life|support)|forced upgrade|major update|breaking change|deprecat)/i;
// Security news (hacks, breaches, CVEs, flaws) is never Critical.
const SECURITY_ONLY =
  /(hack|hacked|breach|ransomware|malware|phish|vulnerab|\bcve\b|exploit|flaw|zero-?day|patch tuesday|leak)/i;
function isCoreSoftwareIncident(d: any): boolean {
  const text = `${d?.headline || ""} ${d?.summary || ""} ${d?.impact || ""}`;
  if (SECURITY_ONLY.test(text)) return false;
  return CORE_SOFTWARE.test(text) && MAJOR_DISRUPTION.test(text);
}

function coerce(d: any): Drafted {
  const dept = DEPARTMENTS.includes(d?.department) ? d.department : "operations";
  let sev = SEVERITIES.includes(d?.severity) ? d.severity : "awareness";
  // Rule: IT items are capped at "this_week" (Important). The only exception is a
  // major outage / breaking change of the core software Hitek runs on.
  if (dept === "it" && sev === "act_now" && !isCoreSoftwareIncident(d)) sev = "this_week";
  const hor = HORIZONS.includes(d?.time_to_impact) ? d.time_to_impact : "horizon";
  const tags = Array.isArray(d?.affected_tags)
    ? d.affected_tags.filter((x: any) => typeof x === "string").slice(0, 6)
    : [];
  const cat = CATEGORIES.includes(d?.category)
    ? d.category
    : (dept === "finance" ? "financial" : dept === "it" || dept === "commercial" ? "global" : "operational");
  const modes = Array.isArray(d?.transport_modes)
    ? d.transport_modes.filter((m: any) => MODES.includes(m)).slice(0, 4)
    : [];
  const lat = typeof d?.latitude === "number" && d.latitude >= -90 && d.latitude <= 90 ? d.latitude : null;
  const lng = typeof d?.longitude === "number" && d.longitude >= -180 && d.longitude <= 180 ? d.longitude : null;
  const ev = typeof d?.event_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.event_date) ? d.event_date : null;
  const trim = (v: any, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
  const quality = assessIntelligenceQuality({
    headline: d?.headline,
    summary: d?.summary,
    department: dept,
    severity: sev,
    actionRequired: d?.action_required_bool,
    country: d?.country,
  });
  sev = quality.severity;
  const headline = String(d?.headline || "").slice(0, 240) || "Untitled";
  const summary = deterministicSummary(headline, d?.summary);
  const action = String(d?.action_required || departmentAction(quality.department, sev, headline)).slice(0, 400);
  return {
    headline,
    summary,
    impact: String(d?.impact || "").slice(0, 400),
    action_required: action,
    department: quality.department,
    severity: sev,
    time_to_impact: hor,
    affected_tags: tags,
    owner: d?.owner ? String(d.owner).slice(0, 120) : null,
    category: cat,
    country: trim(d?.country, 80),
    latitude: lat,
    longitude: lng,
    event_date: ev,
    transport_modes: modes,
    port_affected: trim(d?.port_affected, 120),
    airport_affected: trim(d?.airport_affected, 120),
    carrier_affected: trim(d?.carrier_affected, 120),
    lane_affected: trim(d?.lane_affected, 160),
    why_it_matters_to_hitek: String(d?.why_it_matters_to_hitek || "").slice(0, 400),
    affected_lanes_or_customers: trim(d?.affected_lanes_or_customers, 200),
    suggested_action: String(d?.suggested_action || action).slice(0, 400),
    action_required_bool: typeof d?.action_required_bool === "boolean"
      ? d.action_required_bool
       : sev !== "awareness",
    relevance_score: quality.relevanceScore,
    department_confidence: quality.departmentConfidence,
    severity_score: quality.severityScore,
    classification_reason: quality.classificationReason,
    relevance_status: quality.relevanceStatus,
    source_severity: quality.sourceSeverity,
    clean_title: headline,
    clean_summary: summary,
    decision_reasons: quality.decisionReasons,
    enrichment_version: "hitek-v2",
  };
}

/**
 * Deterministic drafter used when the AI gateway is unavailable (outage, rate
 * limit, exhausted credits) so the daily pipeline keeps producing feed items.
 */
function heuristicDraft(input: {
  headline?: string | null;
  summary?: string | null;
  full_content?: string | null;
  source_name?: string | null;
  category?: string | null;
  publication_date?: string | null;
  source_url?: string | null;
  technologyUsage?: TechnologyUsage;
}): Drafted {
  const text = `${input.headline || ""} ${input.summary || ""}`.toLowerCase();
  let department: string = "operations";
  if (/customs|tariff|regulation|sanction|compliance|law|directive/.test(text)) department = "compliance";
  else if (/rate|price|cost|surcharge|currency|fuel|inflation|tax/.test(text)) department = "finance";
  else if (/cyber|software|it |platform|system outage|hack|ransomware|data breach/.test(text)) department = "it";
  else if (/market|contract|customer|demand|volume|acquisition/.test(text)) department = "commercial";

  let severity: string = "awareness";
  if (/strike|closure|closed|blockade|shutdown|attack|suspend|halt|force majeure/.test(text)) severity = "act_now";
  else if (/delay|congestion|disrupt|surcharge|diversion|backlog|warning|restriction/.test(text)) severity = "this_week";

  return hardenDraft(coerce({
    headline: input.headline,
    summary: input.summary || input.headline,
    impact: `${input.headline || "This development"} may affect freight timing, cost, compliance, or customer commitments; verify exposure against current files.`,
    action_required: departmentAction(department as any, severity as any, input.headline || "this development"),
    department,
    severity,
    time_to_impact: severity === "act_now" ? "today" : severity === "this_week" ? "this_week" : "horizon",
    affected_tags: [],
    category: input.category,
    event_date: input.publication_date || null,
    why_it_matters_to_hitek: "The development may affect Hitek shipments, costs, compliance duties, or customer commitments on connected lanes.",
  }), {
    headline: input.headline,
    summary: input.summary,
    content: input.full_content,
    sourceName: input.source_name,
    sourceUrl: input.source_url,
  }, input.technologyUsage || {});
}

async function callAI(LOVABLE_API_KEY: string, userContent: string): Promise<Drafted> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI error ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const content = jsonOnly(data.choices?.[0]?.message?.content || "{}");
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  return coerce(parsed);
}

function buildUserPrompt(input: {
  headline?: string;
  summary?: string;
  full_content?: string | null;
  source_name?: string;
  source_url?: string | null;
  region?: string | null;
  category?: string | null;
}): string {
  return `Source: ${input.source_name || "Unknown"}
URL: ${input.source_url || "(none)"}
Region: ${input.region || "(unknown)"}
Category hint: ${input.category || "(none)"}

HEADLINE: ${input.headline || "(none)"}
SUMMARY: ${input.summary || "(none)"}
CONTENT: ${(input.full_content || "").slice(0, 1200)}

Return the JSON object: { headline, summary, impact, action_required, department, severity, time_to_impact, affected_tags, owner, category, country, latitude, longitude, event_date, transport_modes, port_affected, airport_affected, carrier_affected, lane_affected, why_it_matters_to_hitek, affected_lanes_or_customers, suggested_action, action_required_bool }.
If the input has no actionable freight relevance for a Morocco freight forwarder, still classify it (most likely awareness/it or awareness/commercial) — never invent urgency.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authErr = await requireHitekAdmin(req);
  if (authErr) return authErr;

  let leaseToken: string | null = null;
  let pipelineClient: any = null;
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing env vars");
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    pipelineClient = supabase;
    const body = await req.json().catch(() => ({}));
    const technologyUsage = await loadTechnologyUsage(supabase);

    // ---- Mode: AI assist (preview, do not save) ----
    if (body.mode === "assist") {
      const prompt = buildUserPrompt({
          headline: body.headline,
          summary: body.summary,
          full_content: body.text,
          source_name: body.source_name,
          source_url: body.source_url,
        });
      const baseDraft = LOVABLE_API_KEY
        ? await callAI(LOVABLE_API_KEY, prompt)
        : heuristicDraft({ headline: body.headline, summary: body.summary, full_content: body.text, source_url: body.source_url, technologyUsage });
      const drafted = hardenDraft(baseDraft, {
        headline: body.headline, summary: body.summary, content: body.text,
        sourceName: body.source_name, sourceUrl: body.source_url,
      }, technologyUsage);
      return new Response(JSON.stringify({ success: true, draft: drafted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Mode: reprocess existing intelligence with the hardened v2 engine ----
    if (body.mode === "reprocess") {
      const requestedDays = Number(body.days || 30);
      const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 1), 90);
      const requestedLimit = Number(body.limit || 500);
      const reprocessLimit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 500, 1), 1000);
      const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data: items, error: itemsError } = await supabase
        .from("intelligence_items")
        .select("*")
        .gte("publication_date", cutoff)
        .order("publication_date", { ascending: false })
        .limit(reprocessLimit);
      if (itemsError) throw new Error(itemsError.message);

      const runId = crypto.randomUUID();
      const stats = { accepted: 0, review: 0, rejected: 0, failed: 0 };
      for (const item of items || []) {
        try {
          const base = coerce({
            headline: item.headline,
            summary: item.summary,
            impact: item.impact,
            action_required: item.action_required,
            department: item.department,
            severity: item.severity,
            time_to_impact: item.time_to_impact,
            affected_tags: item.affected_tags,
            owner: item.owner,
            category: item.category,
            country: item.country,
            latitude: item.latitude,
            longitude: item.longitude,
            event_date: item.event_date,
            transport_modes: item.transport_modes,
            port_affected: item.port_affected,
            airport_affected: item.airport_affected,
            carrier_affected: item.carrier_affected,
            lane_affected: item.lane_affected,
            why_it_matters_to_hitek: item.why_it_matters_to_hitek,
            affected_lanes_or_customers: item.affected_lanes_or_customers,
            suggested_action: item.suggested_action,
            action_required_bool: item.action_required_bool,
          });
          const drafted = hardenDraft(base, {
            headline: item.headline,
            summary: item.summary,
            content: `${item.summary || ""} ${item.impact || ""}`,
            sourceName: item.source_name,
            sourceUrl: item.source_url,
            country: item.country,
          }, technologyUsage);
          const newStatus = drafted.relevance_status === "accept"
            ? "published"
            : drafted.relevance_status === "review" ? "review_required" : "rejected_irrelevant";

          await supabase.from("intelligence_reprocessing_audit").insert({
            run_id: runId,
            item_id: item.id,
            previous_processing_status: item.processing_status,
            previous_department: item.department,
            previous_severity: item.severity,
            previous_relevance_score: item.relevance_score,
            new_processing_status: newStatus,
            new_department: drafted.department,
            new_severity: drafted.severity,
            new_relevance_score: drafted.relevance_score,
            decision_reasons: drafted.decision_reasons,
          });
          const { error: updateError } = await supabase.from("intelligence_items").update({
            headline: drafted.clean_title,
            summary: drafted.clean_summary,
            impact: drafted.impact,
            action_required: drafted.action_required,
            department: drafted.department,
            severity: drafted.severity,
            action_required_bool: drafted.action_required_bool,
            suggested_action: drafted.suggested_action,
            why_it_matters_to_hitek: drafted.why_it_matters_to_hitek,
            relevance_score: drafted.relevance_score,
            department_confidence: drafted.department_confidence,
            severity_score: drafted.severity_score,
            classification_reason: drafted.classification_reason,
            processing_status: newStatus,
            processing_error: newStatus === "published" ? null : drafted.classification_reason,
            relevance_status: drafted.relevance_status,
            source_severity: drafted.source_severity,
            clean_title: drafted.clean_title,
            clean_summary: drafted.clean_summary,
            decision_reasons: drafted.decision_reasons,
            enrichment_version: drafted.enrichment_version,
            canonical_url: canonicalizeUrl(item.source_url),
            status: newStatus === "published" ? item.status : "archived",
          }).eq("id", item.id);
          if (updateError) throw new Error(updateError.message);
          if (drafted.relevance_status === "accept") stats.accepted++;
          else if (drafted.relevance_status === "review") stats.review++;
          else stats.rejected++;
        } catch (error) {
          stats.failed++;
          console.error("reprocess item failed:", item.id, (error as Error).message);
        }
      }
      return new Response(JSON.stringify({ success: stats.failed === 0, run_id: runId, considered: items?.length || 0, ...stats }), {
        status: stats.failed === 0 ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Mode: scrape a URL with Firecrawl, AI-draft, and insert ----
    if (body.mode === "scrape_create") {
      const url = String(body.url || "").trim();
      const severityOverride = SEVERITIES.includes(body.severity) ? body.severity : null;
      if (!url || url.length > 2048 || !/^https?:\/\//i.test(url) || !isSafeExternalUrl(url)) {
        return new Response(JSON.stringify({ error: "Valid URL required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing");

      const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });
      if (!fcResp.ok) {
        const t = await fcResp.text();
        throw new Error(`Firecrawl ${fcResp.status}: ${t.slice(0, 200)}`);
      }
      const fcData = await fcResp.json();
      const doc = fcData?.data ?? fcData;
      const markdown: string = doc?.markdown || "";
      const meta = doc?.metadata || {};
      const pageTitle: string = meta?.title || meta?.ogTitle || "";
      const sourceName: string = meta?.siteName || (() => {
        try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Web"; }
      })();

      const pubDate = extractPubDate(meta, markdown);
      if (!markdown && !pageTitle) throw new Error("Firecrawl returned no content");
      if (!looksLikeArticleUrl(url)) throw new Error("URL is not a direct article");
      if (!contentLooksReadable(markdown, pageTitle)) throw new Error("Article is paywalled or unreadable");
      if (!isCurrentDate(pubDate)) throw new Error("Article is outside the current 14-day window");

      const draftPrompt = buildUserPrompt({
          headline: pageTitle,
          summary: "",
          full_content: markdown,
          source_name: sourceName,
          source_url: url,
        });
      const baseDraft = LOVABLE_API_KEY
        ? await callAI(LOVABLE_API_KEY, draftPrompt)
        : heuristicDraft({ headline: pageTitle, full_content: markdown, source_name: sourceName, source_url: url, publication_date: pubDate, technologyUsage });
      const drafted = hardenDraft(baseDraft, { headline: pageTitle, content: markdown, sourceName, sourceUrl: url }, technologyUsage);

      const finalSeverity = severityOverride ?? drafted.severity;
      const duplicateOf = await findRecentDuplicate(supabase, drafted.clean_title, url);
      if (duplicateOf) {
        return new Response(JSON.stringify({ success: true, duplicate: true, existing_item_id: duplicateOf }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inserted, error: insErr } = await supabase
        .from("intelligence_items")
        .insert({
          headline: drafted.headline || pageTitle || "Untitled",
          summary: drafted.summary,
          impact: drafted.impact,
          action_required: drafted.action_required,
          department: drafted.department,
          severity: finalSeverity,
          time_to_impact: drafted.time_to_impact,
          affected_tags: drafted.affected_tags,
          source_name: sourceName,
          source_url: url,
          owner: drafted.owner,
          status: "new",
          is_ai_draft: false,
          language: "en",
          publication_date: pubDate,
          verification_status: "verified",
          category: drafted.category,
          country: drafted.country,
          latitude: drafted.latitude,
          longitude: drafted.longitude,
          event_date: drafted.event_date ?? pubDate,
          transport_modes: drafted.transport_modes,
          port_affected: drafted.port_affected,
          airport_affected: drafted.airport_affected,
          carrier_affected: drafted.carrier_affected,
          lane_affected: drafted.lane_affected,
          why_it_matters_to_hitek: drafted.why_it_matters_to_hitek,
          affected_lanes_or_customers: drafted.affected_lanes_or_customers,
          suggested_action: drafted.suggested_action,
          action_required_bool: drafted.action_required_bool,
          relevance_score: drafted.relevance_score,
          department_confidence: drafted.department_confidence,
          severity_score: drafted.severity_score,
          classification_reason: drafted.classification_reason,
          processing_status: drafted.relevance_status === "accept" ? "published" : drafted.relevance_status === "review" ? "review_required" : "rejected_irrelevant",
          relevance_status: drafted.relevance_status,
          source_severity: drafted.source_severity,
          clean_title: drafted.clean_title,
          clean_summary: drafted.clean_summary,
          decision_reasons: drafted.decision_reasons,
          enrichment_version: drafted.enrichment_version,
          processing_error: drafted.relevance_status === "accept" ? null : drafted.classification_reason,
          canonical_url: canonicalizeUrl(url),
        })
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);

      return new Response(JSON.stringify({ success: true, item: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Mode: batch enrich news_entries that have no intelligence_item ----
    const limit = Math.min(Number(body.limit) || 30, 100);
    const { data: acquiredLease, error: leaseError } = await supabase.rpc("acquire_pipeline_lease", {
      _pipeline: "enrich-intel",
      _lease_seconds: 600,
    });
    if (leaseError) throw new Error(leaseError.message);
    if (!acquiredLease) {
      return new Response(JSON.stringify({ success: true, status: "already_running", created: 0, failed: 0, considered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    leaseToken = acquiredLease;

    // Find news_entries without a matching intelligence_item.source_entry_id
    const { data: existingIds } = await supabase
      .from("intelligence_items")
      .select("source_entry_id")
      .not("source_entry_id", "is", null);
    const taken = new Set((existingIds || []).map((r: any) => r.source_entry_id));

    const { data: candidates, error: fetchErr } = await supabase
      .from("news_entries")
      .select("id, headline, summary, full_content, source_name, source_url, region, category, publication_date, updated_date, effective_date, verification_status")
      .order("fetched_date", { ascending: false })
      .limit(limit + taken.size);
    if (fetchErr) throw new Error(fetchErr.message);

    const todo = (candidates || []).filter((c: any) => !taken.has(c.id)).slice(0, limit);
    console.log(`enrich-intel: ${todo.length} new items to enrich`);

    let created = 0;
    let failed = 0;
    let aiAvailable = Boolean(LOVABLE_API_KEY);
    for (const entry of todo) {
      try {
        if (!looksLikeArticleUrl(entry.source_url) || !isCurrentDate((entry as any).publication_date) || !["verified", "partially_verified"].includes((entry as any).verification_status)) {
          failed++;
          console.log("Skipping stale or non-article news entry:", entry.headline, entry.source_url);
          continue;
        }
        let drafted: Drafted;
        try {
          if (!aiAvailable || !LOVABLE_API_KEY) throw new Error("AI enrichment paused; using deterministic quality engine");
          const aiDraft = await callAI(
            LOVABLE_API_KEY,
            buildUserPrompt({
              headline: entry.headline,
              summary: entry.summary,
              full_content: entry.full_content,
              source_name: entry.source_name,
              source_url: entry.source_url,
              region: entry.region,
              category: entry.category,
            })
          );
          drafted = hardenDraft(aiDraft, {
            headline: entry.headline, summary: entry.summary, content: entry.full_content,
            sourceName: entry.source_name, sourceUrl: entry.source_url,
          }, technologyUsage);
        } catch (aiErr) {
          console.error("AI drafting unavailable, using heuristic draft:", aiErr);
          if (/AI error (402|403|429)/.test(String(aiErr))) aiAvailable = false;
          drafted = heuristicDraft({
            headline: entry.headline,
            summary: entry.summary,
            full_content: entry.full_content,
            source_name: entry.source_name,
            source_url: entry.source_url,
            category: entry.category,
            publication_date: (entry as any).publication_date,
            technologyUsage,
          });
        }
        const { error: insErr } = await supabase.from("intelligence_items").insert({
          headline: drafted.headline || entry.headline,
          summary: drafted.summary || entry.summary,
          impact: drafted.impact,
          action_required: drafted.action_required,
          department: drafted.department,
          severity: drafted.severity,
          time_to_impact: drafted.time_to_impact,
          affected_tags: drafted.affected_tags,
          source_name: entry.source_name,
          source_url: entry.source_url,
          owner: drafted.owner,
          status: "new",
          is_ai_draft: true,
          source_entry_id: entry.id,
          language: "en",
          publication_date: (entry as any).publication_date ?? null,
          updated_date: (entry as any).updated_date ?? null,
          effective_date: (entry as any).effective_date ?? null,
          verification_status: (entry as any).verification_status ?? "needs_review",
          category: drafted.category,
          country: drafted.country,
          latitude: drafted.latitude,
          longitude: drafted.longitude,
          event_date: drafted.event_date ?? (entry as any).publication_date ?? null,
          transport_modes: drafted.transport_modes,
          port_affected: drafted.port_affected,
          airport_affected: drafted.airport_affected,
          carrier_affected: drafted.carrier_affected,
          lane_affected: drafted.lane_affected,
          why_it_matters_to_hitek: drafted.why_it_matters_to_hitek,
          affected_lanes_or_customers: drafted.affected_lanes_or_customers,
          suggested_action: drafted.suggested_action,
          action_required_bool: drafted.action_required_bool,
          relevance_score: drafted.relevance_score,
          department_confidence: drafted.department_confidence,
          severity_score: drafted.severity_score,
          classification_reason: drafted.classification_reason,
          processing_status: drafted.relevance_status === "accept" ? "published" : drafted.relevance_status === "review" ? "review_required" : "rejected_irrelevant",
          relevance_status: drafted.relevance_status,
          source_severity: drafted.source_severity,
          clean_title: drafted.clean_title,
          clean_summary: drafted.clean_summary,
          decision_reasons: drafted.decision_reasons,
          enrichment_version: drafted.enrichment_version,
          processing_error: drafted.relevance_status === "accept" ? null : drafted.classification_reason,
          canonical_url: canonicalizeUrl(entry.source_url),
        });
        const duplicateOf = await findRecentDuplicate(supabase, drafted.clean_title, entry.source_url);
        if (duplicateOf) {
          const { error: duplicateError } = await supabase.from("intelligence_items").insert({
            headline: drafted.headline || entry.headline,
            summary: drafted.summary || entry.summary,
            impact: drafted.impact,
            action_required: drafted.action_required,
            department: drafted.department,
            severity: drafted.severity,
            time_to_impact: drafted.time_to_impact,
            affected_tags: drafted.affected_tags,
            source_name: entry.source_name,
            source_url: entry.source_url,
            status: "archived",
            is_ai_draft: false,
            source_entry_id: entry.id,
            language: "en",
            publication_date: entry.publication_date,
            verification_status: "duplicate",
            relevance_score: 0,
            department_confidence: drafted.department_confidence,
            severity_score: 0,
            processing_status: "duplicate",
            relevance_status: "reject",
            clean_title: drafted.clean_title,
            clean_summary: drafted.clean_summary,
            decision_reasons: [...drafted.decision_reasons, `duplicate of ${duplicateOf}`],
            enrichment_version: drafted.enrichment_version,
            processing_error: `duplicate of ${duplicateOf}`,
            canonical_url: canonicalizeUrl(entry.source_url),
          });
          if (duplicateError) throw new Error(duplicateError.message);
          continue;
        }
        if (insErr) {
          failed++;
          console.error("insert error:", insErr.message);
        } else {
          created++;
        }
      } catch (e) {
        failed++;
        console.error("enrich error:", (e as Error).message);
      }
    }

    // Fire critical alerts for any new act_now items
    if (created > 0) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-critical-alert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: "{}",
        });
      } catch (e) {
        console.error("send-critical-alert chain failed:", (e as Error).message);
      }
    }

    await supabase.rpc("release_pipeline_lease", {
      _pipeline: "enrich-intel",
      _token: leaseToken,
      _succeeded: true,
      _stage: "complete",
      _error: null,
    });
    leaseToken = null;
    return new Response(
      JSON.stringify({ success: true, created, failed, considered: todo.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-intel error:", e);
    if (pipelineClient && leaseToken) {
      await pipelineClient.rpc("release_pipeline_lease", {
        _pipeline: "enrich-intel", _token: leaseToken, _succeeded: false, _stage: "failed",
        _error: e instanceof Error ? e.message.slice(0, 1000) : "Unknown error",
      });
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});