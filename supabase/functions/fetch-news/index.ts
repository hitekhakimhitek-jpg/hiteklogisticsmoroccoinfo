import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireHitekAdmin } from "../_shared/auth.ts";
import { recordSourceRun } from "../_shared/health.ts";
import { NEWS_SOURCE_META, syncSourceRegistry } from "../_shared/registry.ts";
import { assessIntelligenceQuality } from "../_shared/intel-quality.ts";

const CATEGORIES = ["regulation", "weather", "port", "trade", "compliance", "market", "general"];
const REGIONS = [
  "morocco",
  "europe",
  "asia",
  "africa",
  "middle_east",
  "north_america",
  "south_america",
  "americas",
  "oceania",
  "global",
];
const CONTENT_TYPES = [
  "regulatory_change",
  "customs_update",
  "compliance",
  "sanctions_trade_restriction",
  "port_disruption",
  "strike_protest_manifestation",
  "freight_market_update",
  "finance_regulation",
  "technology_it_news",
  "infrastructure",
  "carrier_air_sea_road",
  "general_news",
];
const PRIORITIES = ["critical", "important", "informational"];
const CURRENT_YEAR = new Date().getUTCFullYear();
const CURRENT_YEAR_START = new Date(Date.UTC(CURRENT_YEAR, 0, 1)).getTime();
const ROLLING_NEWS_CUTOFF = Date.now() - 14 * 24 * 60 * 60 * 1000;

const BAD_ARTICLE_PATH = /\/(tag|tags|sujet|category|categories|categorie|topic|topics|author|authors|section|sections|page|search|recherche)(\/|$)/i;

// Social networks, dictionaries, ticketing and encyclopedias polluted the
// candidate pool and burned the audit budget every run.
const JUNK_DOMAINS = /(^|\.)(tiktok|instagram|facebook|x|twitter|pinterest|youtube|reddit|linkedin|merriam-webster|wikipedia|ticketmaster|tripadvisor|amazon)\.[a-z.]+$/i;

// Sites that reliably answer bot requests with 403/429 but are vetted sources.
const BOT_BLOCKED_TRUSTED = /(^|\.)(medias24\.com|leconomiste\.com|lematin\.ma|hespress\.com|lopinion\.ma|venturebeat\.com|joc\.com|lloydslist\.com)$/i;

// ---------------------------------------------------------------------------
// Firecrawl rate limiter.
// The previous implementation fired every query + /map + /scrape in parallel,
// which blew past Firecrawl's per-minute quota: 65 of 75 queries came back 429
// and effectively only ~6 sources were ever consulted. All Firecrawl traffic
// now goes through a token bucket (max REQS_PER_WINDOW per 60s, bounded
// concurrency) with a single 429 retry that honours the reset hint.
// ---------------------------------------------------------------------------
const REQS_PER_WINDOW = 10;
const WINDOW_MS = 60_000;
const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;
// The edge worker is terminated after ~3.5 minutes. Scraping passes must stop
// well before that so the articles already gathered still get processed,
// inserted and reported instead of dying mid-run.
const RUN_BUDGET_MS = 145_000;
let runDeadline = Number.MAX_SAFE_INTEGER;
export class BudgetExceeded extends Error {}
function budgetLeftMs(): number {
  return runDeadline - Date.now();
}
let windowStart = Date.now();
let windowCount = 0;
let inFlight = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquireSlot(): Promise<void> {
  while (true) {
    if (budgetLeftMs() <= 0) throw new BudgetExceeded("run budget exhausted");
    const now = Date.now();
    if (now - windowStart >= WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount < REQS_PER_WINDOW && inFlight < MAX_CONCURRENCY) {
      windowCount++;
      inFlight++;
      return;
    }
    await sleep(inFlight >= MAX_CONCURRENCY ? 200 : Math.max(250, WINDOW_MS - (now - windowStart)));
  }
}

async function firecrawlFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await acquireSlot();
    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, init, timeoutMs);
    } finally {
      inFlight--;
    }
    if (resp.status !== 429 || attempt === MAX_RETRIES - 1) return resp;
    const body = await resp.text();
    const retryAfter = Number(resp.headers.get("retry-after")) ||
      Number(body.match(/retry after (\d+)s/i)?.[1]) || 15;
    const waitMs = Math.min(retryAfter + attempt * 5, 35) * 1000;
    if (waitMs > budgetLeftMs()) throw new BudgetExceeded("no time left to retry");
    console.warn(`[firecrawl-429] attempt ${attempt + 1}, waiting ${waitMs / 1000}s`);
    windowStart = Date.now();
    windowCount = 0;
    await sleep(waitMs);
  }
  throw new Error("unreachable");
}

/** Drop URLs we have already ingested so Firecrawl credits and rate budget are
 *  only spent on genuinely new articles. */
async function filterUnseenUrls(supabase: any, urls: string[]): Promise<string[]> {
  if (urls.length === 0) return urls;
  try {
    const { data } = await supabase
      .from("news_entries")
      .select("source_url")
      .in("source_url", urls);
    const seen = new Set((data || []).map((r: any) => r.source_url));
    return urls.filter((u) => !seen.has(u));
  } catch {
    return urls;
  }
}
const PAYWALL_RE = /\b(only available to subscribers|subscriber(?:s)? only|thirty-day free trial|30-day free trial|subscribe to read|subscription required|premium content|sign in to continue|login to continue|become a subscriber|already a subscriber)\b/i;
const GENERIC_TITLE_WORDS = new Set([
  "from", "with", "that", "this", "will", "amid", "after", "says", "news", "more", "over", "into", "near",
  "rate", "rates", "shipping", "freight", "cargo", "logistics", "supply", "chain", "market", "markets", "global",
  "container", "containers", "update", "updates", "security", "critical", "report", "reports", "trade", "transport",
]);

function isCurrentPublicationDate(date: string | null | undefined): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (t < CURRENT_YEAR_START) return false;
  return t >= ROLLING_NEWS_CUTOFF;
}

function extractDateFromUrl(url: string): string | null {
  const match = url.match(/\/(20\d{2})[\/-](0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])(?:\/|$)/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return isCurrentPublicationDate(iso) ? iso : null;
}

function tokenize(v: string | null | undefined): string[] {
  return String(v || "")
    .toLowerCase()
    .replace(/https?:\/\/[^/]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !GENERIC_TITLE_WORDS.has(w));
}

function contentLooksReadable(markdown?: string, description?: string, title?: string): boolean {
  const text = `${title || ""}\n${description || ""}\n${markdown || ""}`.trim();
  if (text.length < 180) return false;
  if (PAYWALL_RE.test(text)) return false;
  return true;
}

function titleMatchesUrlOrContent(article: { title: string; url: string; description?: string; markdown?: string }): boolean {
  const titleWords = tokenize(article.title);
  if (titleWords.length === 0) return false;
  const haystackWords = new Set(tokenize(`${article.url} ${article.description || ""} ${(article.markdown || "").slice(0, 600)}`));
  const overlap = titleWords.filter((w) => haystackWords.has(w)).length;
  return overlap >= Math.min(2, titleWords.length);
}

// Tier-1 freight publishers that frequently ship articles without any machine
// readable publication date (JOC in particular). Dropping them for a missing
// date silently removed the single most valuable worldwide source from the
// dashboard, so for these hosts we accept the article and date it to the day
// it was discovered — searches are already time-boxed to the last week and
// `verify-dates` refines the date afterwards.
const TRUSTED_UNDATED_HOSTS =
  /(^|\.)(joc\.com|theloadstar\.com|lloydslist\.com|maritime-executive\.com|gcaptain\.com|splash247\.com)$/i;
function isTrustedUndatedHost(url: string): boolean {
  try { return TRUSTED_UNDATED_HOSTS.test(new URL(url).hostname.replace(/^www\.(prod\.int\.)?/, "").replace(/^prod\.int\./, "")); }
  catch { return false; }
}

function classifyArticleRejection(article: { title: string; url: string; description: string; markdown?: string; publishedDate?: string | null }): string | null {
  if (!looksLikeArticleUrl(article.url)) return "non_article_url";
  if (!isCurrentPublicationDate(article.publishedDate)) {
    if (!article.publishedDate && isTrustedUndatedHost(article.url)) {
      article.publishedDate = new Date().toISOString().split("T")[0];
    } else {
      return "outdated_or_missing_date";
    }
  }
  if (!contentLooksReadable(article.markdown, article.description, article.title)) return "paywalled_or_unreadable";
  if (!titleMatchesUrlOrContent(article)) return "title_url_mismatch";
  return null;
}

// Try to extract an ISO publication date from Firecrawl metadata or article markdown.
// Returns YYYY-MM-DD or null. NEVER fall back to "today" — the dashboard requires
// the real source date.
function extractPublicationDate(metadata: any, markdown?: string): string | null {
  const candidates: any[] = [
    metadata?.publishedDate,
    metadata?.datePublished,
    metadata?.published_time,
    metadata?.["article:published_time"],
    metadata?.["og:article:published_time"],
    metadata?.["og:published_time"],
    metadata?.pubdate,
    metadata?.date,
    metadata?.["article:modified_time"],
    metadata?.modifiedTime,
    metadata?.dateModified,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    const d = new Date(c);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + 86400000) {
      const iso = d.toISOString().split("T")[0];
      return isCurrentPublicationDate(iso) ? iso : null;
    }
  }
  // Look for a JSON-LD-style date in the first 2KB of markdown
  if (typeof markdown === "string" && markdown.length > 0) {
    const head = markdown.substring(0, 4000);
    const FR_MONTHS: Record<string, number> = {
      janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
      juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
    };
    const frMatch = head.match(
      /\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d{2})\b/i,
    );
    if (frMatch) {
      const mm = FR_MONTHS[frMatch[2].toLowerCase()];
      const iso = `${frMatch[3]}-${String(mm).padStart(2, "0")}-${frMatch[1].padStart(2, "0")}`;
      if (isCurrentPublicationDate(iso)) return iso;
    }
    const dmy = head.match(/\b(0?[1-9]|[12]\d|3[01])[\/.](0?[1-9]|1[0-2])[\/.](20\d{2})\b/);
    if (dmy) {
      const iso = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
      if (isCurrentPublicationDate(iso)) return iso;
    }
    const m = head.match(
      /\b(20\d{2}-\d{2}-\d{2})\b|\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/i,
    );
    if (m) {
      const d = new Date(m[0]);
      if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + 86400000) {
        const iso = d.toISOString().split("T")[0];
        return isCurrentPublicationDate(iso) ? iso : null;
      }
    }
  }
  return null;
}

// Map source names → search queries. Only queries whose source name is in the enabled list will run.
const SOURCE_QUERIES: Record<string, string[]> = {
  // TIER 1 — Freight & logistics
  "FreightWaves": ["freight forwarding shipping logistics news today site:freightwaves.com"],
  // PRIMARY SOURCES — broad coverage, deep queries
  "The Loadstar": [
    "ocean freight rates carriers shipping site:theloadstar.com",
    "air cargo freight forwarder logistics site:theloadstar.com",
    "supply chain disruption port congestion site:theloadstar.com",
    "Maersk MSC CMA CGM Hapag-Lloyd ONE site:theloadstar.com",
  ],
  "JOC": [
    "ocean container shipping freight rates site:joc.com",
    "port terminal congestion labor strike site:joc.com",
    "trans-Pacific Asia Europe trade lane site:joc.com",
    "customs trucking intermodal logistics site:joc.com",
  ],
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
  "Hespress": [
    "Maroc économie commerce port douane transport site:hespress.com",
    "Morocco economy trade port customs site:en.hespress.com",
    "Maroc économie commerce site:fr.hespress.com",
  ],
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
  // TIER 1b — Carrier & forwarder operational advisories (highest operational value)
  "SEKO Logistics": [
    "port update terminal congestion advisory site:sekologistics.com",
    "Asia supply chain weather center update site:sekologistics.com",
  ],
  "Kuehne+Nagel": ["customer advisory port terminal trucking warehouse disruption site:kuehne-nagel.com"],
  "Hillebrand Gori": ["port update congestion trade lane disruption site:hillebrandgori.com"],
  "Maersk": ["customer advisory port omission terminal closure schedule change site:maersk.com"],
  "MSC": ["customer advisory port congestion terminal closure site:msc.com"],
  "CMA CGM": ["customer advisory port terminal closure surcharge rerouting site:cma-cgm.com"],
  "Hapag-Lloyd": ["customer advisory port terminal closure schedule change site:hapag-lloyd.com"],
  // TIER 1c — Global maritime & logistics press
  "The Maritime Executive": ["port operations maritime emergency storm closure site:maritime-executive.com"],
  "ICIS": ["logistics shipping port disruption china petrochemical site:icis.com"],
  "Supply Chain Brain": ["supply chain risk logistics disruption site:supplychainbrain.com"],
  "Logistics Management": ["logistics delays freight transportation disruption site:logisticsmgmt.com"],
  "Baird Maritime": ["shipping vessel operations maritime news site:bairdmaritime.com"],
  "MarineLink": ["shipping port vessel maritime news site:marinelink.com"],
  // TIER 1d — Supply chain risk & visibility platforms
  "project44": ["port congestion vessel dwell time insights site:project44.com"],
  "Everstream Analytics": ["supply chain risk alert weather strike disruption site:everstream.ai"],
  "Resilinc": ["supply chain disruption event watch alert site:resilinc.com"],
};

// Fallback general queries that always run if no source-specific ones cover the topic
const GENERAL_QUERIES = [
  "Morocco trade port Tanger Med customs ADII shipping PortNet",
  "port disruption weather shipping delay Suez Canal Mediterranean Gibraltar",
  "freight forwarding OR shipping disruption OR port congestion OR customs regulation OR supply chain OR tariff update OR Suez Canal OR Mediterranean shipping",
  "Red Sea Suez Canal transits vessel attack Houthi shipping impact",
  "typhoon OR strike OR port closure disrupting global supply chain this week",
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
  "site:hespress.com manifestation OR grève OR port OR douane OR transport",
  "site:fr.hespress.com économie OR port OR douane OR transport",
];

// Sources we hit DIRECTLY (homepage scrape + map) rather than relying only on
// Firecrawl /search. These are critical Morocco sources for a freight forwarder.
const MOROCCO_DIRECT_SOURCES: Array<{ name: string; homepage: string; mapKeywords?: string[] }> = [
  { name: "Médias24", homepage: "https://medias24.com", mapKeywords: ["manifestation", "grève", "port", "douane", "transport"] },
  { name: "L'Economiste", homepage: "https://www.leconomiste.com", mapKeywords: ["douane", "port", "transport", "logistique"] },
  { name: "Le Matin", homepage: "https://lematin.ma", mapKeywords: ["manifestation", "port", "douane", "transport"] },
  { name: "Hespress", homepage: "https://fr.hespress.com", mapKeywords: ["économie", "port", "douane", "transport", "manifestation"] },
  { name: "PortNet Morocco", homepage: "https://www.portnet.ma", mapKeywords: ["actualité", "circulaire"] },
  { name: "Tanger Med", homepage: "https://www.tangermed.ma", mapKeywords: ["news", "port"] },
  { name: "ADII Morocco (Customs)", homepage: "https://www.douane.gov.ma", mapKeywords: ["circulaire", "tarif"] },
  { name: "SGG (Bulletin Officiel)", homepage: "https://www.sgg.gov.ma", mapKeywords: ["bulletin", "loi", "décret"] },
];

const MOROCCO_SOURCE_NAMES = new Set([
  "Médias24", "L'Economiste", "Le Matin", "Hespress", "PortNet Morocco", "Tanger Med",
  "Tanger Med Port Authority", "ADII Morocco (Customs)", "ADiL (Customs Clearance)",
  "SGG (Bulletin Officiel)", "Bank Al-Maghrib", "DGI Maroc (Impôts)",
  "La Vie Éco", "Finances News Hebdo",
]);

// Primary global freight sources — scraped DIRECTLY on every run (not gated
// on a region) because they carry the most important global freight
// forwarding signal.
const PRIMARY_DIRECT_SOURCES: Array<{ name: string; homepage: string; mapKeywords?: string[] }> = [
  {
    name: "The Loadstar",
    homepage: "https://theloadstar.com",
    mapKeywords: ["ocean", "air", "freight", "supply-chain", "carrier", "port"],
  },
  {
    name: "JOC",
    homepage: "https://www.joc.com",
    mapKeywords: ["container", "port", "red-sea", "suez", "trucking", "rail"],
  },
];

// Carrier / forwarder advisory hubs and risk platforms. Their advisory pages
// are poorly covered by search engines, so we map + scrape them directly.
// They rotate across runs to stay inside the Firecrawl budget.
const ADVISORY_DIRECT_SOURCES: Array<{ name: string; homepage: string; mapKeywords?: string[] }> = [
  { name: "Maersk", homepage: "https://www.maersk.com", mapKeywords: ["advisory", "news"] },
  { name: "MSC", homepage: "https://www.msc.com", mapKeywords: ["advisory", "news"] },
  { name: "CMA CGM", homepage: "https://www.cma-cgm.com", mapKeywords: ["advisory", "news"] },
  { name: "Hapag-Lloyd", homepage: "https://www.hapag-lloyd.com", mapKeywords: ["advisory", "news"] },
  { name: "SEKO Logistics", homepage: "https://www.sekologistics.com", mapKeywords: ["port-update", "advisory", "news"] },
  { name: "Kuehne+Nagel", homepage: "https://newsroom.kuehne-nagel.com", mapKeywords: ["advisory", "news"] },
  { name: "Hillebrand Gori", homepage: "https://www.hillebrandgori.com", mapKeywords: ["port-update", "insights"] },
  { name: "Everstream Analytics", homepage: "https://www.everstream.ai", mapKeywords: ["risk-center", "insights"] },
  { name: "Resilinc", homepage: "https://www.resilinc.com", mapKeywords: ["blog", "eventwatch"] },
  { name: "project44", homepage: "https://www.project44.com", mapKeywords: ["blog", "insights"] },
];

// Fetch with timeout — prevents one hung source from blocking the whole run.
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

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
    if (BAD_ARTICLE_PATH.test(path) || /\/(auteur)\//i.test(path)) return false;
    if (/\.(jpg|jpeg|png|gif|pdf|mp4|css|js|xml)$/i.test(path)) return false;
    if (JUNK_DOMAINS.test(u.hostname)) return false;
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return false;
    // Many publishers (The Loadstar, JOC, Hespress...) serve articles at a
    // single flat slug: /kenya-the-latest-to-unveil-tighter-rules/. Requiring
    // two path segments was silently rejecting most tier-1 freight articles.
    if (segments.length === 1) {
      const slug = segments[0];
      return slug.length >= 20 && (slug.match(/-/g)?.length ?? 0) >= 2;
    }
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
    const resp = await firecrawlFetch("https://api.firecrawl.dev/v2/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: homepage, search, limit: 30, includeSubdomains: false }),
    }, 20000);
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
// Fallback discovery: some publishers (notably joc.com) return nothing from
// Firecrawl /map because of their bot rules. Scraping the landing page for its
// links still surfaces the current headlines, so a source is never silently
// skipped just because /map came back empty.
async function firecrawlHarvestLinks(apiKey: string, homepage: string): Promise<string[]> {
  try {
    const resp = await firecrawlFetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: homepage, formats: ["links"], onlyMainContent: false }),
    }, 25000);
    if (!resp.ok) return [];
    const data = await resp.json();
    const links: string[] = data?.links || data?.data?.links || [];
    const host = new URL(homepage).hostname.replace(/^www\./, "");
    return Array.from(new Set(links))
      .filter((l) => {
        try {
          return new URL(l).hostname.replace(/^www\./, "").endsWith(host) && looksLikeArticleUrl(l);
        } catch { return false; }
      });
  } catch {
    return [];
  }
}

async function firecrawlScrapeUrl(
  apiKey: string,
  url: string,
): Promise<{ title: string; url: string; description: string; markdown: string } | null> {
  try {
    const resp = await firecrawlFetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    }, 25000);
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
    const sourceURL = metadata.sourceURL || url;
    const publishedDate = extractPublicationDate(metadata, markdown) || extractDateFromUrl(sourceURL);
    const article = { title, url: sourceURL, description, markdown: markdown.substring(0, 1500), publishedDate } as any;
    if (classifyArticleRejection(article)) return null;
    return article;
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
  const authErr = await requireHitekAdmin(req);
  if (authErr) return authErr;

  let telemetryClient: any = null;
  let runId: string | null = null;
  let leaseToken: string | null = null;
  runDeadline = Date.now() + RUN_BUDGET_MS;
  const finishRun = async (patch: Record<string, unknown>) => {
    if (!telemetryClient || !runId) return;
    const { error } = await telemetryClient
      .from("ingestion_runs")
      .update({ finished_at: new Date().toISOString(), ...patch })
      .eq("id", runId);
    if (error) console.error("Failed to persist ingestion telemetry:", error.message);
  };

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
    let batch = 0;
    let batchCount = 8;
    let force = false;
    try {
      const body = await req.json();
      if (Array.isArray(body.sources) && body.sources.length > 0) {
        enabledSources = body.sources;
      }
      batch = Number.isInteger(body.batch) ? Math.max(0, Number(body.batch)) : 0;
      batchCount = Number.isInteger(body.batchCount) ? Math.min(12, Math.max(1, Number(body.batchCount))) : 8;
      force = body.force === true;
    } catch { /* empty body is fine */ }

    // Build search queries.
    // Firing all ~75 queries at once exceeded Firecrawl's per-minute quota, so
    // most sources never actually ran. Instead: core freight + Morocco sources
    // run on EVERY execution, and the remaining sources rotate on a daily
    // schedule so the full source list is covered over a few days without ever
    // tripping the rate limit.
    // Morocco sources are covered every run by the direct-scrape pass below,
    // so they stay out of the per-run search budget.
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const allRegisteredNames = NEWS_SOURCE_META
      .map((source) => source.name)
      .filter((name) => SOURCE_QUERIES[name]);
    const sourceList = enabledSources
      ? enabledSources.filter((source) => SOURCE_QUERIES[source])
      : allRegisteredNames.filter((_, index) => index % batchCount === batch % batchCount);
    const plannedSourceNames = new Set(sourceList);
    let runMoroccoPriority = false;
    for (const s of sourceList) {
      if (MOROCCO_SOURCE_NAMES.has(s)) runMoroccoPriority = true;
    }

    // Each invocation owns one deterministic cohort. Scheduled invocations run
    // all cohorts daily, avoiding a monolithic job that silently skips sources.
    const searchPlans: Array<{ source: string; query: string }> = [];
    for (const source of sourceList) {
      const query = SOURCE_QUERIES[source]?.[0];
      if (query) searchPlans.push({ source, query });
    }
    console.log(
      `[query-plan] batch=${batch}/${batchCount} force=${force} sources=${sourceList.length} (${sourceList.join(", ")}) queries=${searchPlans.length}`,
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    telemetryClient = supabase;
    const { data: acquiredLease, error: leaseError } = await supabase.rpc("acquire_pipeline_lease", {
      _pipeline: "fetch-news",
      _lease_seconds: 240,
    });
    if (leaseError) throw new Error(leaseError.message);
    if (!acquiredLease) {
      return new Response(JSON.stringify({ success: true, status: "already_running", message: "A refresh is already in progress" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    leaseToken = acquiredLease;
    await syncSourceRegistry(supabase, NEWS_SOURCE_META);
    const { data: run } = await supabase
      .from("ingestion_runs")
      .insert({ pipeline: "fetch-news", status: "running" })
      .select("id")
      .single();
    runId = run?.id ?? null;
    const checkedAt = new Date().toISOString();
    const today = checkedAt.split("T")[0];
    const sourceMeta = new Map(NEWS_SOURCE_META.map((source) => [source.name, source]));

    const recordNewsHealth = async (
      candidates: Array<{ source: string; publishedDate?: string | null }>,
      accepted: Array<{ source: string }>,
      inserted: Array<{ source_name?: string | null }>,
      fallbackError: string | null = null,
    ) => {
      for (const sourceName of plannedSourceNames) {
        const meta = sourceMeta.get(sourceName);
        const found = candidates.filter((article) => article.source === sourceName);
        const acceptedCount = accepted.filter((article) => article.source === sourceName).length;
        const newCount = inserted.filter((row) => row.source_name === sourceName).length;
        const latestPublicationAt = found
          .map((article) => article.publishedDate)
          .filter((date): date is string => Boolean(date))
          .sort()
          .at(-1) ?? null;
        await recordSourceRun(supabase, runId, {
          sourceName,
          sourceUrl: meta?.homepage,
          sourceType: meta?.source_type,
          fetchMethod: "firecrawl_search_direct",
          httpStatus: fallbackError ? 0 : 200,
          pagesRequested: 1,
          itemsDiscovered: found.length,
          itemsNew: newCount,
          itemsDuplicates: Math.max(0, acceptedCount - newCount),
          itemsRejected: Math.max(0, found.length - acceptedCount),
          latestPublicationAt,
          startedAt: Date.now(),
          error: fallbackError ?? (found.length === 0 ? "No parseable current articles found in this source cohort" : null),
        });
      }
    };

    // Step 1: Scrape real news using Firecrawl Search API
    console.log("Scraping real news from web sources...");

    const allArticles: Array<{
      title: string;
      url: string;
      description: string;
      source: string;
      markdown?: string;
      publishedDate?: string | null;
    }> = [];

    const queryStats = { ok: 0, failed: 0, empty: 0 };
    const searchPromises = searchPlans.map(async ({ source, query }) => {
      try {
        const response = await firecrawlFetch("https://api.firecrawl.dev/v2/search", {
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
        }, 30000);

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Firecrawl search error for "${query.substring(0, 50)}...":`, response.status, errText);
          queryStats.failed++;
          return [];
        }

        const result = await response.json();
        const items = normalizeSearchItems(result);
        if (items.length === 0) queryStats.empty++; else queryStats.ok++;
        return items.map((item: any) => ({
          title: item.title || item.metadata?.title || "",
          url: item.url || item.metadata?.sourceURL || "",
          description: item.description || item.excerpt || "",
          source,
          markdown: item.markdown?.substring(0, 1000) || "",
            publishedDate: extractPublicationDate(item.metadata || {}, item.markdown || "") || extractDateFromUrl(item.url || ""),
        }));
      } catch (e) {
        console.error(`Search failed for query: ${query.substring(0, 50)}...`, e);
        queryStats.failed++;
        return [];
      }
    });

    const settled = await Promise.allSettled(searchPromises);
    const results = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
    console.log(`[search-stats] ok=${queryStats.ok} empty=${queryStats.empty} failed=${queryStats.failed} of ${searchPlans.length}`);
    for (const batch of results) {
      allArticles.push(...batch);
    }

    // ===== Direct scraping for PRIMARY global sources (Loadstar, JOC) =====
    // These run on every execution — they carry the most important global
    // freight-forwarding signal, so we want every run to capture them.
    {
      const primarySources = PRIMARY_DIRECT_SOURCES.filter((source) => plannedSourceNames.has(source.name));
      console.log(`Running direct scrape for ${primarySources.length} primary global sources...`);
      const primaryStats: Record<string, { mapped: number; scraped: number }> = {};
      for (const src of primarySources) {
        if (budgetLeftMs() < 25_000) {
          console.log(`[budget] skipping remaining primary direct scrapes (${Math.round(budgetLeftMs() / 1000)}s left)`);
          break;
        }
        primaryStats[src.name] = { mapped: 0, scraped: 0 };
        try {
          const keywords = (src.mapKeywords && src.mapKeywords.length > 0 ? src.mapKeywords : [undefined as unknown as string]).slice(0, 2);
          const mapResults = await Promise.all(
            keywords.map((kw) => firecrawlMapDomain(FIRECRAWL_API_KEY, src.homepage, kw)),
          );
          // Keep enough candidates to avoid repeatedly exhausting the same homepage links.
          let candidateUrls = Array.from(new Set(mapResults.flat())).slice(0, 30);
          if (candidateUrls.length === 0) {
            candidateUrls = (await firecrawlHarvestLinks(FIRECRAWL_API_KEY, src.homepage)).slice(0, 30);
            console.log(`[primary-direct] ${src.name}: /map empty, harvested ${candidateUrls.length} links from page`);
          }
          primaryStats[src.name].mapped = candidateUrls.length;
          // One search + map/landing-page discovery + four article scrapes keeps
          // a primary source inside one provider window. Larger batches used to
          // stall until the worker was terminated, leaving the run unfinished.
          const toScrape = (await filterUnseenUrls(supabase, candidateUrls)).slice(0, 4);
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
              publishedDate: (art as any).publishedDate ?? null,
            });
            primaryStats[src.name].scraped += 1;
          }
        } catch (e) {
          console.error(`Primary direct scrape failed for ${src.name}:`, e);
        }
      }
      for (const [name, s] of Object.entries(primaryStats)) {
        console.log(`[primary-direct] ${name}: mapped=${s.mapped}, scraped=${s.scraped}`);
      }
    }

    // ===== Direct scraping for carrier advisories & risk platforms =====
    // ===== Direct scraping for user-added custom sources =====
    // Sources added by an admin in Settings are stored in `sources` with
    // source_type = 'custom'. They are treated exactly like the built-in
    // direct sources: map the homepage, then scrape the unseen articles.
    {
      const { data: customSources } = await supabase
        .from("sources")
        .select("name, homepage")
        .eq("source_type", "custom")
        .eq("enabled", true);
      const customInThisBatch = enabledSources
        ? (customSources ?? []).filter((source) => enabledSources?.includes(source.name))
        : batch % batchCount === 0 ? (customSources ?? []) : [];
      for (const src of customInThisBatch) {
        if (!src.homepage) continue;
        plannedSourceNames.add(src.name);
        if (budgetLeftMs() < 25_000) {
          console.log(`[budget] skipping remaining custom source scrapes (${Math.round(budgetLeftMs() / 1000)}s left)`);
          break;
        }
        try {
          const mapped = await firecrawlMapDomain(FIRECRAWL_API_KEY, src.homepage);
          const discovered = mapped.length > 0 ? mapped : await firecrawlHarvestLinks(FIRECRAWL_API_KEY, src.homepage);
          const candidateUrls = Array.from(new Set(discovered)).slice(0, 25);
          const toScrape = (await filterUnseenUrls(supabase, candidateUrls)).slice(0, 4);
          const scraped = await Promise.all(toScrape.map((u) => firecrawlScrapeUrl(FIRECRAWL_API_KEY, u)));
          let count = 0;
          for (const art of scraped) {
            if (!art) continue;
            allArticles.push({
              title: art.title,
              url: art.url,
              description: art.description,
              source: src.name,
              markdown: art.markdown,
              publishedDate: (art as any).publishedDate ?? null,
            });
            count += 1;
          }
          console.log(`[custom-direct] ${src.name}: mapped=${candidateUrls.length}, scraped=${count}`);
        } catch (e) {
          console.error(`Custom source scrape failed for ${src.name}:`, e);
        }
      }
    }

    // Advisory pages are poorly indexed by search engines, so we map their
    // hubs directly. Rotated per run to stay inside the Firecrawl budget.
    {
      const ADVISORY_PER_RUN = 3;
      const advisoryToday = Array.from(
        { length: Math.min(ADVISORY_PER_RUN, ADVISORY_DIRECT_SOURCES.length) },
        (_, i) => ADVISORY_DIRECT_SOURCES[(dayIndex * ADVISORY_PER_RUN + i) % ADVISORY_DIRECT_SOURCES.length],
      ).filter((src) => plannedSourceNames.has(src.name));
      for (const src of advisoryToday) {
        if (budgetLeftMs() < 25_000) {
          console.log(`[budget] skipping remaining advisory scrapes (${Math.round(budgetLeftMs() / 1000)}s left)`);
          break;
        }
        try {
          const keywords = (src.mapKeywords && src.mapKeywords.length > 0 ? src.mapKeywords : [undefined as unknown as string]).slice(0, 2);
          const mapResults = await Promise.all(
            keywords.map((kw) => firecrawlMapDomain(FIRECRAWL_API_KEY, src.homepage, kw)),
          );
          let candidateUrls = Array.from(new Set(mapResults.flat())).slice(0, 20);
          if (candidateUrls.length === 0) {
            candidateUrls = (await firecrawlHarvestLinks(FIRECRAWL_API_KEY, src.homepage)).slice(0, 20);
          }
          const toScrape = (await filterUnseenUrls(supabase, candidateUrls)).slice(0, 4);
          const scraped = await Promise.all(toScrape.map((u) => firecrawlScrapeUrl(FIRECRAWL_API_KEY, u)));
          let count = 0;
          for (const art of scraped) {
            if (!art) continue;
            allArticles.push({
              title: art.title,
              url: art.url,
              description: art.description,
              source: src.name,
              markdown: art.markdown,
              publishedDate: (art as any).publishedDate ?? null,
            });
            count += 1;
          }
          console.log(`[advisory-direct] ${src.name}: mapped=${candidateUrls.length}, scraped=${count}`);
        } catch (e) {
          console.error(`Advisory direct scrape failed for ${src.name}:`, e);
        }
      }
    }

    // ===== Direct Morocco-source scraping (homepage map + scrape top N) =====
    // This catches time-sensitive items (manifestations, blocages) that
    // /search misses. Runs whenever a Morocco source is in scope.
    if (runMoroccoPriority) {
      // Rotate which Morocco sources get the deep direct scrape each run so the
      // whole list is covered across days inside the Firecrawl rate budget.
      const MOROCCO_PER_RUN = 2;
      const moroccoToday = Array.from({ length: Math.min(MOROCCO_PER_RUN, MOROCCO_DIRECT_SOURCES.length) }, (_, i) =>
        MOROCCO_DIRECT_SOURCES[(dayIndex * MOROCCO_PER_RUN + i) % MOROCCO_DIRECT_SOURCES.length],
      ).filter((source) => plannedSourceNames.has(source.name));
      console.log(`Running direct scrape for ${moroccoToday.map((s) => s.name).join(", ")}`);
      const directScrapeStats: Record<string, { mapped: number; scraped: number }> = {};

      for (const src of moroccoToday) {
        if (budgetLeftMs() < 25_000) {
          console.log(`[budget] skipping remaining Morocco direct scrapes (${Math.round(budgetLeftMs() / 1000)}s left)`);
          break;
        }
        directScrapeStats[src.name] = { mapped: 0, scraped: 0 };
        try {
          // Run /map for each keyword in parallel; keywords like "manifestation"
          // surface civic-event articles that pure logistics queries miss.
          const keywords = (src.mapKeywords && src.mapKeywords.length > 0 ? src.mapKeywords : [undefined as unknown as string]).slice(0, 1);
          const mapResults = await Promise.all(
            keywords.map((kw) => firecrawlMapDomain(FIRECRAWL_API_KEY, src.homepage, kw)),
          );
           let candidateUrls = Array.from(new Set(mapResults.flat())).slice(0, 25);
           if (candidateUrls.length === 0) {
             candidateUrls = (await firecrawlHarvestLinks(FIRECRAWL_API_KEY, src.homepage)).slice(0, 25);
           }
          directScrapeStats[src.name].mapped = candidateUrls.length;

           const toScrape = (await filterUnseenUrls(supabase, candidateUrls)).slice(0, 4);
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
              publishedDate: (art as any).publishedDate ?? null,
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

    // Deduplicate by URL
    const uniqueArticles = Array.from(
      new Map(
        allArticles
          .filter(a => a.url && a.title)
          .map(a => [a.url, a])
      ).values()
    );

    const rejectionStats: Record<string, number> = {};
    const auditedArticles = uniqueArticles.filter((article) => {
      const reason = classifyArticleRejection(article);
      if (!reason) return true;
      rejectionStats[reason] = (rejectionStats[reason] || 0) + 1;
      console.log(`[article-reject:${reason}] ${article.title} — ${article.url}`);
      return false;
    });
    console.log(`[article-audit] input=${uniqueArticles.length} accepted=${auditedArticles.length} rejected=${uniqueArticles.length - auditedArticles.length}`, rejectionStats);

    // Step 1b: Validate URLs
    console.log(`Validating ${auditedArticles.length} article URLs...`);
    const validatedArticles: typeof uniqueArticles = [];
    const validationPromises = auditedArticles.map(async (article) => {
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
          const body = await resp2.text();
          if (resp2.ok && !PAYWALL_RE.test(body.slice(0, 3000))) return article;
        }
        // Vetted publishers that block bots outright shouldn't be dropped —
        // their content already came through Firecrawl.
        if ((resp.status === 403 || resp.status === 429) && BOT_BLOCKED_TRUSTED.test(new URL(article.url).hostname)) {
          return article;
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
      await finishRun({
        status: "partial",
        queries_total: searchPlans.length,
        queries_failed: queryStats.failed,
        candidates_found: uniqueArticles.length,
        candidates_accepted: 0,
        rejection_counts: rejectionStats,
      });
      await recordNewsHealth(uniqueArticles, [], [], "No articles passed source/date/link validation");
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

    // Prioritize primary global sources (Loadstar, JOC) at the head of the
    // batch so they always make the AI classifier's window.
    const PRIMARY_NAMES = new Set(["The Loadstar", "JOC"]);
    const primaryFirst = [
      ...articlesToProcess.filter((a) => PRIMARY_NAMES.has(a.source)),
      ...articlesToProcess.filter((a) => !PRIMARY_NAMES.has(a.source)),
    ];
    const classificationBatch = primaryFirst.slice(0, 100);
    const articleSummaries = classificationBatch.map((a, i) =>
      `[${i}] TITLE: ${a.title}\nURL: ${a.url}\nSOURCE: ${a.source}\nDESCRIPTION: ${a.description}\nCONTENT PREVIEW: ${a.markdown?.substring(0, 200) || "N/A"}`
    ).join("\n\n---\n\n");

    const classifyPrompt = `You are a freight forwarding intelligence analyst. The dashboard serves a Morocco-based freight forwarder but covers worldwide events that affect international trade flows.

Your job, for each article below:
1. FILTER: keep only items relevant to freight forwarding, shipping, logistics, trade, customs, ports, dangerous goods, compliance, infrastructure, finance regulation affecting trade, or enterprise IT/cybersecurity for logistics. Drop everything else.
2. CLASSIFY GEOGRAPHY based on what the article is ACTUALLY about — never default to Morocco.
3. CLASSIFY CONTENT TYPE and assign an impact score for a freight forwarder.

============================================================
GEOGRAPHIC CLASSIFICATION — STRICT RULES
============================================================
Use evidence in the title, body, source, and named entities (countries, cities, ports, authorities). Decide what AREA IS ACTUALLY AFFECTED, not the publisher's nationality.

Output these fields:
- "geographic_scope": "morocco" | "region" | "global"
- "primary_region": one of ${JSON.stringify(REGIONS)}
- "affected_regions": array of region slugs (subset of primary_region values, excluding "americas" alias)
- "affected_countries": array of country names or ISO codes mentioned as actually affected
- "display_regions": array — where the item must appear in the UI
- "region_confidence": number 0-1
- "classification_notes": one short sentence explaining the geographic decision

RULES for display_regions:
A. Morocco-specific (Moroccan authorities, ports, customs, cities, Bank Al-Maghrib, ADII, Tanger Med, Casablanca, Rabat, Tangier, Agadir, etc.):
   geographic_scope="morocco", primary_region="morocco", display_regions=["morocco"]
B. Region-specific (one continent / major region affected):
   geographic_scope="region", primary_region=<that region>, display_regions=[<that region>, "global"]
   Examples:
   - Brussels / EU / European Commission / Germany / France / Rotterdam / Antwerp → europe
   - Shanghai / China / Singapore / India / ASEAN / Japan / Korea → asia
   - Dubai / UAE / Saudi / Qatar / Red Sea / Houthi / Iran → middle_east
   - US / FMC / CBP / Washington / California / New York → north_america
   - Canada / Mexico → north_america
   - Brazil / Argentina / Chile / Peru → south_america
   - Australia / New Zealand → oceania
   - South Africa / Nigeria / Kenya / Egypt / Algeria / Tunisia (non-Morocco Africa) → africa
C. Truly global (worldwide regulation, global shipping, multiple continents, IMO/IATA/WTO/WCO worldwide rules, global supply chain, sanctions affecting many markets):
   geographic_scope="global", primary_region="global", display_regions=["global"]
D. NEVER default to Morocco. If the strongest evidence points elsewhere, use that region. If genuinely uncertain, fall back to "global", NOT Morocco.
E. A Moroccan publisher reporting on a strike in France → primary_region="europe", display_regions=["europe","global"]. The publisher's nationality is NOT the affected geography.
F. Region-only items (Europe, Asia, etc.) MUST also include "global" in display_regions so they appear in the Global filter.
G. Morocco-only items must NOT include "global" in display_regions.

============================================================
CONTENT TYPE & PRIORITY
============================================================
- "content_type": one of ${JSON.stringify(CONTENT_TYPES)}
- "category": one of ${JSON.stringify(CATEGORIES)} (legacy, keep consistent with content_type)
- "priority": one of ${JSON.stringify(PRIORITIES)}
- "impact_score": integer 0-100 — how much this disrupts a freight forwarder's operations

Content type guidance:
- regulatory_change: NEW binding law/decree/circular/directive
- customs_update: customs procedural changes, ADII / CBP / EU customs notices
- compliance: enforcement updates, mandatory procedural changes
- sanctions_trade_restriction: trade restrictions, sanctions, export controls, embargoes
- port_disruption: port closure, congestion, weather closure of port/route, road closure
- strike_protest_manifestation: manifestation, grève, sit-in, blocage, strike, protest disrupting freight flows
- carrier_air_sea_road: carrier schedule changes, blank sailings, airline route changes, trucker actions
- freight_market_update: rate movements, capacity reports, demand outlook
- finance_regulation: fiscal policy, central bank rule, banking regulation MATERIALLY affecting trade
- infrastructure: new port, terminal, rail, corridor, major investment
- technology_it_news: enterprise IT, cybersecurity, ERP/WMS/TMS, cloud advisories
- general_news: anything else still relevant

Priority guidance:
- critical: new binding law/rule the company must act on, OR a confirmed disruption (strike, port closure, sanctions taking effect)
- important: significant indirect impact on costs/timelines/procedures
- informational: good to know, no action needed

Impact score guidance (0-100):
- 80-100: regulatory_change with action required, or confirmed major disruption (port closed, strike on)
- 60-79: customs/compliance change, sanctions, large carrier disruption, multi-country effect
- 40-59: market shift, regional infrastructure, finance reg with trade impact
- 20-39: minor operational item, IT advisory affecting enterprise
- 0-19: general news, soft market commentary

============================================================
OUTPUT
============================================================
Return ONLY a JSON array. One object per kept article, with these fields:
{
  "index": number,
  "headline": string,
  "summary": string (2-3 sentences),
  "category": one of ${JSON.stringify(CATEGORIES)},
  "content_type": one of ${JSON.stringify(CONTENT_TYPES)},
  "primary_region": one of ${JSON.stringify(REGIONS)},
  "affected_regions": string[],
  "affected_countries": string[],
  "display_regions": string[],
  "geographic_scope": "morocco" | "region" | "global",
  "region_confidence": number 0-1,
  "classification_notes": string,
  "priority": one of ${JSON.stringify(PRIORITIES)},
  "impact_score": number 0-100,
  "impact_assessment": string,
  "action_required": boolean,
  "suggested_action": string | null
}

Today's date is ${today}.

Articles:

${articleSummaries}

Return ONLY the JSON array. No markdown fences, no commentary.`;

    let classifiedEntries: any;
    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: classifyPrompt }],
          max_tokens: 12000,
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

      try {
        classifiedEntries = JSON.parse(content);
      } catch (e) {
        console.warn("Initial JSON parse failed, attempting to salvage truncated response...");
        const lastCompleteObj = content.lastIndexOf("}");
        if (lastCompleteObj > 0) {
          const salvaged = content.substring(0, lastCompleteObj + 1) + "]";
          classifiedEntries = JSON.parse(salvaged);
          console.log(`Salvaged ${classifiedEntries.length} entries from truncated response`);
        } else {
          throw new Error("No salvageable JSON found");
        }
      }
    } catch (aiErr) {
      // Ingestion must never stop because the AI gateway is unavailable, rate
      // limited or out of credits. Fall back to deterministic keyword rules so
      // the daily scrape still lands in the database.
      console.error("Falling back to heuristic classification:", aiErr);
      classifiedEntries = heuristicClassify(classificationBatch);
    }

    if (!Array.isArray(classifiedEntries) || classifiedEntries.length === 0) {
      console.log("AI filtered out all articles as irrelevant");
      const updatedAt = await touchLatestRefresh(supabase, checkedAt);
      await finishRun({
        status: "partial",
        queries_total: searchPlans.length,
        queries_failed: queryStats.failed,
        candidates_found: uniqueArticles.length,
        candidates_accepted: validatedArticles.length,
        rejection_counts: rejectionStats,
      });
      await recordNewsHealth(uniqueArticles, validatedArticles, [], "AI relevance classification returned no logistics items");
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
      const originalArticle = classificationBatch[entry.index] || {};

      // ----- Geographic classification -----
      const validRegion = (r: any) =>
        typeof r === "string" && REGIONS.includes(r) ? r : null;

      const primaryRegion = validRegion(entry.primary_region) || validRegion(entry.region) || "global";

      let displayRegions: string[] = Array.isArray(entry.display_regions)
        ? entry.display_regions.filter((r: any) => typeof r === "string" && REGIONS.includes(r))
        : [];

      // Safety net: enforce the rules even if the model slipped.
      if (displayRegions.length === 0) {
        if (primaryRegion === "morocco") {
          displayRegions = ["morocco"];
        } else if (primaryRegion === "global") {
          displayRegions = ["global"];
        } else {
          displayRegions = [primaryRegion, "global"];
        }
      }
      // Region-specific items must also be in global; morocco-only must not.
      if (primaryRegion === "morocco") {
        displayRegions = ["morocco"];
      } else if (primaryRegion !== "global" && !displayRegions.includes("global")) {
        displayRegions.push("global");
      }

      // The DB region enum doesn't have an "all" — pick something it accepts.
      // Map the new NA/SA/Oceania values straight through (enum was extended).
      const dbRegion = primaryRegion;

      const affectedCountries = Array.isArray(entry.affected_countries)
        ? entry.affected_countries.filter((c: any) => typeof c === "string").slice(0, 20)
        : [];

      const contentType = typeof entry.content_type === "string" && CONTENT_TYPES.includes(entry.content_type)
        ? entry.content_type
        : "general_news";

      const impactScore = Math.max(0, Math.min(100, Math.round(Number(entry.impact_score) || 0)));
      const regionConfidence = Math.max(0, Math.min(1, Number(entry.region_confidence) || 0));

      // Use the REAL source publication date when available; never fall back to today.
      const sourcePubDate: string | null =
        (originalArticle as any).publishedDate || null;
      const headline = entry.headline || originalArticle.title;
      const sourceUrl = originalArticle.url || null;
      const auditCandidate = {
        title: headline,
        url: sourceUrl || "",
        description: entry.summary || originalArticle.description || "",
        markdown: originalArticle.markdown || "",
        publishedDate: sourcePubDate,
      };
      const rejectionReason = classifyArticleRejection(auditCandidate);
      // classifyArticleRejection may date a trusted undated tier-1 article.
      const resolvedPubDate = auditCandidate.publishedDate || sourcePubDate;
      const verificationStatus = rejectionReason === "title_url_mismatch"
        ? "source_mismatch"
        : rejectionReason === "outdated_or_missing_date"
          ? "outdated"
          : rejectionReason === "paywalled_or_unreadable"
            ? "broken_link"
            : resolvedPubDate ? "verified" : "date_not_verified";
      const quality = assessIntelligenceQuality({
        headline,
        summary: entry.summary || originalArticle.description,
        content: originalArticle.markdown,
        sourceName: originalArticle.source,
        country: affectedCountries.join(" "),
        actionRequired: entry.action_required === true,
      });

      return {
        headline,
        summary: entry.summary || originalArticle.description,
        source_name: originalArticle.source || extractSourceName(originalArticle.url || ""),
        source_url: sourceUrl,
        category: CATEGORIES.includes(entry.category) ? entry.category : "general",
        region: dbRegion,
        priority: PRIORITIES.includes(entry.priority) ? entry.priority : "informational",
        impact_assessment: entry.impact_assessment || null,
        action_required: entry.action_required || false,
        suggested_action: entry.suggested_action || null,
        published_date: resolvedPubDate ?? today, // legacy column — keep filled
        publication_date: resolvedPubDate,        // real source date (or discovery date for trusted undated tier-1)
        verification_status: verificationStatus,
        week_number: weekNumber,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        display_regions: displayRegions,
        affected_countries: affectedCountries,
        content_type: contentType,
        impact_score: Math.max(impactScore, quality.relevanceScore),
        region_confidence: regionConfidence || null,
        classification_notes: typeof entry.classification_notes === "string"
          ? entry.classification_notes.slice(0, 500)
          : null,
        _quality: quality,
      };
    }).filter((row: any) =>
      (row.verification_status === "verified" || row.verification_status === "partially_verified") &&
      row._quality.publishable
    ).map(({ _quality, ...row }: any) => row);

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
      await finishRun({
        status: "success",
        queries_total: searchPlans.length,
        queries_failed: queryStats.failed,
        candidates_found: uniqueArticles.length,
        candidates_accepted: validatedArticles.length,
        rejection_counts: rejectionStats,
      });
      await recordNewsHealth(uniqueArticles, validatedArticles, []);
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

    // Persist telemetry BEFORE the downstream chain. Classification and
    // enrichment can outlive the worker, which previously left the run row
    // stuck at "running" even though ingestion had succeeded.
    await finishRun({
      status: queryStats.failed > 0 ? "partial" : "success",
      queries_total: searchPlans.length,
      queries_failed: queryStats.failed,
      candidates_found: uniqueArticles.length,
      candidates_accepted: validatedArticles.length,
      inserted_count: data.length,
      rejection_counts: rejectionStats,
      source_report: { scraped_by_source: scrapedBySource, inserted_by_source: insertedBySource },
    });
    await recordNewsHealth(uniqueArticles, validatedArticles, newRows);

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

    // Chain enrichment: turn the new raw entries into Intelligence Items
    let enrichedCount = 0;
    try {
      const enrichResp = await fetch(`${SUPABASE_URL}/functions/v1/enrich-intel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ limit: Math.min(data.length || 30, 60) }),
      });
      if (enrichResp.ok) {
        const r = await enrichResp.json();
        enrichedCount = Number(r.created || 0);
        console.log(`enrich-intel: created ${r.created}, failed ${r.failed}`);
      } else {
        console.error("enrich-intel call failed:", enrichResp.status, await enrichResp.text());
      }
    } catch (enrichErr) {
      console.error("Failed to trigger enrich-intel:", enrichErr);
    }

    await finishRun({ enriched_count: enrichedCount });
    if (leaseToken) {
      await supabase.rpc("release_pipeline_lease", {
        _pipeline: "fetch-news", _token: leaseToken, _succeeded: true, _stage: "complete", _error: null,
      });
      leaseToken = null;
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
        source_report: {
          queries: { total: searchPlans.length, ok: queryStats.ok, empty: queryStats.empty, failed: queryStats.failed },
          scraped_by_source: scrapedBySource,
          inserted_by_source: insertedBySource,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-news error:", e);
    await finishRun({
      status: "failed",
      error_message: e instanceof Error ? e.message.slice(0, 1000) : "Unknown error",
    });
    if (telemetryClient && leaseToken) {
      await telemetryClient.rpc("release_pipeline_lease", {
        _pipeline: "fetch-news", _token: leaseToken, _succeeded: false, _stage: "failed",
        _error: e instanceof Error ? e.message.slice(0, 1000) : "Unknown error",
      });
      leaseToken = null;
    }
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
    // JOC serves some articles from a staging mirror (prod.int.joc.com);
    // normalise it so those items are attributed to JOC.
    const hostname = new URL(url).hostname
      .replace(/^www\./, "")
      .replace(/^prod\.int\.joc\.com$/, "joc.com");
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
      "medias24.com": "Médias24",
      "leconomiste.com": "L'Economiste",
      "fnh.ma": "Finances News Hebdo",
      "economiste.com": "L'Economiste",
      "lavieeco.com": "La Vie Éco",
      "hespress.com": "Hespress",
      "en.hespress.com": "Hespress",
      "fr.hespress.com": "Hespress",
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
      "sekologistics.com": "SEKO Logistics",
      "kuehne-nagel.com": "Kuehne+Nagel",
      "newsroom.kuehne-nagel.com": "Kuehne+Nagel",
      "hillebrandgori.com": "Hillebrand Gori",
      "maersk.com": "Maersk",
      "msc.com": "MSC",
      "cma-cgm.com": "CMA CGM",
      "hapag-lloyd.com": "Hapag-Lloyd",
      "maritime-executive.com": "The Maritime Executive",
      "icis.com": "ICIS",
      "supplychainbrain.com": "Supply Chain Brain",
      "logisticsmgmt.com": "Logistics Management",
      "bairdmaritime.com": "Baird Maritime",
      "marinelink.com": "MarineLink",
      "project44.com": "project44",
      "everstream.ai": "Everstream Analytics",
      "resilinc.com": "Resilinc",
    };
    return sourceMap[hostname] || hostname;
  } catch {
    return "Unknown Source";
  }
}

/**
 * Deterministic, AI-free classifier used when the AI gateway is unavailable
 * (rate limit, outage, exhausted credits). Keeps the daily scrape flowing.
 */
function heuristicClassify(
  articles: Array<{ title: string; url: string; description?: string; markdown?: string; source?: string }>,
) {
  const out: any[] = [];
  articles.forEach((a, index) => {
    const text = `${a.title || ""} ${a.description || ""}`.toLowerCase();

    let category = "general";
    if (/customs|tariff|regulation|sanction|compliance|law|directive|rule/.test(text)) category = "regulation";
    else if (/storm|typhoon|cyclone|hurricane|flood|heat|snow|weather|fog/.test(text)) category = "weather";
    else if (/port|terminal|berth|quay|congestion|canal|strait/.test(text)) category = "port";
    else if (/tariff|export|import|trade|wto/.test(text)) category = "trade";
    else if (/rate|freight rate|market|capacity|demand|index/.test(text)) category = "market";

    let priority = "informational";
    if (/strike|closure|closed|blockade|shutdown|attack|suspend|halt|force majeure|emergency/.test(text)) {
      priority = "critical";
    } else if (/delay|congestion|disrupt|surcharge|diversion|backlog|warning|restriction/.test(text)) {
      priority = "important";
    }

    let primaryRegion = "global";
    if (/morocco|maroc|casablanca|tanger med|tangier/.test(text)) primaryRegion = "morocco";
    else if (/europe|eu |european|spain|france|germany|rotterdam|antwerp|hamburg/.test(text)) primaryRegion = "europe";
    else if (/china|asia|singapore|japan|korea|india|vietnam|shanghai/.test(text)) primaryRegion = "asia";
    else if (/united states|u\.s\.|usa|canada|mexico|los angeles|new york/.test(text)) primaryRegion = "north_america";
    else if (/brazil|argentina|chile|peru|colombia/.test(text)) primaryRegion = "south_america";
    else if (/africa|nigeria|egypt|kenya|south africa/.test(text)) primaryRegion = "africa";
    else if (/middle east|red sea|suez|hormuz|uae|dubai|saudi|iran|israel/.test(text)) primaryRegion = "middle_east";
    else if (/australia|new zealand|oceania/.test(text)) primaryRegion = "oceania";

    out.push({
      index,
      relevant: true,
      headline: a.title,
      summary: (a.description || a.title || "").slice(0, 600),
      category,
      priority,
      primary_region: primaryRegion,
      display_regions: primaryRegion === "morocco"
        ? ["morocco"]
        : primaryRegion === "global"
          ? ["global"]
          : [primaryRegion, "global"],
      affected_countries: [],
      content_type: "general_news",
      impact_score: priority === "critical" ? 75 : priority === "important" ? 55 : 30,
      region_confidence: 0.5,
      classification_notes: "Heuristic classification (AI gateway unavailable).",
      impact_assessment: null,
      action_required: priority === "critical",
      suggested_action: null,
    });
  });
  return out;
}
