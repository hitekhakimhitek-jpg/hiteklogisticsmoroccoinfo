import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `You are "Hitek Info Assistant", an AI-powered freight forwarding intelligence assistant specializing in Morocco and global logistics.

Your knowledge covers:
- International freight forwarding, shipping, and logistics
- Morocco's ports (Tanger Med, Casablanca, Agadir) and trade operations
- Customs regulations (including Morocco's ADII/PortNet system)
- EU trade regulations, CBAM, and compliance requirements
- Global shipping lanes, carrier operations, and freight rates
- Weather disruptions affecting maritime and air freight
- Trade agreements, sanctions, and tariff updates
- Incoterms, documentation requirements, and best practices
- IATA regulations for air cargo
- IMO maritime regulations

When answering:
1. Be specific and actionable — provide concrete recommendations
2. Reference relevant regulations, ports, or carriers by name
3. Highlight compliance risks and deadlines
4. If discussing Morocco-specific topics, mention relevant local authorities (ADII, OTC, ANP)
5. When uncertain, clearly state limitations and suggest verification steps
6. Format responses clearly with bullet points and sections when appropriate
7. Always consider the freight forwarder's perspective — what actions should they take?
8. When referencing news from the intelligence feed, cite the source name and date
9. Prioritize the most recent and critical intelligence items when relevant to the user's question

Current context: You are helping a Morocco-based freight forwarder stay informed about industry developments, regulatory changes, and potential disruptions to their operations.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context-aware system prompt with live data
    let contextBlock = "";
    let newsCount = 0;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Fetch recent news (last 30 entries, prioritized)
      const { data: recentNews } = await supabase
        .from("news_entries")
        .select("headline, summary, category, region, priority, impact_assessment, action_required, suggested_action, source_name, published_date")
        .order("published_date", { ascending: false })
        .order("priority", { ascending: true })
        .limit(30);

      // Fetch latest weekly report
      const { data: weeklyReports } = await supabase
        .from("weekly_reports")
        .select("executive_summary, risk_score, outlook, key_takeaways, recommendations, week_number, year")
        .order("year", { ascending: false })
        .order("week_number", { ascending: false })
        .limit(1);

      // Fetch latest monthly summary
      const { data: monthlySummaries } = await supabase
        .from("monthly_summaries")
        .select("executive_summary, risk_score, forward_outlook, morocco_digest, trend_analysis, month, year")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(1);

      if (recentNews && recentNews.length > 0) {
        newsCount = recentNews.length;
        const criticalNews = recentNews.filter((n: any) => n.priority === "critical");
        const actionRequired = recentNews.filter((n: any) => n.action_required);

        contextBlock += `\n\n--- LIVE INTELLIGENCE FEED (${recentNews.length} recent entries) ---\n`;
        contextBlock += `Critical alerts: ${criticalNews.length} | Action required: ${actionRequired.length}\n\n`;

        // Include critical items in full
        if (criticalNews.length > 0) {
          contextBlock += "CRITICAL ALERTS:\n";
          for (const n of criticalNews) {
            contextBlock += `- [${n.published_date}] ${n.headline} (${n.source_name})\n  ${n.summary}\n`;
            if (n.impact_assessment) contextBlock += `  Impact: ${n.impact_assessment}\n`;
            if (n.suggested_action) contextBlock += `  Action: ${n.suggested_action}\n`;
          }
          contextBlock += "\n";
        }

        // Include other items as summaries
        const otherNews = recentNews.filter((n: any) => n.priority !== "critical");
        if (otherNews.length > 0) {
          contextBlock += "RECENT INTELLIGENCE:\n";
          for (const n of otherNews) {
            contextBlock += `- [${n.published_date}] [${n.category}/${n.region}] ${n.headline} (${n.source_name}): ${n.summary}\n`;
          }
          contextBlock += "\n";
        }
      }

      if (weeklyReports && weeklyReports.length > 0) {
        const wr = weeklyReports[0] as any;
        contextBlock += `LATEST WEEKLY REPORT (Week ${wr.week_number}, ${wr.year}):\n`;
        contextBlock += `Risk Score: ${wr.risk_score || "N/A"}/100\n`;
        contextBlock += `Summary: ${wr.executive_summary}\n`;
        if (wr.outlook) contextBlock += `Outlook: ${wr.outlook}\n`;
        if (wr.key_takeaways?.length) contextBlock += `Takeaways: ${(wr.key_takeaways as string[]).join("; ")}\n`;
        contextBlock += "\n";
      }

      if (monthlySummaries && monthlySummaries.length > 0) {
        const ms = monthlySummaries[0] as any;
        contextBlock += `LATEST MONTHLY SUMMARY (${ms.month}/${ms.year}):\n`;
        contextBlock += `Risk Score: ${ms.risk_score || "N/A"}/100\n`;
        contextBlock += `Summary: ${ms.executive_summary}\n`;
        if (ms.morocco_digest) contextBlock += `Morocco: ${ms.morocco_digest}\n`;
        if (ms.forward_outlook) contextBlock += `Outlook: ${ms.forward_outlook}\n`;
        contextBlock += "\n";
      }
    }

    const systemPrompt = BASE_SYSTEM_PROMPT + contextBlock;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service unavailable. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return stream with news count header
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Context-Count": String(newsCount),
      },
    });
  } catch (e) {
    console.error("freight-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
