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
  const sev = SEVERITIES.includes(d?.severity) ? d.severity : "awareness";
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
      .select("id, headline, summary, full_content, source_name, source_url, region, category")
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