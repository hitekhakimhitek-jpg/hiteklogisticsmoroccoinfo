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
  // TIER 1 — Freight & logistics news
  "freight forwarding shipping logistics news today site:freightwaves.com OR site:theloadstar.com OR site:joc.com OR site:lloydslist.com",
  "maritime shipping disruption port congestion today site:hellenicshippingnews.com OR site:splash247.com OR site:gcaptain.com OR site:seatrade-maritime.com",
  // TIER 2 — Morocco specific (ADII, PortNet, Tanger Med)
  "Morocco trade port Tanger Med customs ADII shipping PortNet",
  "Maroc douane ADII circulaire tarif douanier site:douane.gov.ma OR site:adil.gov.ma OR site:portnet.ma",
  "Tanger Med port authority community system site:tangermed.ma OR site:tmpa.ma",
  "Maroc commerce port douane fret logistique site:lematin.ma OR site:medias24.com OR site:fnh.ma OR site:economiste.com OR site:lavieeco.com",
  // TIER 2b — Morocco & international finance impacting freight
  "Maroc dirham taux change devises import export finance site:economiste.com OR site:lavieeco.com OR site:medias24.com OR site:fnh.ma",
  "Morocco currency exchange rate dirham trade finance banking site:reuters.com OR site:bloomberg.com OR site:ft.com",
  "oil price fuel surcharge bunker freight shipping cost impact",
  "global trade tariffs sanctions embargo impact Africa Morocco shipping",
  // TIER 3 — Regulations, compliance & reference bodies
  "IMO shipping regulation 2025 OR IMDG code dangerous goods OR customs compliance OR trade sanctions site:imo.org OR site:wto.org OR site:iata.org OR site:wcoomd.org",
  "FIATA freight forwarding documents FBL FCR site:fiata.org OR site:iccwbo.org incoterms",
  "IATA dangerous goods regulations air cargo DGR site:iata.org",
  "WCO harmonized system HS code classification site:wcoomd.org",
  "UNECE CEFACT e-CMR electronic consignment note site:unece.org",
  // TIER 4 — Disruptions & weather
  "port disruption weather shipping delay Suez Canal Mediterranean Gibraltar",
  // TIER 5 — Market intelligence & benchmarking
  "World Bank logistics performance index LPI site:lpi.worldbank.org OR site:worldbank.org",
  "UNCTAD review maritime transport shipping site:unctad.org",
  "ITC trade map Morocco trade flows site:trademap.org OR site:intracen.org",
  // TIER 6 — General freight keywords
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
            tbs: "qdr:w", // Last week for more results
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

    // Filter out generic/non-article URLs before deduplication
    const isValidArticleUrl = (url: string): boolean => {
      try {
        const u = new URL(url);
        const path = u.pathname;
        // Reject generic index/listing pages
        if (path === "/" || path === "/en/" || path === "/news/" || path === "/en/news/") return false;
        // Reject generic PHP listing pages
        if (path.endsWith("view_more_news.php") || path.endsWith("index.php")) return false;
        // Reject social media links (facebook, twitter, linkedin)
        if (u.hostname.includes("facebook.com") || u.hostname.includes("twitter.com") || u.hostname.includes("linkedin.com")) return false;
        // Reject very short paths (likely homepages)
        if (path.split("/").filter(Boolean).length < 2) return false;
        return true;
      } catch {
        return false;
      }
    };

    // Deduplicate by URL and filter bad URLs
    const uniqueArticles = Array.from(
      new Map(
        allArticles
          .filter(a => a.url && a.title && isValidArticleUrl(a.url))
          .map(a => [a.url, a])
      ).values()
    );

    // Step 1b: Validate URLs actually resolve (HEAD request, parallel, with timeout)
    console.log(`Validating ${uniqueArticles.length} article URLs...`);
    const validatedArticles: typeof uniqueArticles = [];
    const validationPromises = uniqueArticles.map(async (article) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(article.url, {
          method: "HEAD",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; FreightPulse/1.0)" },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeout);
        if (resp.ok) return article;
        // Try GET if HEAD fails (some servers don't support HEAD)
        if (resp.status === 405 || resp.status === 403) {
          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), 5000);
          const resp2 = await fetch(article.url, {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; FreightPulse/1.0)" },
            signal: controller2.signal,
            redirect: "follow",
          });
          clearTimeout(timeout2);
          await resp2.text(); // consume body
          if (resp2.ok) return article;
        }
        console.log(`URL validation failed (${resp.status}): ${article.url}`);
        return null;
      } catch (e) {
        console.log(`URL validation error: ${article.url} - ${e}`);
        return null;
      }
    });

    const validationResults = await Promise.all(validationPromises);
    for (const article of validationResults) {
      if (article) validatedArticles.push(article);
    }

    console.log(`${validatedArticles.length} articles passed URL validation`);

    // Use validated articles from here on
    const articlesToProcess = validatedArticles;

    console.log(`Found ${articlesToProcess.length} validated articles from web scraping`);

    if (articlesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, count: 0, message: "No new articles with valid URLs found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Use AI to categorize, filter, and assess each article for Morocco freight relevance
    console.log("Using AI to categorize and filter articles...");

    const articleSummaries = articlesToProcess.slice(0, 20).map((a, i) =>
      `[${i}] TITLE: ${a.title}\nURL: ${a.url}\nSOURCE: ${a.source}\nDESCRIPTION: ${a.description}\nCONTENT PREVIEW: ${a.markdown?.substring(0, 200) || "N/A"}`
    ).join("\n\n---\n\n");

    const classifyPrompt = `You are a freight forwarding intelligence analyst specializing in Morocco and global logistics.

I have scraped the following real news articles from the web. Your job is to:
1. FILTER: Only keep articles relevant to freight forwarding, shipping, logistics, trade, customs, port operations, dangerous goods, compliance, supply chain, OR FINANCE (currency exchange rates, oil/fuel prices, trade tariffs, sanctions, banking/credit conditions) that could impact a Morocco-based freight forwarding company.
2. CATEGORIZE each relevant article.
3. ASSESS priority and impact using the CONTENT PRIORITIZATION HIERARCHY below.

CONTENT PRIORITIZATION HIERARCHY (apply strictly):

**ABSOLUTE #1 PRIORITY — NEW LAWS, RULES, CIRCULARS & BINDING CHANGES:**
Any article about a NEW law, regulation, circular, decree, rule change, tariff update, or policy change that a freight forwarding company MUST act upon. Examples:
- New ADII customs circular or tariff change
- New IMO regulation or IMDG Code amendment
- New IATA DGR requirement
- New WCO HS classification update
- New Incoterms interpretation or ICC ruling
- New EU/Morocco trade agreement clause
- New port authority rule or procedure change
- Any government decree affecting import/export
These MUST be flagged as "critical" with action_required=true. The suggested_action must explain exactly what the company needs to do to comply.

**2nd PRIORITY — DIRECT OPERATIONAL IMPACT:**
Information concretely affecting day-to-day workflows, costs, timelines, or procedures (port closures, route changes, rate surcharges, weather disruptions, carrier schedule changes). Flag as "important".

**3rd PRIORITY — EVERYTHING ELSE:**
Market stories, trend narratives, speculative forecasts, benchmarking data (LPI, UNCTAD reports), general commentary. Flag as "informational" unless they contain concrete operational triggers.

CRITICAL CATEGORIZATION RULES FOR "regulation" AND "compliance":
- category "regulation" = ONLY for articles that explicitly announce or describe a NEW law, decree, government rule, official circular, or binding legislative change. The article must reference a specific legal instrument (law number, decree, circular, directive, amendment, etc.).
- category "compliance" = ONLY for articles about official enforcement updates, binding classification changes, DG requirement changes, or mandatory procedural changes issued by an authority.
- If an article is general news, market commentary, industry trends, opinion, analysis, or a story ABOUT regulations without announcing a specific new rule — it is NOT "regulation" or "compliance". Categorize it as "trade", "market", "port", "weather", or "general" instead.
- NEVER put general freight news, market updates, port congestion stories, or shipping disruption reports under "regulation" or "compliance".
- When in doubt, do NOT use "regulation" or "compliance". Only use them when the article explicitly references a specific new/changed law or binding rule.

For each relevant article, return a JSON object with these fields:
- "index": number (the [index] from the input)
- "headline": string (use the original title, cleaned up if needed)
- "summary": string (2-3 sentences summarizing the news and its relevance to freight)
- "category": one of ${JSON.stringify(CATEGORIES)}
  - Use "regulation" for new laws, decrees, government rules
  - Use "compliance" for circulars, enforcement updates, classification changes, DG requirements
- "region": one of ${JSON.stringify(REGIONS)} (based on where the event/regulation applies)
- "priority": one of ${JSON.stringify(PRIORITIES)}
  - "critical": New binding law/rule/circular that requires company action
  - "important": Significant indirect impact on operations, costs, or procedures
  - "informational": Good to know, no immediate action needed
- "impact_likelihood": "high" | "medium" | "low"
- "impact_assessment": string (1-2 sentences on how this affects a Morocco-based freight forwarder)
- "action_required": boolean (MUST be true for any new law/rule/circular)
- "suggested_action": string or null (for action_required=true: what exactly must the company do to comply)

IMPORTANT RULES:
- ONLY include articles that are ACTUALLY relevant to freight forwarding / logistics / trade
- New laws and regulations are the MOST IMPORTANT content — never skip them
- Discard generic news, opinion pieces, or irrelevant content
- Deprioritize or OMIT items that are speculative or unlikely to have a tangible effect
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
        max_tokens: 8000,
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
      // Try to salvage truncated JSON by finding the last complete object
      console.warn("Initial JSON parse failed, attempting to salvage truncated response...");
      try {
        // Find the last complete object by looking for the last '}' followed by potential ']'
        const lastCompleteObj = content.lastIndexOf("}");
        if (lastCompleteObj > 0) {
          const salvaged = content.substring(0, lastCompleteObj + 1) + "]";
          classifiedEntries = JSON.parse(salvaged);
          console.log(`Salvaged ${classifiedEntries.length} entries from truncated response`);
        } else {
          throw new Error("No salvageable JSON found");
        }
      } catch (e2) {
        console.error("Failed to parse AI classification:", content.substring(0, 500));
        throw new Error("Failed to parse AI classification response");
      }
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
      const originalArticle = articlesToProcess[entry.index] || {};
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
      "tmpa.ma": "Tanger Med Port Authority",
      "anp.org.ma": "ANP Morocco",
      "douane.gov.ma": "ADII Morocco (Customs)",
      "adil.gov.ma": "ADiL (Customs Clearance)",
      "portnet.ma": "PortNet Morocco",
      "mcinet.gov.ma": "Ministry of Trade Morocco",
      "lematin.ma": "Le Matin",
      "medias24.com": "Medias24",
      "fnh.ma": "Finances News Hebdo",
      "economiste.com": "L'Economiste",
      "lavieeco.com": "La Vie Éco",
      "imo.org": "IMO",
      "wto.org": "WTO",
      "iata.org": "IATA",
      "ec.europa.eu": "European Commission",
      "wcoomd.org": "WCO",
      "fiata.org": "FIATA",
      "iccwbo.org": "ICC (Incoterms)",
      "unece.org": "UNECE",
      "unctad.org": "UNCTAD",
      "worldbank.org": "World Bank",
      "lpi.worldbank.org": "World Bank LPI",
      "trademap.org": "ITC Trade Map",
      "intracen.org": "ITC",
      "marinetraffic.com": "MarineTraffic",
      "portwatch.imf.org": "IMF PortWatch",
    };
    return sourceMap[hostname] || hostname;
  } catch {
    return "Unknown Source";
  }
}
