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
  fallbackItems: any[] = []
): Promise<string> {
  const hasDept = items.length > 0;
  const source = hasDept ? items : fallbackItems;
  if (source.length === 0) {
    return `- Quiet week — no notable items logged across the dashboard.`;
  }
  const briefs = source
    .slice(0, 25)
    .map(
      (i) =>
        `- [${i.severity}] (${i.department}) ${i.headline}\n  Impact: ${i.impact}\n  Action: ${i.action_required}`
    )
    .join("\n");
  const prompt = hasDept
    ? `You write the weekly digest for the ${deptLabel} team at a Morocco freight forwarder. Summarize the week's intelligence in 4-6 plain bullet points: what changed, what to watch, what to do. Be concise. Use markdown bullets only. No headings, no preamble.

THIS WEEK'S ITEMS:
${briefs}`
    : `You write the weekly digest for the ${deptLabel} team at a Morocco freight forwarder. There were NO ${deptLabel}-tagged items this week, but write a useful 2-4 bullet recap of what the ${deptLabel} team should still note from the broader week (cross-impacts, things to monitor, regulatory or market context relevant to ${deptLabel}). Markdown bullets only. No headings, no preamble. Begin with one bullet stating that no direct ${deptLabel} alerts were logged this week.

THIS WEEK'S BROADER ITEMS (other departments):
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
    return `_Summary unavailable (${resp.status})_\n\n${briefs}`;
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
    const { year, week } = isoWeek(now);
    // CURRENT ISO WEEK only: Monday 00:00 UTC of the running week → now.
    const monday = new Date(now);
    const day = monday.getUTCDay() || 7; // Sun=0 → 7
    monday.setUTCDate(monday.getUTCDate() - (day - 1));
    monday.setUTCHours(0, 0, 0, 0);
    const weekStart = monday.toISOString();

    const { data: items, error } = await supabase
      .from("intelligence_items")
      .select("headline, summary, impact, action_required, department, severity, source_name, category, event_date, publication_date, created_at")
      .or(`event_date.gte.${monday.toISOString().slice(0,10)},and(event_date.is.null,created_at.gte.${weekStart})`)
      .neq("status", "archived");
    if (error) throw new Error(error.message);

    const all = items || [];
    const generated: any[] = [];

    // Wipe this week's existing rows up front so re-runs are idempotent across the new category schema.
    await supabase.from("weekly_digests").delete().eq("year", year).eq("week_number", week);

    // One digest per CATEGORY (operational / financial / global), stored in the `department` column for compatibility.
    for (const cat of CATEGORIES) {
      const catItems = all.filter((i: any) => categoryOf(i) === cat);
      const md = await summarize(LOVABLE_API_KEY, CAT_LABEL[cat], catItems, all);
      const row = {
        year,
        week_number: week,
        category: cat,
        department: null,
        summary_md: md,
        item_count: catItems.length,
        act_now_count: catItems.filter((i: any) => i.severity === "act_now").length,
        this_week_count: catItems.filter((i: any) => i.severity === "this_week").length,
      };
      // v2 schema: category column drives grouping (was misnamed `department` before).
      console.log(`[digest v2] inserting cat=${cat} items=${catItems.length}`);
      const { error: insErr } = await supabase.from("weekly_digests").insert(row);
      if (insErr) console.error(`[digest v2] insert ${cat} failed:`, insErr.message, JSON.stringify(row));
      generated.push({ category: cat, items: catItems.length });
    }

    // "All" bucket removed — Global category is the top-level view.

    return new Response(
      JSON.stringify({ success: true, year, week, generated, total: all.length }),
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