import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEPTS = ["operations", "compliance", "finance", "commercial", "it"] as const;
const DEPT_LABEL: Record<string, string> = {
  operations: "Operations",
  compliance: "Compliance",
  finance: "Finance",
  commercial: "Commercial",
  it: "IT",
};

function isoWeek(d: Date): { year: number; week: number } {
  // ISO 8601 week
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

async function summarize(LOVABLE_API_KEY: string, deptLabel: string, items: any[]): Promise<string> {
  if (items.length === 0) {
    return `_No ${deptLabel} items this week._`;
  }
  const briefs = items
    .slice(0, 25)
    .map(
      (i) =>
        `- [${i.severity}] ${i.headline}\n  Impact: ${i.impact}\n  Action: ${i.action_required}`
    )
    .join("\n");
  const prompt = `You write the weekly digest for the ${deptLabel} team at a Morocco freight forwarder. Summarize the week's intelligence in 4-6 plain bullet points: what changed, what to watch, what to do. Be concise. Use markdown bullets only. No headings, no preamble.

THIS WEEK'S ITEMS:
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
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const { year, week } = isoWeek(now);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: items, error } = await supabase
      .from("intelligence_items")
      .select("headline, summary, impact, action_required, department, severity, source_name")
      .gte("created_at", weekStart)
      .neq("status", "archived");
    if (error) throw new Error(error.message);

    const all = items || [];
    const generated: any[] = [];

    // Per-department digests
    for (const dept of DEPTS) {
      const deptItems = all.filter((i: any) => i.department === dept);
      const md = await summarize(LOVABLE_API_KEY, DEPT_LABEL[dept], deptItems);
      const row = {
        year,
        week_number: week,
        department: dept,
        summary_md: md,
        item_count: deptItems.length,
        act_now_count: deptItems.filter((i: any) => i.severity === "act_now").length,
        this_week_count: deptItems.filter((i: any) => i.severity === "this_week").length,
      };
      await supabase.from("weekly_digests").upsert(row, {
        onConflict: "year,week_number,department",
      });
      generated.push({ department: dept, items: deptItems.length });
    }

    // Global digest
    const globalMd = await summarize(LOVABLE_API_KEY, "company-wide", all);
    await supabase.from("weekly_digests").delete().is("department", null).eq("year", year).eq("week_number", week);
    await supabase.from("weekly_digests").insert({
      year,
      week_number: week,
      department: null,
      summary_md: globalMd,
      item_count: all.length,
      act_now_count: all.filter((i: any) => i.severity === "act_now").length,
      this_week_count: all.filter((i: any) => i.severity === "this_week").length,
    });

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