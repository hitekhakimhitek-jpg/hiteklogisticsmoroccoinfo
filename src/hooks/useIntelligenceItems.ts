import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateRecords } from "@/lib/translateEntries";

export type IntelDepartment = "operations" | "compliance" | "finance" | "commercial" | "it";
export type IntelSeverity = "act_now" | "this_week" | "awareness";
export type IntelStatus = "new" | "acknowledged" | "actioned" | "archived";
export type IntelHorizon = "today" | "this_week" | "this_month" | "horizon";

export type IntelligenceItem = {
  id: string;
  headline: string;
  summary: string;
  impact: string;
  action_required: string;
  department: IntelDepartment;
  severity: IntelSeverity;
  time_to_impact: IntelHorizon;
  time_to_impact_date: string | null;
  affected_tags: string[];
  source_name: string;
  source_url: string | null;
  owner: string | null;
  status: IntelStatus;
  is_ai_draft: boolean;
  source_entry_id: string | null;
  language: string;
  created_at: string;
  updated_at: string;
  last_reviewed_at: string | null;
  publication_date: string | null;
  updated_date: string | null;
  effective_date: string | null;
  verification_status: VerificationStatus;
  // Phase 6
  predicted_relevance: number;
  action_required_bool: boolean | null;
  // Phase 4 — single source of truth fields
  event_date: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  transport_modes: string[] | null;
  port_affected: string | null;
  airport_affected: string | null;
  carrier_affected: string | null;
  lane_affected: string | null;
  category: string | null;
  why_it_matters_to_hitek: string | null;
  affected_lanes_or_customers: string | null;
  suggested_action: string | null;
  relevance_score: number;
  department_confidence: number;
  severity_score: number;
  classification_reason: string | null;
  processing_status: "discovered" | "rejected_irrelevant" | "rejected_non_article" | "duplicate" | "processing" | "enriched" | "published" | "failed" | "review_required";
  processing_error: string | null;
  canonical_url: string | null;
  source_tier: number;
  ingested_at: string;
};

export type VerificationStatus =
  | "verified"
  | "partially_verified"
  | "date_not_verified"
  | "source_mismatch"
  | "outdated"
  | "broken_link"
  | "duplicate"
  | "needs_review";

export const VERIFIED_STATUSES: VerificationStatus[] = ["verified", "partially_verified"];

export type IntelFilters = {
  department?: IntelDepartment | "all";
  severity?: IntelSeverity | "all";
  status?: IntelStatus | "all";
  reviewQueue?: boolean;
  search?: string;
  limit?: number;
};

const SEVERITY_ORDER: Record<IntelSeverity, number> = {
  act_now: 0,
  this_week: 1,
  awareness: 2,
};

// Trust/impact tier for logistics sources — higher = more consequential for a
// Morocco freight forwarder like Hitek. Used to break ties within a severity
// bucket so tier-1 wire copy (JOC, Loadstar, Lloyd's List, official regulators)
// pins above softer trade press. Case-insensitive substring match on source_name.
const SOURCE_TIER: Array<{ match: RegExp; weight: number }> = [
  { match: /joc|journal of commerce|loadstar|lloyd'?s list|reuters|bloomberg/i, weight: 3 },
  { match: /maersk|msc|cma cgm|hapag-lloyd|seko logistics|kuehne|hillebrand/i, weight: 3 },
  { match: /maritime executive|everstream|resilinc|project44|icis/i, weight: 2.5 },
  { match: /cisa|imo|iata|european commission|ec\.europa|customs|douane|adii|omc|wto/i, weight: 3 },
  { match: /medias?24|hespress|maroc|morocco world news|le\s?matin|tanger med|onda|ports?\.gov/i, weight: 2.5 },
  { match: /freightwaves|splash|shippingwatch|seatrade|american shipper|the maritime executive/i, weight: 2 },
  { match: /the register|itsecurityguru|sd times|bleepingcomputer|krebs/i, weight: 1 },
];
function sourceWeight(name: string | null | undefined): number {
  if (!name) return 0.5;
  for (const t of SOURCE_TIER) if (t.match.test(name)) return t.weight;
  return 1;
}

// Shared client-side filter: matches what `useIntelligenceItems` shows so KPI
// counts and the visible feed can never disagree.
const BAD_URL_PATTERNS = [
  /\/tag\//i, /\/tags\//i, /\/sujet\//i, /\/category\//i, /\/categories\//i,
  /\/categorie\//i, /\/topic\//i, /\/topics\//i, /\/author\//i, /\/authors\//i,
  /\/auteur\//i, /\/section\//i, /\/search\//i, /\/recherche\//i, /\/page\//i,
];
// Official hazard / advisory publishers serve their live bulletins from a
// landing page (or a very short path). Those are legitimate destinations, so
// the "too shallow to be an article" heuristic must not drop them — that rule
// was silently hiding every typhoon and heatwave alert from the feed.
const OFFICIAL_LANDING_HOSTS =
  /(^|\.)(wmo\.int|gdacs\.org|pagasa\.dost\.gov\.ph|metoc\.navy\.mil|jma\.go\.jp|noaa\.gov|usgs\.gov|copernicus\.eu|reliefweb\.int|who\.int|imo\.org|iata\.org|europa\.eu|douane\.gov\.ma|tangermed\.ma|portnet\.ma)$/i;
export function isBadArticleUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (OFFICIAL_LANDING_HOSTS.test(url.hostname)) return false;
    const segments = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (segments.length <= 1) {
      // Publishers like The Loadstar serve real articles at a single long slug.
      const slug = segments[0] || "";
      const looksLikeSlug = slug.length >= 15 && (slug.match(/-/g) || []).length >= 2;
      if (!looksLikeSlug) return true;
    }
  } catch {
    return false;
  }
  return BAD_URL_PATTERNS.some((r) => r.test(u));
}
export function passesFeedFilter(r: {
  publication_date?: string | null;
  event_date?: string | null;
  source_url?: string | null;
  verification_status?: VerificationStatus | string | null;
}): boolean {
  if (r.verification_status && !VERIFIED_STATUSES.includes(r.verification_status as VerificationStatus)) return false;
  const now = new Date();
  const rollingCutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const yearStartMs = Date.UTC(now.getUTCFullYear(), 0, 1);
  if (!r.publication_date) return false;
  const pubMs = new Date(r.publication_date).getTime();
  if (Number.isNaN(pubMs) || pubMs < yearStartMs) return false;
  // Publication freshness is authoritative. Event dates must never revive an
  // old article (several legacy rows contain placeholder event dates).
  if (pubMs < rollingCutoffMs) return false;
  if (isBadArticleUrl(r.source_url ?? null)) return false;
  return true;
}

// Display rule: IT news is capped at "Important". Only a major outage or
// breaking change to the core software Hitek runs on (Teams, OneDrive,
// Microsoft 365, CargoWise, SAP…) may stay Critical. Hacks, breaches and
// software flaws are always Important at most.
const CORE_SOFTWARE_RE =
  /(microsoft\s*teams|onedrive|sharepoint|outlook|exchange online|microsoft\s*365|office\s*365|\bm365\b|windows|azure ad|entra id|cargowise|\bsap\b|portnet|badr)/i;
const MAJOR_DISRUPTION_RE =
  /(outage|down|offline|unavailable|disruption|migration|end of (life|support)|forced upgrade|major update|breaking change|deprecat)/i;
const SECURITY_ONLY_RE =
  /(hack|hacked|breach|ransomware|malware|phish|vulnerab|\bcve\b|exploit|flaw|zero-?day|patch tuesday|leak)/i;
export function clampSeverity<T extends { department?: string | null; severity: IntelSeverity; headline?: string | null; summary?: string | null; impact?: string | null }>(r: T): T {
  if (r.department !== "it" || r.severity !== "act_now") return r;
  const text = `${r.headline || ""} ${r.summary || ""} ${r.impact || ""}`;
  const majorSoftware = !SECURITY_ONLY_RE.test(text) && CORE_SOFTWARE_RE.test(text) && MAJOR_DISRUPTION_RE.test(text);
  return majorSoftware ? r : { ...r, severity: "this_week" as IntelSeverity };
}

// Single shared page size for every surface (feed, map, counts) so the
// dashboard and the disruption map can never render different item sets.
export const FEED_LIMIT = 500;
// Shared 14-day rolling window (inclusive of today).
export function feedWindow() {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { start, end };
}

export function useIntelligenceItems(filters: IntelFilters = {}) {
  const { lang } = useLanguage();
  return useQuery({
    queryKey: ["intel_items", filters, lang],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("canonical_intelligence", {
        _start_date: start,
        _end_date: today,
        _department: filters.department && filters.department !== "all" ? filters.department : undefined,
        _severity: filters.severity && filters.severity !== "all" ? filters.severity : undefined,
        _limit: filters.limit || 200,
      });
      if (error) throw error;
      let rows = (data || []) as IntelligenceItem[];
      if (filters.search) {
        const needle = filters.search.toLocaleLowerCase();
        rows = rows.filter((row) => `${row.headline} ${row.summary} ${row.impact}`.toLocaleLowerCase().includes(needle));
      }
      rows = rows.map(clampSeverity);
      // Sort blend: recency + severity + learned predicted_relevance.
      // HARD SAFETY FLOOR: critical (act_now) and action_required items are pinned
      // to the top regardless of preference signal. Learning tunes noise, not alerts.
      const now = Date.now();
      const scoreOf = (r: IntelligenceItem) => {
        const sevW = (3 - SEVERITY_ORDER[r.severity]) * 10; // 30 / 20 / 10 — severity dominates
        const ageHours = (now - new Date(r.created_at).getTime()) / 3_600_000;
        const recency = Math.max(0, 1 - ageHours / (14 * 24)) * 2; // 0..2
        const pr = Number(r.predicted_relevance || 0); // typically -1..+1
        const src = sourceWeight(r.source_name); // 0.5..3
        return sevW + recency + pr + src;
      };
      const isPinned = (r: IntelligenceItem) =>
        r.severity === "act_now" || r.action_required_bool === true;
      const sorted = [...rows].sort((a, b) => {
        const pa = isPinned(a) ? 1 : 0;
        const pb = isPinned(b) ? 1 : 0;
        if (pa !== pb) return pb - pa;
        if (pa === 1) {
          // Inside the pinned tier: severity, then source tier, then recency.
          const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
          if (s !== 0) return s;
          const sw = sourceWeight(b.source_name) - sourceWeight(a.source_name);
          if (sw !== 0) return sw;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return scoreOf(b) - scoreOf(a);
      });
      if (lang === "fr" && sorted.length > 0) {
        try {
          // Per-card coherence: a card is either fully French or fully English,
          // never a French headline with an English summary.
          return await translateRecords(
            sorted,
            [
              "headline",
              "summary",
              "impact",
              "action_required",
              "why_it_matters_to_hitek",
              "affected_lanes_or_customers",
              "suggested_action",
            ],
            "fr",
          );
        } catch (e) {
          console.error("intel translate failed", e);
          return sorted;
        }
      }
      return sorted;
    },
    // Keep the previous list on screen while a language switch re-translates,
    // instead of blanking the feed for several seconds.
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
}

export function useIntelCounts() {
  return useQuery({
    queryKey: ["intel_counts"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("canonical_intelligence_counts", {
        _start_date: start,
        _end_date: today,
      });
      if (error) throw error;
      const counts = (data || {}) as Record<string, unknown>;
      return {
        act_now: Number(counts.act_now || 0),
        this_week: Number(counts.this_week || 0),
        awareness: Number(counts.awareness || 0),
        by_dept: (counts.by_dept || {}) as Record<string, number>,
        review_pending: 0,
      };
    },
    refetchInterval: 60_000,
  });
}

export function useUpdateIntelStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IntelStatus }) => {
      const patch: { status: IntelStatus; last_reviewed_at: string; is_ai_draft?: boolean } = {
        status,
        last_reviewed_at: new Date().toISOString(),
      };
      if (status === "acknowledged" || status === "actioned") patch.is_ai_draft = false;
      const { error } = await supabase.from("intelligence_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel_items"] });
      qc.invalidateQueries({ queryKey: ["intel_counts"] });
    },
  });
}

export function useCreateIntel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<IntelligenceItem>) => {
      const { data, error } = await supabase
        .from("intelligence_items")
        .insert({
          headline: item.headline || "Untitled",
          summary: item.summary || "",
          impact: item.impact || "",
          action_required: item.action_required || "Monitor only.",
          department: (item.department as IntelDepartment) || "operations",
          severity: (item.severity as IntelSeverity) || "awareness",
          time_to_impact: (item.time_to_impact as IntelHorizon) || "horizon",
          affected_tags: item.affected_tags || [],
          source_name: item.source_name || "Manual",
          source_url: item.source_url || null,
          owner: item.owner || null,
          is_ai_draft: !!item.is_ai_draft,
          status: "new",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as IntelligenceItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel_items"] });
      qc.invalidateQueries({ queryKey: ["intel_counts"] });
    },
  });
}

export async function aiAssist(input: {
  headline?: string;
  summary?: string;
  text?: string;
  source_url?: string;
  source_name?: string;
}) {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-intel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ mode: "assist", ...input }),
    }
  );
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw new Error(e.error || "AI assist failed");
  }
  const data = await resp.json();
  return data.draft as Partial<IntelligenceItem>;
}

export async function triggerEnrichBatch(limit = 30) {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-intel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ limit }),
    }
  );
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw new Error(e.error || "Enrichment failed");
  }
  return resp.json() as Promise<{ success: boolean; created: number; failed: number; considered: number }>;
}

export const DEPARTMENT_LABELS: Record<IntelDepartment, string> = {
  operations: "Operations",
  compliance: "Compliance",
  finance: "Finance",
  commercial: "Commercial",
  it: "IT",
};

export const SEVERITY_LABELS: Record<IntelSeverity, string> = {
  act_now: "Critical",
  this_week: "Important",
  awareness: "To be aware of",
};

export const SEVERITY_LABELS_BY_LANG: Record<"en" | "fr", Record<IntelSeverity, string>> = {
  en: {
    act_now: "Critical",
    this_week: "Important",
    awareness: "To be aware of",
  },
  fr: {
    act_now: "Critique",
    this_week: "Important",
    awareness: "Prendre connaissance de",
  },
};

export const DEPARTMENT_LABELS_BY_LANG: Record<"en" | "fr", Record<IntelDepartment, string>> = {
  en: {
    operations: "Operations",
    compliance: "Compliance",
    finance: "Finance",
    commercial: "Commercial",
    it: "IT",
  },
  fr: {
    operations: "Opérations",
    compliance: "Conformité",
    finance: "Finance",
    commercial: "Commercial",
    it: "IT",
  },
};

export const HORIZON_LABELS_BY_LANG: Record<"en" | "fr", Record<IntelHorizon, string>> = {
  en: {
    today: "Today",
    this_week: "This week",
    this_month: "This month",
    horizon: "Horizon",
  },
  fr: {
    today: "Aujourd'hui",
    this_week: "Cette semaine",
    this_month: "Ce mois-ci",
    horizon: "Horizon",
  },
};

export const HORIZON_LABELS: Record<IntelHorizon, string> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
  horizon: "Horizon",
};