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

// Map source names → search queries. Only queries whose source name is in the enabled list will run.
const SOURCE_QUERIES: Record<string, string[]> = {
  // TIER 1 — Freight & logistics
  "FreightWaves": ["freight forwarding shipping logistics news today site:freightwaves.com"],
  "The Loadstar": ["freight shipping logistics news today site:theloadstar.com"],
  "JOC": ["freight shipping logistics news today site:joc.com"],
  "Lloyd's List": ["maritime shipping freight news today site:lloydslist.com"],
  "Hellenic Shipping News": ["maritime shipping disruption port congestion today site:hellenicshippingnews.com"],
  "Splash247": ["maritime shipping news today site:splash247.com"],
  "gCaptain": ["maritime shipping news today site:gcaptain.com"],
  "Seatrade Maritime": ["maritime shipping news today site:seatrade-maritime.com"],
  // TIER 2 — Morocco specific
  "ADII Morocco (Customs)": ["Maroc douane ADII circulaire tarif douanier site:douane.gov.ma"],
  "ADiL (Customs Clearance)": ["Maroc douane ADII site:adil.gov.ma"],
  "PortNet Morocco": ["Morocco PortNet site:portnet.ma"],
  "Tanger Med": ["Tanger Med port site:tangermed.ma"],
  "Tanger Med Port Authority": ["Tanger Med port authority site:tmpa.ma"],
  "L'Economiste": ["Maroc commerce économie logistique site:economiste.com"],
  "La Vie Éco": ["Maroc économie commerce logistique site:lavieeco.com"],
  "Médias24": ["Maroc économie commerce fret site:medias24.com"],
  "Finances News Hebdo": ["Maroc finance économie site:fnh.ma"],
  "Le Matin": ["Maroc commerce port douane fret logistique site:lematin.ma"],
  // TIER 3 — International bodies
  "IMO": ["IMO shipping regulation site:imo.org"],
  "IATA": ["IATA dangerous goods regulations air cargo DGR site:iata.org"],
  "WTO": ["WTO trade regulation site:wto.org"],
  "WCO": ["WCO harmonized system HS code classification site:wcoomd.org"],
  "FIATA": ["FIATA freight forwarding documents FBL FCR site:fiata.org"],
  "ICC (Incoterms)": ["ICC incoterms trade site:iccwbo.org"],
  "UNECE": ["UNECE CEFACT e-CMR electronic consignment note site:unece.org"],
  "European Commission": ["European Commission trade regulation customs site:ec.europa.eu"],
  // TIER 3b — Morocco finance & fiscal
  "DGI Maroc (Impôts)": [
    "Maroc fiscalité impôt TVA taxe loi de finances site:tax.gov.ma",
    "Morocco fiscal policy tax customs duty site:tax.gov.ma",
  ],
  "Bank Al-Maghrib": ["Bank Al-Maghrib taux directeur dirham change réglementation site:bkam.ma"],
  "SGG (Bulletin Officiel)": ["bulletin officiel Maroc loi décret circulaire fiscale site:sgg.gov.ma"],
  // TIER 5 — IT & Cybersecurity
  "BleepingComputer": ["cybersecurity vulnerability ransomware malware patch critical CVE site:bleepingcomputer.com"],
  "CISA": ["CISA advisory vulnerability alert critical infrastructure site:cisa.gov"],
  "The Register": ["cybersecurity IT infrastructure enterprise site:theregister.com"],
  "TechTarget": ["TechTarget cybersecurity IT infrastructure enterprise site:techtarget.com"],
  "Microsoft Security": ["Microsoft security update patch Tuesday MSRC site:msrc.microsoft.com OR site:microsoft.com/security"],
  "Google Cloud": ["Google Cloud security bulletin release notes site:cloud.google.com"],
  "AWS Security": ["AWS security advisory update site:aws.amazon.com/security OR site:aws.amazon.com/about-aws/whats-new"],
  "Ars Technica": ["technology cybersecurity AI news site:arstechnica.com"],
  "OpenAI": ["OpenAI news update release site:openai.com/blog OR site:openai.com/index"],
  "Anthropic": ["Anthropic news update release site:anthropic.com/news OR site:anthropic.com/research"],
  "MIT Technology Review": ["MIT Technology Review AI cybersecurity enterprise technology site:technologyreview.com"],
  "VentureBeat": ["VentureBeat AI enterprise technology cybersecurity site:venturebeat.com"],
  "Hugging Face Blog": ["Hugging Face AI machine learning models release site:huggingface.co/blog"],
  "Computer Weekly": ["Computer Weekly IT enterprise infrastructure cybersecurity site:computerweekly.com"],
  "IT Security Guru": ["IT Security Guru cybersecurity news vulnerability site:itsecurityguru.org"],
  "SD Times": ["SD Times software development DevOps enterprise IT site:sdtimes.com"],
  "ACM TechNews": ["ACM TechNews computing technology research site:technews.acm.org OR site:cacm.acm.org"],
  // TIER 6 — Market intelligence
  "UNCTAD": ["UNCTAD review maritime transport shipping site:unctad.org"],
  "World Bank": ["World Bank logistics trade development site:worldbank.org"],
  "World Bank LPI": ["World Bank logistics performance index LPI site:lpi.worldbank.org"],
  "ITC Trade Map": ["ITC trade map Morocco trade flows site:trademap.org"],
  "ITC": ["ITC trade Morocco site:intracen.org"],
  // Independent news
  "Voice of the Independent": ["Morocco news economy trade logistics site:voiceoftheindependent.com"],
};

// Fallback general queries that always run if no source-specific ones cover the topic
const GENERAL_QUERIES = [
  "Morocco trade port Tanger Med customs ADII shipping PortNet",
  "port disruption weather shipping delay Suez Canal Mediterranean Gibraltar",
  "freight forwarding OR shipping disruption OR port congestion OR customs regulation OR supply chain OR tariff update OR Suez Canal OR Mediterranean shipping",
];

// Morocco-specific search queries — always run when "Médias24" or any Morocco
// source is enabled, or when no source filter is provided. These catch
// time-sensitive civic events (manifestations, grèves, blocages) that
// generic logistics queries miss but which directly affect freight ops.
const MOROCCO_PRIORITY_QUERIES = [
  "site:medias24.com manifestation OR grève OR protestation",
  "site:medias24.com port OR douane OR transport OR logistique",
  "site:medias24.com blocage OR sit-in OR fermeture",
  "Maroc manifestation OR grève OR sit-in mai 2026",
  "Maroc Casablanca Rabat Tanger manifestation transport port",
  "Morocco protest strike port logistics disruption",
  "site:lematin.ma manifestation OR grève OR transport",
  "site:economiste.com manifestation OR grève OR douane",
];

// Sources we hit DIRECTLY (homepage scrape + map) rather than relying only on
// Firecrawl /search. These are critical Morocco sources for a freight forwarder.
const MOROCCO_DIRECT_SOURCES: Array<{ name: string; homepage: string; mapKeywords?: string[] }> = [
  { name: "Médias24", homepage: "https://medias24.com", mapKeywords: ["manifestation", "grève", "port", "douane", "transport"] },
  { name: "L'Economiste", homepage: "https://www.leconomiste.com", mapKeywords: ["douane", "port", "transport", "logistique"] },
  { name: "Le Matin", homepage: "https://lematin.ma", mapKeywords: ["manifestation", "port", "douane", "transport"] },
  { name: "PortNet Morocco", homepage: "https://www.portnet.ma", mapKeywords: ["actualité", "circulaire"] },
  { name: "Tanger Med", homepage: "https://www.tangermed.ma", mapKeywords: ["news", "port"] },
  { name: "ADII Morocco (Customs)", homepage: "https://www.douane.gov.ma", mapKeywords: ["circulaire", "tarif"] },
  { name: "SGG (Bulletin Officiel)", homepage: "https://www.sgg.gov.ma", mapKeywords: ["bulletin", "loi", "décret"] },
];

const MOROCCO_SOURCE_NAMES = new Set([
  "Médias24", "L'Economiste", "Le Matin", "PortNet Morocco", "Tanger Med",
  "Tanger Med Port Authority", "ADII Morocco (Customs)", "ADiL (Customs Clearance)",
  "SGG (Bulletin Officiel)", "Bank Al-Maghrib", "DGI Maroc (Impôts)",
  "La Vie Éco", "Finances News Hebdo",
]);

function normalizeSearchItems(result: any): any[] {
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.results)) return result.results;
  if (Array.isArray(result?.web)) return result.web;
  if (Array.isArray(result?.data?.data)) return result.data.data;
  if (Array.isArray(result?.data?.web)) return result.data.web;
  return [];
}

// Filter article-like URLs out of a /map links list: drop homepages, tag
// pages, category indexes, and known non-article paths.
function looksLikeArticleUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (!path || path === "/" || path.length < 8) return false;
    if (/\/(tag|category|categorie|auteur|author|page|search|recherche)\//i.test(path)) return false;
    if (/\.(jpg|jpeg|png|gif|pdf|mp4|css|js|xml)$/i.test(path)) return false;
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) return false;
    return true;
  } catch {
    return false;
  }
}

// Direct Firecrawl /map call for a domain, optionally filtered by keyword.
async function firecrawlMapDomain(
  apiKey: string,
  homepage: string,
  search?: string,
): Promise<string[]> {
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: homepage, search, limit: 30, includeSubdomains: false }),
    });
    if (!resp.ok) {
      console.error(`Firecrawl /map failed for ${homepage} (${search ?? "no kw"}):`, resp.status, await resp.text());
      return [];
    }
    const data = await resp.json();
    const links: string[] =
      (Array.isArray(data?.links) && data.links) ||
      (Array.isArray(data?.data?.links) && data.data.links) ||
      (Array.isArray(data?.data) && data.data) ||
      [];
    return links.filter(looksLikeArticleUrl);
  } catch (e) {
    console.error(`/map exception for ${homepage}:`, e);
    return [];
  }
}

// Direct Firecrawl /scrape call returning a normalized article shape.
async function firecrawlScrapeUrl(
  apiKey: string,
  url: string,
): Promise<{ title: string; url: string; description: string; markdown: string } | null> {
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!resp.ok) {
      console.error(`Firecrawl /scrape failed for ${url}:`, resp.status);
      return null;
    }
    const data = await resp.json();
    const markdown: string = data?.markdown || data?.data?.markdown || "";
    const metadata = data?.metadata || data?.data?.metadata || {};
    const title: string = metadata.title || markdown.split("\n").find((l: string) => l.startsWith("# "))?.replace(/^#\s*/, "") || "";
    const description: string = metadata.description || markdown.substring(0, 240).replace(/\n/g, " ");
    if (!title) return null;
    return { title, url, description, markdown: markdown.substring(0, 1500) };
  } catch (e) {
    console.error(`/scrape exception for ${url}:`, e);
    return null;
  }
}

async function touchLatestRefresh(supabase: any, checkedAt: string) {
  const { data: latest } = await supabase
    .from("news_entries")
    .select("id")
    .order("fetched_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest?.id) return null;

  const { data, error } = await supabase
    .from("news_entries")
    .update({ fetched_date: checkedAt })
    .eq("id", latest.id)
    .select("fetched_date")
    .maybeSingle();

  if (error) {
    console.error("Failed to refresh fetched_date metadata:", error);
    return null;
  }

  return data?.fetched_date ?? checkedAt;
}

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

    // Accept enabled sources from the request body
    let enabledSources: string[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body.sources) && body.sources.length > 0) {
        enabledSources = body.sources;
      }
    } catch { /* empty body is fine */ }

    // Build search queries based on enabled sources
    const searchQueries: string[] = [];
    let runMoroccoPriority = false;
    if (enabledSources) {
      for (const source of enabledSources) {
        if (SOURCE_QUERIES[source]) {
          searchQueries.push(...SOURCE_QUERIES[source]);
        }
        if (MOROCCO_SOURCE_NAMES.has(source)) runMoroccoPriority = true;
      }
      // Always include general queries
      searchQueries.push(...GENERAL_QUERIES);
      console.log(`Using ${searchQueries.length} queries for ${enabledSources.length} enabled sources`);
    } else {
      // No filter — use all queries
      for (const queries of Object.values(SOURCE_QUERIES)) {
        searchQueries.push(...queries);
      }
      searchQueries.push(...GENERAL_QUERIES);
      runMoroccoPriority = true;
      console.log(`Using all ${searchQueries.length} queries (no source filter)`);
    }

    if (runMoroccoPriority) {
      searchQueries.push(...MOROCCO_PRIORITY_QUERIES);
      console.log(`Added ${MOROCCO_PRIORITY_QUERIES.length} Morocco priority queries`);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const checkedAt = new Date().toISOString();
    const today = checkedAt.split("T")[0];

    // Step 1: Scrape real news using Firecrawl Search API
    console.log("Scraping real news from web sources...");

    const allArticles: Array<{
      title: string;
      url: string;
      description: string;
      source: string;
      markdown?: string;
    }> = [];

    const searchPromises = searchQueries.map(async (query) => {
      try {
        const response = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 7,
            tbs: "qdr:w",
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Firecrawl search error for "${query.substring(0, 50)}...":`, response.status, errText);
          return [];
        }

        const result = await response.json();
        const items = normalizeSearchItems(result);
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

    // ===== Direct Morocco-source scraping (homepage map + scrape top N) =====
    // This catches time-sensitive items (manifestations, blocages) that
    // /search misses. Runs whenever a Morocco source is in scope.
    if (runMoroccoPriority) {
      console.log(`Running direct scrape for ${MOROCCO_DIRECT_SOURCES.length} Morocco priority sources...`);
      const directScrapeStats: Record<string, { mapped: number; scraped: number }> = {};

      for (const src of MOROCCO_DIRECT_SOURCES) {
        directScrapeStats[src.name] = { mapped: 0, scraped: 0 };
        try {
          // Run /map for each keyword in parallel; keywords like "manifestation"
          // surface civic-event articles that pure logistics queries miss.
          const keywords = src.mapKeywords && src.mapKeywords.length > 0 ? src.mapKeywords : [undefined as unknown as string];
          const mapResults = await Promise.all(
            keywords.map((kw) => firecrawlMapDomain(FIRECRAWL_API_KEY, src.homepage, kw)),
          );
          const candidateUrls = Array.from(new Set(mapResults.flat())).slice(0, 10);
          directScrapeStats[src.name].mapped = candidateUrls.length;

          // Scrape top 5 per source (raised budget per acceptance criteria #3).
          const toScrape = candidateUrls.slice(0, 5);
          const scraped = await Promise.all(
            toScrape.map((u) => firecrawlScrapeUrl(FIRECRAWL_API_KEY, u)),
          );
          for (const art of scraped) {
            if (!art) continue;
            allArticles.push({
              title: art.title,
              url: art.url,
              description: art.description,
              source: src.name,
              markdown: art.markdown,
            });
            directScrapeStats[src.name].scraped += 1;
          }
        } catch (e) {
          console.error(`Direct scrape failed for ${src.name}:`, e);
        }
      }

      for (const [name, s] of Object.entries(directScrapeStats)) {
        console.log(`[direct-scrape] ${name}: mapped=${s.mapped}, scraped=${s.scraped}`);
      }
    }

    // Filter out generic/non-article URLs
    const isValidArticleUrl = (url: string): boolean => {
      try {
        const u = new URL(url);
        const path = u.pathname;
        if (path === "/" || path === "/en/" || path === "/news/" || path === "/en/news/") return false;
        if (path.endsWith("view_more_news.php") || path.endsWith("index.php")) return false;
        if (u.hostname.includes("facebook.com") || u.hostname.includes("twitter.com") || u.hostname.includes("linkedin.com")) return false;
        if (path.split("/").filter(Boolean).length < 2) return false;
        return true;
      } catch {
        return false;
      }
    };

    // Deduplicate by URL
    const uniqueArticles = Array.from(
      new Map(
        allArticles
          .filter(a => a.url && a.title && isValidArticleUrl(a.url))
          .map(a => [a.url, a])
      ).values()
    );

    // Step 1b: Validate URLs
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
          await resp2.text();
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

    const articlesToProcess = validatedArticles;

    console.log(`Found ${articlesToProcess.length} validated articles from web scraping`);

    if (articlesToProcess.length === 0) {
      const updatedAt = await touchLatestRefresh(supabase, checkedAt);
      return new Response(
        JSON.stringify({
          success: true,
          status: "checked_no_new",
          count: 0,
          checked_at: checkedAt,
          updated_at: updatedAt,
          message: "Refresh successful: 0 new entries",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Use AI to categorize and filter
    console.log("Using AI to categorize and filter articles...");

    const articleSummaries = articlesToProcess.slice(0, 30).map((a, i) =>
      `[${i}] TITLE: ${a.title}\nURL: ${a.url}\nSOURCE: ${a.source}\nDESCRIPTION: ${a.description}\nCONTENT PREVIEW: ${a.markdown?.substring(0, 200) || "N/A"}`
    ).join("\n\n---\n\n");

    const classifyPrompt = `You are a freight forwarding intelligence analyst specializing in Morocco and global logistics.

I have scraped the following real news articles from the web. Your job is to:
1. FILTER: Only keep articles relevant to freight forwarding, shipping, logistics, trade, customs, port operations, dangerous goods, compliance, or supply chain for a company operating from Morocco.
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

**1B PRIORITY — MOROCCAN CIVIC DISRUPTIONS (manifestations, grèves, blocages):**
Any article reporting a manifestation, protestation, grève, sit-in, blocage, fermeture de route, port closure, road closure, or general strike in Morocco — regardless of category. These directly disrupt freight flows (port access, customs offices, trucking).
These MUST be flagged as "critical" with action_required=true and region="morocco".
The suggested_action should describe operational mitigation (e.g. reroute trucks, anticipate customs delay, contact clients about delivery windows).
Set category="port" if it affects port/road access, "compliance" if it affects customs operations, otherwise "general".
Look for these French/Arabic-derived keywords in title or content: manifestation, manif, grève, greve, sit-in, blocage, protestation, protest, fermeture, occupation, mobilisation. Also recognize specific Moroccan locations (Casablanca, Rabat, Tanger, Agadir, Tanger Med, Casa Port).

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
      console.warn("Initial JSON parse failed, attempting to salvage truncated response...");
      try {
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
      const updatedAt = await touchLatestRefresh(supabase, checkedAt);
      return new Response(
        JSON.stringify({
          success: true,
          status: "checked_no_new",
          count: 0,
          checked_at: checkedAt,
          updated_at: updatedAt,
          message: "Refresh successful: 0 new entries",
        }),
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

    // Deduplicate against existing DB entries
    const existingUrls = new Set<string>();

    // Only dedupe on exact source_url, and only against the last 14 days,
    // so genuinely new items with similar headlines still get inserted.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("news_entries")
      .select("source_url")
      .gte("published_date", fourteenDaysAgo)
      .order("published_date", { ascending: false })
      .limit(2000);

    if (existing) {
      for (const e of existing) {
        if (e.source_url) existingUrls.add(e.source_url);
      }
    }

    const newRows = rows.filter((r: any) => {
      if (r.source_url && existingUrls.has(r.source_url)) return false;
      return true;
    });

    if (newRows.length === 0) {
      console.log("All articles already exist in database, skipping insert");
      const updatedAt = await touchLatestRefresh(supabase, checkedAt);
      return new Response(
        JSON.stringify({
          success: true,
          status: "checked_no_new",
          count: 0,
          checked_at: checkedAt,
          updated_at: updatedAt,
          message: "Refresh successful: 0 new entries",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase.from("news_entries").insert(newRows).select();

    if (error) {
      console.error("DB insert error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Per-source counts: how many we scraped vs how many ended up inserted.
    // This makes it obvious in logs whether Médias24 (etc.) actually
    // returned anything on a given run.
    const scrapedBySource: Record<string, number> = {};
    for (const a of articlesToProcess) {
      const s = a.source || "Unknown";
      scrapedBySource[s] = (scrapedBySource[s] || 0) + 1;
    }
    const insertedBySource: Record<string, number> = {};
    for (const r of newRows) {
      const s = r.source_name || "Unknown";
      insertedBySource[s] = (insertedBySource[s] || 0) + 1;
    }
    const allSources = new Set([...Object.keys(scrapedBySource), ...Object.keys(insertedBySource)]);
    for (const s of allSources) {
      console.log(`[per-source] ${s}: ${scrapedBySource[s] || 0} scraped, ${insertedBySource[s] || 0} inserted`);
    }

    // Cleanup old entries (>90 days)
    await supabase.rpc("cleanup_old_entries");

    console.log(`Successfully inserted ${data.length} REAL news entries from web scraping`);

    // Step 4: Trigger AI classification for Finance/IT section relevance
    const newIds = data.map((d: any) => d.id);
    if (newIds.length > 0) {
      try {
        console.log(`Triggering classify-sections for ${newIds.length} new articles...`);
        const classifyResp = await fetch(
          `${SUPABASE_URL}/functions/v1/classify-sections`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ article_ids: newIds }),
          }
        );
        if (classifyResp.ok) {
          const classifyResult = await classifyResp.json();
          console.log(`Classification complete: ${classifyResult.classified} articles scored`);
        } else {
          console.error("classify-sections call failed:", classifyResp.status, await classifyResp.text());
        }
      } catch (classifyErr) {
        console.error("Failed to trigger classify-sections:", classifyErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "success",
        count: data.length,
        checked_at: checkedAt,
        updated_at: data[0]?.fetched_date ?? checkedAt,
        message: data.length > 0 ? "Refresh successful" : "Refresh successful: 0 new entries",
        sources: [...new Set(rows.map((r: any) => r.source_name))],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-news error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        status: "failed",
        error: e instanceof Error ? e.message : "Unknown error",
        message: "Refresh failed",
      }),
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
      "tax.gov.ma": "DGI Maroc (Impôts)",
      "bkam.ma": "Bank Al-Maghrib",
      "sgg.gov.ma": "SGG (Bulletin Officiel)",
      "bleepingcomputer.com": "BleepingComputer",
      "cisa.gov": "CISA",
      "theregister.com": "The Register",
      "techtarget.com": "TechTarget",
      "msrc.microsoft.com": "Microsoft Security",
      "microsoft.com": "Microsoft Security",
      "cloud.google.com": "Google Cloud",
      "aws.amazon.com": "AWS Security",
      "arstechnica.com": "Ars Technica",
      "openai.com": "OpenAI",
      "anthropic.com": "Anthropic",
      "technologyreview.com": "MIT Technology Review",
      "venturebeat.com": "VentureBeat",
      "huggingface.co": "Hugging Face Blog",
      "computerweekly.com": "Computer Weekly",
      "itsecurityguru.org": "IT Security Guru",
      "sdtimes.com": "SD Times",
      "technews.acm.org": "ACM TechNews",
      "cacm.acm.org": "ACM TechNews",
      "voiceoftheindependent.com": "Voice of the Independent",
    };
    return sourceMap[hostname] || hostname;
  } catch {
    return "Unknown Source";
  }
}
