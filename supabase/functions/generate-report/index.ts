import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type } = await req.json(); // "weekly" or "monthly"
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    if (type === "weekly") {
      const weekNumber = Math.ceil(
        (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
      );

      // Fetch this week's news
      const { data: news } = await supabase
        .from("news_entries")
        .select("*")
        .eq("week_number", weekNumber)
        .eq("year", now.getFullYear())
        .order("priority", { ascending: true });

      if (!news || news.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: "No news entries for this week" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const prompt = `You are a freight intelligence analyst. Based on the following ${news.length} news entries from this week, generate a weekly intelligence report.

News entries:
${JSON.stringify(news, null, 2)}

Generate a JSON object with:
- "executive_summary": string (3-5 sentence overview of the week's key developments)
- "report_json": object with keys "critical", "regulatory", "trade", "disruptions", "general", "morocco" — each containing an array of entry IDs from the news that belong to that section

Return ONLY valid JSON. No markdown.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResp.ok) {
        const t = await aiResp.text();
        throw new Error(`AI error: ${aiResp.status} ${t}`);
      }

      const aiData = await aiResp.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      const report = JSON.parse(content);

      const { error } = await supabase.from("weekly_reports").upsert({
        week_number: weekNumber,
        year: now.getFullYear(),
        executive_summary: report.executive_summary,
        report_json: report.report_json || {},
      }, { onConflict: "week_number,year" });

      if (error) throw new Error(`DB error: ${error.message}`);

      return new Response(
        JSON.stringify({ success: true, type: "weekly", week: weekNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "monthly") {
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data: news } = await supabase
        .from("news_entries")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .order("priority", { ascending: true });

      if (!news || news.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: "No news entries for this month" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const prompt = `You are a freight intelligence analyst. Based on the following ${news.length} news entries from this month, generate a monthly summary.

News entries:
${JSON.stringify(news, null, 2)}

Generate a JSON object with:
- "executive_summary": string (5-7 sentence overview)
- "top_events": array of {rank, headline, impact, category} (top 10)
- "compliance_tracker": array of {item, deadline, status} where status is "addressed"|"pending"|"action_needed"
- "morocco_digest": string (paragraph about Morocco-specific events)
- "month_comparison": object with {disruptions, regulations, criticalAlerts, newsItems} each having {current: number, previous: number, change: number}

Return ONLY valid JSON. No markdown.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResp.ok) {
        const t = await aiResp.text();
        throw new Error(`AI error: ${aiResp.status} ${t}`);
      }

      const aiData = await aiResp.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      const summary = JSON.parse(content);

      const { error } = await supabase.from("monthly_summaries").upsert({
        month,
        year,
        executive_summary: summary.executive_summary,
        top_events: summary.top_events || [],
        compliance_tracker: summary.compliance_tracker || [],
        morocco_digest: summary.morocco_digest || null,
        month_comparison: summary.month_comparison || null,
      }, { onConflict: "month,year" });

      if (error) throw new Error(`DB error: ${error.message}`);

      return new Response(
        JSON.stringify({ success: true, type: "monthly", month, year }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid type. Use "weekly" or "monthly".' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
