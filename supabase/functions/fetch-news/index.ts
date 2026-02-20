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

// Search queries to find real freight/logistics news
const SEARCH_QUERIES = [
  // TIER 1 — Freight & logistics
  "freight forwarding shipping logistics news today site:freightwaves.com OR site:theloadstar.com OR site:joc.com OR site:lloydslist.com",
  "maritime shipping disruption port congestion today site:hellenicshippingnews.com OR site:splash247.com OR site:gcaptain.com OR site:seatrade-maritime.com",
  // TIER 2 — Morocco specific
  "Morocco trade port Tanger Med customs ADII shipping",
  "Maroc commerce port douane fret logistique site:lematin.ma OR site:medias24.com OR site:fnh.ma",
  // TIER 3 — Regulations & compliance
  "IMO shipping regulation 2025 OR customs compliance OR trade sanctions site:imo.org OR site:wto.org OR site:iata.org OR site:wcoomd.org",
  // TIER 4 — Disruptions
  "port disruption weather shipping delay Suez Canal Mediterranean Gibraltar",
  // TIER 5 — General freight keywords
  "freight forwarding OR shipping disruption OR port congestion OR customs regulation OR supply chain OR tariff update OR Suez Canal OR Mediterranean shipping",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured. Please connect Firecrawl.");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toISOString().split("T")[0];

    // Step 1: Scrape real news using Firecrawl Search API
    console.log("Scraping real news from web sources...");

    const allArticles: Array<{
      title: string;
      url: string;
      description: string;
      source: string;
      markdown?: string;
    }> = [];

    // Run searches in parallel batches to stay within timeout
    const searchPromises = SEARCH_QUERIES.map(async (query) => {
      try {
        const response = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 5,
            tbs: "qdr:d", // Last 24 hours
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Firecrawl search error for "${query.substring(0, 50)}...":`, response.status, errText);
          return [];
        }

        const result = await response.json();
        const items = result.data || result.results || [];
        return items.map((item: any) => ({
          title: item.title || item.metadata?.title || "",
          url: item.url || item.metadata?.sourceURL || "",
          description: item.description || item.excerpt || "",
          source: extractSourceName(item.url || ""),
          markdown: item.markdown?.substring(0, 1000) || "",
        }));
      } catch (e) {
        console.error(`Search failed for query: ${query.substring(0, 50)}...`, e);
        return [];
      }
    });

    const results = await Promise.all(searchPromises);
    for (const batch of results) {
      allArticles.push(...batch);
    }

    // Deduplicate by URL
    const uniqueArticles = Array.from(
      new Map(allArticles.filter(a => a.url && a.title).map(a => [a.url, a])).values()
    );

    console.log(`Found ${uniqueArticles.length} unique articles from web scraping`);

    if (uniqueArticles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, count: 0, message: "No new articles found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Use AI to categorize, filter, and assess each article for Morocco freight relevance
    console.log("Using AI to categorize and filter articles...");

    const articleSummaries = uniqueArticles.slice(0, 30).map((a, i) =>
      `[${i}] TITLE: ${a.title}\nURL: ${a.url}\nSOURCE: ${a.source}\nDESCRIPTION: ${a.description}\nCONTENT PREVIEW: ${a.markdown?.substring(0, 300) || "N/A"}`
    ).join("\n\n---\n\n");

    const classifyPrompt = `You are a freight forwarding intelligence analyst specializing in Morocco and global logistics.

I have scraped the following real news articles from the web. Your job is to:
1. FILTER: Only keep articles relevant to freight forwarding, shipping, logistics, trade, customs, port operations, or supply chain for a company operating from Morocco.
2. CATEGORIZE each relevant article.
3. ASSESS priority and impact.

For each relevant article, return a JSON object with these fields:
- "index": number (the [index] from the input)
- "headline": string (use the original title, cleaned up if needed)
- "summary": string (2-3 sentences summarizing the news and its relevance to freight)
- "category": one of ${JSON.stringify(CATEGORIES)}
- "region": one of ${JSON.stringify(REGIONS)} (based on where the event/regulation applies)
- "priority": one of ${JSON.stringify(PRIORITIES)}
  - "critical": Direct operational impact (port closures, new sanctions, route blocked, major regulatory changes)
  - "important": Indirect but significant impact (rate changes, carrier updates, trade policy shifts)
  - "informational": Good to know, no immediate action needed
- "impact_assessment": string (1-2 sentences on how this affects a Morocco-based freight forwarder)
- "action_required": boolean
- "suggested_action": string or null (what should the freight forwarder do)

IMPORTANT RULES:
- ONLY include articles that are ACTUALLY relevant to freight forwarding / logistics / trade
- Discard generic news, opinion pieces, or irrelevant content
- Be accurate with categorization — don't guess
- Today's date is ${today}

Here are the scraped articles:

${articleSummaries}

Return ONLY a valid JSON array of the relevant articles. No markdown fences, no explanation.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: classifyPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI classification error:", aiResponse.status, errText);
      throw new Error(`AI classification error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let classifiedEntries;
    try {
      classifiedEntries = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI classification:", content.substring(0, 500));
      throw new Error("Failed to parse AI classification response");
    }

    if (!Array.isArray(classifiedEntries) || classifiedEntries.length === 0) {
      console.log("AI filtered out all articles as irrelevant");
      return new Response(
        JSON.stringify({ success: true, count: 0, message: "No freight-relevant articles found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Map classified entries back to original articles and insert
    const now = new Date();
    const weekNumber = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    const rows = classifiedEntries.map((entry: any) => {
      const originalArticle = uniqueArticles[entry.index] || {};
      return {
        headline: entry.headline || originalArticle.title,
        summary: entry.summary || originalArticle.description,
        source_name: originalArticle.source || extractSourceName(originalArticle.url || ""),
        source_url: originalArticle.url || null,
        category: CATEGORIES.includes(entry.category) ? entry.category : "general",
        region: REGIONS.includes(entry.region) ? entry.region : "global",
        priority: PRIORITIES.includes(entry.priority) ? entry.priority : "informational",
        impact_assessment: entry.impact_assessment || null,
        action_required: entry.action_required || false,
        suggested_action: entry.suggested_action || null,
        published_date: today,
        week_number: weekNumber,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      };
    });

    const { data, error } = await supabase.from("news_entries").insert(rows).select();

    if (error) {
      console.error("DB insert error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Cleanup old entries (>90 days)
    await supabase.rpc("cleanup_old_entries");

    console.log(`Successfully inserted ${data.length} REAL news entries from web scraping`);

    return new Response(
      JSON.stringify({
        success: true,
        count: data.length,
        sources: [...new Set(rows.map((r: any) => r.source_name))],
      }),
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

function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const sourceMap: Record<string, string> = {
      "freightwaves.com": "FreightWaves",
      "theloadstar.com": "The Loadstar",
      "joc.com": "JOC",
      "lloydslist.com": "Lloyd's List",
      "hellenicshippingnews.com": "Hellenic Shipping News",
      "splash247.com": "Splash247",
      "gcaptain.com": "gCaptain",
      "seatrade-maritime.com": "Seatrade Maritime",
      "tangermed.ma": "Tanger Med",
      "anp.org.ma": "ANP Morocco",
      "douane.gov.ma": "ADII Morocco",
      "mcinet.gov.ma": "Ministry of Trade Morocco",
      "lematin.ma": "Le Matin",
      "medias24.com": "Medias24",
      "fnh.ma": "Finances News Hebdo",
      "imo.org": "IMO",
      "wto.org": "WTO",
      "iata.org": "IATA",
      "ec.europa.eu": "European Commission",
      "wcoomd.org": "WCO",
      "marinetraffic.com": "MarineTraffic",
      "portwatch.imf.org": "IMF PortWatch",
    };
    return sourceMap[hostname] || hostname;
  } catch {
    return "Unknown Source";
  }
}
