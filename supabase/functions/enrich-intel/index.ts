import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEPARTMENTS = ["operations", "compliance", "finance", "commercial", "it"] as const;
const SEVERITIES = ["act_now", "this_week", "awareness"] as const;
const HORIZONS = ["today", "this_week", "this_month", "horizon"] as const;

function extractPubDate(meta: any, markdown?: string): string | null {
  const candidates: any[] = [
    meta?.publishedTime, meta?.publishDate, meta?.publishedDate, meta?.datePublished,
    meta?.published_time, meta?.["article:published_time"], meta?.["og:article:published_time"],
    meta?.["og:published_time"], meta?.pubdate, meta?.date,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    const d = new Date(c);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getTime() <= Date.now() + 86400000) {
      return d.toISOString().split("T")[0];
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
      if (y < 2015) return null;
      return dt.toISOString().split("T")[0];
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
};

const SYSTEM_PROMPT = `You triage external signals for Hitek Logistic Morocco, a freight-forwarding company at Tanger Med. Convert a raw news item into one actionable Intelligence Item for the right department. Write plainly. No marketing. No hedging.

Departments:
- operations: disruptions, road/port/border events, congestion, cutoffs, carrier delays, weather.
- compliance: regulatory changes, new document requirements, customs rule updates, legal changes.
- finance: surcharges (BAF/fuel), duty/tariff changes, FX moves, sanctions, economic signals affecting cost.
- commercial: macro rate environment, capacity, demand signals.
- it: AI/tech developments, automation tools, cybersecurity relevant to logistics IT.

Severity (be strict):
- act_now: requires action today; affects ongoing/imminent shipments or has hard legal deadline within days.
- this_week: must be handled this week; affects upcoming shipments, near-term costs, or compliance reviews.
- awareness: horizon scanning, trends, background context. No immediate action.

IMPORTANT RULE: Items classified as department "it" can NEVER be "act_now" (Critical). Only operations, compliance, finance, and commercial may be act_now. If an IT item seems urgent, cap it at "this_week" (Important).

time_to_impact: today | this_week | this_month | horizon.

affected_tags: 1-4 short chips (locations, modes, lanes, doc types), e.g. ["Tanger Med","Road"], ["Europe import","Customs"], ["Ocean","Pricing"], ["AI","Cybersecurity"]. No sentences.

impact: one sentence describing who/what is affected concretely. No fluff.
action_required: one sentence with the next concrete step for the owner. If nothing to do, write "Monitor only.".

Return ONLY a JSON object matching the schema. No prose, no fences.`;

function jsonOnly(s: string): string {
  return s.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function coerce(d: any): Drafted {
  const dept = DEPARTMENTS.includes(d?.department) ? d.department : "operations";
  let sev = SEVERITIES.includes(d?.severity) ? d.severity : "awareness";
  // Rule: IT items can never be auto-classified as critical (act_now).
  // Downgrade to "this_week" (Important). Manual user overrides bypass this in scrape_create.
  if (dept === "it" && sev === "act_now") sev = "this_week";
  const hor = HORIZONS.includes(d?.time_to_impact) ? d.time_to_impact : "horizon";
  const tags = Array.isArray(d?.affected_tags)
    ? d.affected_tags.filter((x: any) => typeof x === "string").slice(0, 6)
    : [];
  return {
    headline: String(d?.headline || "").slice(0, 240) || "Untitled",
    summary: String(d?.summary || "").slice(0, 600),
    impact: String(d?.impact || "").slice(0, 400),
    action_required: String(d?.action_required || "Monitor only.").slice(0, 400),
    department: dept,
    severity: sev,
    time_to_impact: hor,
    affected_tags: tags,
    owner: d?.owner ? String(d.owner).slice(0, 120) : null,
  };
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

Return the JSON object: { headline, summary, impact, action_required, department, severity, time_to_impact, affected_tags, owner }.
If the input has no actionable freight relevance for a Morocco freight forwarder, still classify it (most likely awareness/it or awareness/commercial) — never invent urgency.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing env vars");
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    // ---- Mode: AI assist (preview, do not save) ----
    if (body.mode === "assist") {
      const drafted = await callAI(
        LOVABLE_API_KEY,
        buildUserPrompt({
          headline: body.headline,
          summary: body.summary,
          full_content: body.text,
          source_name: body.source_name,
          source_url: body.source_url,
        })
      );
      return new Response(JSON.stringify({ success: true, draft: drafted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Mode: scrape a URL with Firecrawl, AI-draft, and insert ----
    if (body.mode === "scrape_create") {
      const url = String(body.url || "").trim();
      const severityOverride = SEVERITIES.includes(body.severity) ? body.severity : null;
      if (!url || !/^https?:\/\//i.test(url)) {
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

      if (!markdown && !pageTitle) throw new Error("Firecrawl returned no content");

      const drafted = await callAI(
        LOVABLE_API_KEY,
        buildUserPrompt({
          headline: pageTitle,
          summary: "",
          full_content: markdown,
          source_name: sourceName,
          source_url: url,
        })
      );

      const finalSeverity = severityOverride ?? drafted.severity;

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
          publication_date: extractPubDate(meta, markdown),
          verification_status: "verified",
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
    for (const entry of todo) {
      try {
        const drafted = await callAI(
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
          publication_date: (entry as any).publication_date ?? null,
          updated_date: (entry as any).updated_date ?? null,
          effective_date: (entry as any).effective_date ?? null,
          verification_status: (entry as any).verification_status ?? "needs_review",
        });
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

    return new Response(
      JSON.stringify({ success: true, created, failed, considered: todo.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-intel error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});