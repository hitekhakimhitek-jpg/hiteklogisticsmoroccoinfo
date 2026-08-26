import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireHitekAdmin } from "../_shared/auth.ts";

// Phase 5: digest groups by high-level CATEGORY (operational / financial / global), not department.
const CATEGORIES = ["operational", "financial", "global"] as const;
const CAT_LABEL: Record<string, string> = {
  operational: "Operational",
  financial: "Financial",
  global: "Global",
};

// Derive a category from an intelligence item, falling back to its department for legacy rows.
function categoryOf(item: any): typeof CATEGORIES[number] {
  if (CATEGORIES.includes(item?.category)) return item.category;
  const d = item?.department;
  if (d === "operations" || d === "compliance") return "operational";
  if (d === "finance") return "financial";
  return "global";
}

function isoWeek(d: Date): { year: number; week: number } {
  // ISO 8601 week
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

async function summarize(
  LOVABLE_API_KEY: string,
  deptLabel: string,
  items: any[],
  fallbackItems: any[] = [],
  fallbackLabel = "the previous week"
): Promise<string> {
  const hasCurrent = items.length > 0;
  const source = hasCurrent ? items : fallbackItems;
  if (source.length === 0) {
    return `- Quiet period — no notable items logged across the dashboard in the last two weeks.`;
  }
  const briefs = source
    .slice(0, 25)
    .map(
      (i) =>
        `- [${i.severity}] (${i.department}) ${i.headline}\n  Impact: ${i.impact}\n  Action: ${i.action_required}`
    )
    .join("\n");
  const window = hasCurrent ? "this week" : fallbackLabel;
  const prompt = `You write the weekly digest for the ${deptLabel} team at a Morocco freight forwarder. Summarize the ${window}'s intelligence in 4-6 plain bullet points: what changed, what to watch, what to do. Be concise. Use markdown bullets only. No headings, no preamble. Do NOT mention that a category was empty or that there were no items — just recap the most relevant events.

ITEMS (${window}):
${briefs}`;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
    }),
  });
  if (!resp.ok) {
    return briefs;
  }
  const data = await resp.json();
  return (data.choices?.[0]?.message?.content || "").trim() || briefs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authErr = await requireHitekAdmin(req);
  if (authErr) return authErr;
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const { data: boundsRows, error: boundsError } = await supabase.rpc("casablanca_week_bounds", {
      _anchor: now.toISOString(),
    });
    if (boundsError) throw new Error(boundsError.message);
    const bounds = boundsRows?.[0];
    if (!bounds) throw new Error("Could not calculate Morocco week bounds");
    const year = bounds.iso_year;
    const week = bounds.iso_week;
    const currentStart = bounds.period_start;
    const currentEnd = bounds.period_end;
    const previousEndDate = new Date(`${currentStart}T00:00:00Z`);
    previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setUTCDate(previousStartDate.getUTCDate() - 6);
    const previousStart = previousStartDate.toISOString().slice(0, 10);
    const previousEnd = previousEndDate.toISOString().slice(0, 10);

    const { data: currentItems, error } = await supabase.rpc("canonical_intelligence", {
      _start_date: currentStart, _end_date: currentEnd, _limit: 500,
    });
    if (error) throw new Error(error.message);
    const { data: previousItems, error: previousError } = await supabase.rpc("canonical_intelligence", {
      _start_date: previousStart, _end_date: previousEnd, _limit: 500,
    });
    if (previousError) throw new Error(previousError.message);

    const currentAll = currentItems || [];
    const prevAll = previousItems || [];
    const generated: any[] = [];

    // Wipe this week's existing rows up front so re-runs are idempotent across the new category schema.
    await supabase.from("weekly_digests").delete().eq("year", year).eq("week_number", week);

    // One digest per CATEGORY (operational / financial / global), stored in the `department` column for compatibility.
    for (const cat of CATEGORIES) {
      const catItems = currentAll.filter((i: any) => categoryOf(i) === cat);
      // Fallback to the same category from the previous week; if that is also empty,
      // fall back to the broader previous-week feed so the section is never blank.
      const prevCatItems = prevAll.filter((i: any) => categoryOf(i) === cat);
      const fallback = prevCatItems.length > 0 ? prevCatItems : prevAll;
      const md = await summarize(LOVABLE_API_KEY, CAT_LABEL[cat], catItems, fallback);
      const usedCount = catItems.length > 0 ? catItems.length : fallback.length;
      const usingCurrent = catItems.length > 0;
      const used = usingCurrent ? catItems : fallback;
      const row = {
        year,
        week_number: week,
        category: cat,
        department: null,
        summary_md: md,
        item_count: usedCount,
        act_now_count: used.filter((i: any) => i.severity === "act_now").length,
        this_week_count: used.filter((i: any) => i.severity === "this_week").length,
        awareness_count: used.filter((i: any) => i.severity === "awareness").length,
        period_start: usingCurrent ? currentStart : previousStart,
        period_end: usingCurrent ? currentEnd : previousEnd,
      };
      // v2 schema: category column drives grouping (was misnamed `department` before).
      console.log(`[digest v2] inserting cat=${cat} current=${catItems.length} fallback=${fallback.length}`);
      const { error: insErr } = await supabase.from("weekly_digests").insert(row);
      if (insErr) console.error(`[digest v2] insert ${cat} failed:`, insErr.message, JSON.stringify(row));
      generated.push({ category: cat, items: catItems.length });
    }

    // "All" bucket removed — Global category is the top-level view.

    return new Response(
      JSON.stringify({ success: true, year, week, generated, total: currentAll.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-weekly-digest error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});