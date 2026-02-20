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
    const { type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    const callAI = async (prompt: string) => {
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
      return JSON.parse(content);
    };

    if (type === "weekly") {
      const weekNumber = Math.ceil(
        (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
      );

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

      const prompt = `You are a senior freight intelligence analyst producing a weekly briefing for a Morocco-based freight forwarder. Analyze the following ${news.length} news entries and produce a comprehensive, polished intelligence report.

CONTENT PRIORITIZATION (apply this hierarchy strictly):
1st: Compliance & Regulatory — customs regulations, policy changes, enforcement updates, legal obligations, ADII circulars, IMO/IATA/WCO changes
2nd: Direct Operational Impact — port closures, route changes, rate surcharges, weather disruptions, carrier changes
3rd: Everything Else — market stories, trends, forecasts, benchmarking

News entries:
${JSON.stringify(news, null, 2)}

Generate a JSON object with these exact fields:
- "executive_summary": string (4-6 well-written sentences structured as a professional paragraph, NOT bullet points. Start with compliance/regulatory highlights, then operational impacts, then market context. Write it as a polished executive brief.)
- "risk_score": integer 1-100 (overall operational risk score for the week, where 1=minimal risk, 100=severe disruption. Weight compliance deadlines and regulatory changes heavily.)
- "outlook": string (2-3 sentences on what to expect next week — upcoming compliance deadlines first, then operational factors, then market trends)
- "key_takeaways": array of 3-5 strings (concise takeaways a logistics manager can act on immediately, ordered by priority: compliance first, then operational, then market)
- "recommendations": array of objects {priority: "urgent"|"important"|"monitor", action: string, rationale: string} (3-5 concrete operational recommendations, ordered by priority)
- "report_json": object with keys "critical", "regulatory", "trade", "disruptions", "general", "morocco" — each containing an array of entry IDs from the news that belong to that section

Return ONLY valid JSON. No markdown.`;

      const report = await callAI(prompt);

      const { error } = await supabase.from("weekly_reports").upsert({
        week_number: weekNumber,
        year: now.getFullYear(),
        executive_summary: report.executive_summary,
        report_json: report.report_json || {},
        risk_score: report.risk_score || null,
        outlook: report.outlook || null,
        key_takeaways: report.key_takeaways || [],
        recommendations: report.recommendations || [],
      }, { onConflict: "week_number,year" });

      if (error) throw new Error(`DB error: ${error.message}`);

      return new Response(
        JSON.stringify({ success: true, type: "weekly", week: weekNumber, risk_score: report.risk_score }),
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

      const prompt = `You are a senior freight intelligence analyst producing a monthly executive summary for a Morocco-based freight forwarder. Analyze the following ${news.length} news entries from this month.

CONTENT PRIORITIZATION (apply this hierarchy strictly throughout the report):
1st: Compliance & Regulatory — customs regulations, ADII circulars, IMO/IATA/WCO changes, legal obligations
2nd: Direct Operational Impact — port closures, route changes, rate surcharges, weather disruptions
3rd: Everything Else — market stories, trends, forecasts, benchmarking data

News entries:
${JSON.stringify(news, null, 2)}

Generate a JSON object with these exact fields:
- "executive_summary": string (5-7 well-written sentences as a polished professional paragraph. Structure: compliance/regulatory highlights first, then operational impacts, then market context. NO bullet points.)
- "risk_score": integer 1-100 (overall monthly risk assessment, weighting compliance deadlines heavily)
- "top_events": array of {rank: number, headline: string, impact: "Critical"|"High"|"Medium"|"Low", category: string, analysis: string} (top 10 events ranked by priority hierarchy: compliance first, operational second, market third)
- "compliance_tracker": array of {item: string, deadline: string, status: "addressed"|"pending"|"action_needed", detail: string} where detail explains what needs to be done
- "morocco_digest": string (detailed paragraph about Morocco-specific developments — ADII changes, PortNet updates, Tanger Med operations, customs procedures, trade lanes, regulatory changes)
- "trend_analysis": array of {trend: string, direction: "rising"|"stable"|"declining", description: string} (3-5 key trends observed this month)
- "forward_outlook": string (3-4 sentences: upcoming compliance deadlines first, then operational factors, then market predictions)
- "month_comparison": object with {disruptions, regulations, criticalAlerts, newsItems} each having {current: number, previous: number, change: number (percentage)}

Return ONLY valid JSON. No markdown.`;

      const summary = await callAI(prompt);

      const { error } = await supabase.from("monthly_summaries").upsert({
        month,
        year,
        executive_summary: summary.executive_summary,
        top_events: summary.top_events || [],
        compliance_tracker: summary.compliance_tracker || [],
        morocco_digest: summary.morocco_digest || null,
        month_comparison: summary.month_comparison || null,
        risk_score: summary.risk_score || null,
        trend_analysis: summary.trend_analysis || [],
        forward_outlook: summary.forward_outlook || null,
      }, { onConflict: "month,year" });

      if (error) throw new Error(`DB error: ${error.message}`);

      return new Response(
        JSON.stringify({ success: true, type: "monthly", month, year, risk_score: summary.risk_score }),
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
