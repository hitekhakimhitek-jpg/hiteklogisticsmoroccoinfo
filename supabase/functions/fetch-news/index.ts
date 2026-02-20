import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = ["regulation", "weather", "port", "trade", "compliance", "market", "general"];
const REGIONS = ["morocco", "europe", "asia", "americas", "africa", "middle_east", "global"];
const PRIORITIES = ["critical", "important", "informational"];

const FETCH_PROMPT = `You are a freight forwarding intelligence analyst specializing in Morocco and global logistics. Generate a JSON array of 8-12 realistic, current freight/logistics news entries.

Each entry must be a JSON object with these exact fields:
- "headline": string (concise, professional news headline)
- "summary": string (2-3 sentences summarizing the news)
- "source_name": string (realistic source like "Lloyd's List", "FreightWaves", "ADII Morocco", "The Loadstar", "JOC", "European Commission", "IATA", "IMO", "Drewry", "Morocco World News")
- "source_url": string (a plausible real URL for the source — e.g. "https://www.lloydslist.com/...", "https://www.freightwaves.com/news/...", "https://www.theloadstar.com/...", "https://www.joc.com/...", "https://www.iata.org/...", "https://www.imo.org/...", "https://www.moroccoworldnews.com/...", "https://www.douane.gov.ma/...")
- "category": one of ${JSON.stringify(CATEGORIES)}
- "region": one of ${JSON.stringify(REGIONS)}
- "priority": one of ${JSON.stringify(PRIORITIES)}
- "impact_assessment": string (1-2 sentences on operational impact)
- "action_required": boolean
- "suggested_action": string or null
- "published_date": string (MUST be exactly "${new Date().toISOString().split("T")[0]}" — today's date, no exceptions)

Requirements:
- CRITICAL: ALL entries MUST have published_date set to EXACTLY today: ${new Date().toISOString().split("T")[0]}. Do NOT use any past dates.
- At least 3 entries should be Morocco-focused (region: "morocco")
- At least 1-2 should be "critical" priority
- Mix of categories — cover regulations, weather, port updates, trade, compliance, market
- Make content realistic and actionable for a Morocco-based freight forwarder
- Reference real ports (Tanger Med, Casablanca, Agadir), real organizations (ADII, OTC, ANP), real trade lanes
- Always include a realistic source_url for every entry — use real domains like lloydslist.com, freightwaves.com, theloadstar.com, joc.com, douane.gov.ma, moroccoworldnews.com
- Today's date is ${new Date().toISOString().split("T")[0]}

Return ONLY a valid JSON array. No markdown, no explanation.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Generate news via AI
    console.log("Fetching news from AI...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: FETCH_PROMPT }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";

    // Clean markdown fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let entries;
    try {
      entries = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", content.substring(0, 500));
      throw new Error("Failed to parse AI-generated news");
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("AI returned empty or invalid entries");
    }

    // Step 2: Insert into database
    const now = new Date();
    const weekNumber = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    const rows = entries.map((e: any) => ({
      headline: e.headline,
      summary: e.summary,
      source_name: e.source_name || "AI Generated",
      source_url: e.source_url || null,
      category: CATEGORIES.includes(e.category) ? e.category : "general",
      region: REGIONS.includes(e.region) ? e.region : "global",
      priority: PRIORITIES.includes(e.priority) ? e.priority : "informational",
      impact_assessment: e.impact_assessment || null,
      action_required: e.action_required || false,
      suggested_action: e.suggested_action || null,
      published_date: now.toISOString().split("T")[0], // Always force today's date
      week_number: weekNumber,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    }));

    const { data, error } = await supabase.from("news_entries").insert(rows).select();

    if (error) {
      console.error("DB insert error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Step 3: Cleanup old entries (>90 days)
    await supabase.rpc("cleanup_old_entries");

    console.log(`Successfully inserted ${data.length} news entries`);

    return new Response(
      JSON.stringify({ success: true, count: data.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-news error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
