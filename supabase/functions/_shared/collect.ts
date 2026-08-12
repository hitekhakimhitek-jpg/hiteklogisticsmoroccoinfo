// Multi-method collector.
//
// Priority order (per the upgrade spec):
//   1. JSON / official API
//   2. RSS / Atom / XML / CAP
//   3. Sitemap discovery
//   4. Semantic HTML extraction (JSON-LD, OpenGraph, <article>)
//   5. Raw text bulletins
// A source only falls through to the next method when the previous one
// returns zero parseable records.

import { isSafeExternalUrl } from "./auth.ts";

export interface CollectedItem {
  title: string;
  url: string;
  summary?: string;
  body?: string;
  publishedAt?: string | null;
  language?: string;
  raw?: Record<string, unknown>;
}

export interface CollectOutcome {
  items: CollectedItem[];
  method: string;
  httpStatus: number;
  pagesRequested: number;
  error?: string | null;
}

const UA =
  "HitekIntelligenceBot/1.0 (+https://info.hitek.ma; logistics early-warning monitoring)";

export async function safeFetch(
  url: string,
  timeoutMs = 20000,
  headers: Record<string, string> = {},
): Promise<{ res: Response | null; status: number; text: string; error?: string }> {
  if (!isSafeExternalUrl(url)) return { res: null, status: 0, text: "", error: "unsafe url" };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "*/*", ...headers },
    });
    const text = res.ok ? await res.text() : "";
    return { res, status: res.status, text, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    return { res: null, status: 0, text: "", error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

// ---------- helpers ----------

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block: string, name: string): string {
  const m = block.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "i"));
  return m ? stripTags(m[1]) : "";
}

function attrValue(block: string, tag: string, attr: string): string {
  const m = block.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*\\b${attr}=["']([^"']+)["']`, "i"));
  return m ? m[1] : "";
}

export function parseDateSafe(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Compact meteorological stamps: 202608120600Z / 20260812T0600Z
  const m = cleaned.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})/);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`;
    const d2 = new Date(iso);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }
  return null;
}

function absolute(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

// ---------- Level 2: RSS / Atom / CAP ----------

export function parseFeed(xml: string, baseUrl: string): CollectedItem[] {
  const out: CollectedItem[] = [];
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  for (const b of blocks) {
    const title = tagValue(b, "title");
    let link = tagValue(b, "link") || attrValue(b, "link", "href") || tagValue(b, "guid");
    if (!title && !link) continue;
    link = absolute(link || baseUrl, baseUrl);
    const published =
      parseDateSafe(tagValue(b, "pubDate")) ||
      parseDateSafe(tagValue(b, "published")) ||
      parseDateSafe(tagValue(b, "updated")) ||
      parseDateSafe(tagValue(b, "date")) ||
      parseDateSafe(tagValue(b, "effective")) ||
      parseDateSafe(tagValue(b, "sent"));
    const summary =
      tagValue(b, "description") ||
      tagValue(b, "summary") ||
      tagValue(b, "content") ||
      tagValue(b, "headline") ||
      "";
    out.push({
      title: title || summary.slice(0, 140) || link,
      url: link,
      summary: summary.slice(0, 4000),
      publishedAt: published,
      raw: { block: b.slice(0, 6000) },
    });
  }

  // CAP <alert><info> documents that are not item/entry based.
  if (out.length === 0 && /<alert[\s>]/i.test(xml)) {
    for (const m of xml.matchAll(/<info\b[\s\S]*?<\/info>/gi)) {
      const b = m[0];
      const title = tagValue(b, "headline") || tagValue(b, "event");
      if (!title) continue;
      out.push({
        title,
        url: tagValue(b, "web") || baseUrl,
        summary: [tagValue(b, "description"), tagValue(b, "instruction")].filter(Boolean).join(" — ").slice(0, 4000),
        publishedAt:
          parseDateSafe(tagValue(xml, "sent")) || parseDateSafe(tagValue(b, "effective")),
        raw: { cap: b.slice(0, 6000), severity: tagValue(b, "severity"), area: tagValue(b, "areaDesc") },
      });
    }
  }
  return out;
}

// ---------- Level 1: JSON / API ----------

export function parseJsonFeed(json: unknown, baseUrl: string): CollectedItem[] {
  const out: CollectedItem[] = [];
  const pick = (o: Record<string, unknown>, keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  };
  const walk = (arr: unknown[]) => {
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const title = pick(o, ["title", "headline", "name", "event", "subject", "summary"]);
      if (!title) continue;
      const url = pick(o, ["url", "link", "permalink", "web", "href", "id"]) ?? baseUrl;
      out.push({
        title,
        url: absolute(url, baseUrl),
        summary: pick(o, ["description", "summary", "content_text", "content", "text", "body"])?.slice(0, 4000),
        publishedAt: parseDateSafe(
          pick(o, ["published", "date_published", "pubDate", "published_at", "issued", "sent", "updated", "date", "issuetime", "pubtime", "time", "effective", "onset"]),
        ),
        raw: o as Record<string, unknown>,
      });
    }
  };
  const normalize = (v: unknown[]) =>
    v.map((f) => {
      const fo = f as Record<string, unknown>;
      return fo && typeof fo === "object" && fo.properties
        ? { ...(fo.properties as Record<string, unknown>), geometry: fo.geometry }
        : fo;
    });

  // Find the first array of objects anywhere in the document (handles
  // wrappers such as {data:{page:{list:[...]}}} used by some agencies).
  const findArray = (node: unknown, depth = 0): unknown[] | null => {
    if (depth > 5 || !node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      return node.some((x) => x && typeof x === "object") ? node : null;
    }
    for (const key of ["items", "results", "data", "articles", "features", "alerts", "records", "entries", "list", "page"]) {
      const v = (node as Record<string, unknown>)[key];
      const found = findArray(v, depth + 1);
      if (found) return found;
    }
    for (const v of Object.values(node as Record<string, unknown>)) {
      const found = findArray(v, depth + 1);
      if (found) return found;
    }
    return null;
  };

  if (Array.isArray(json)) walk(normalize(json));
  else if (json && typeof json === "object") {
    const found = findArray(json);
    if (found) walk(normalize(found));
  }
  return out;
}

// ---------- Level 3: semantic HTML ----------

export function parseHtml(html: string, baseUrl: string): CollectedItem[] {
  const out: CollectedItem[] = [];
  const seen = new Set<string>();

  // JSON-LD first — most reliable structured data on news pages.
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const nodes = Array.isArray(data) ? data : [data, ...(Array.isArray((data as Record<string, unknown>)["@graph"]) ? (data as Record<string, unknown>)["@graph"] as unknown[] : [])];
      for (const n of nodes) {
        const o = n as Record<string, unknown>;
        if (!o || typeof o !== "object") continue;
        const type = String(o["@type"] ?? "");
        if (!/Article|NewsArticle|BlogPosting|Report/i.test(type)) continue;
        const title = String(o.headline ?? o.name ?? "").trim();
        const url = absolute(String(o.url ?? o.mainEntityOfPage ?? baseUrl), baseUrl);
        if (!title || seen.has(url)) continue;
        seen.add(url);
        out.push({
          title,
          url,
          summary: String(o.description ?? "").slice(0, 4000),
          publishedAt: parseDateSafe(String(o.datePublished ?? o.dateModified ?? "")),
        });
      }
    } catch { /* malformed ld+json is common; ignore */ }
  }
  if (out.length) return out;

  // <article> blocks with a heading + link.
  for (const m of html.matchAll(/<article\b[\s\S]{0,6000}?<\/article>/gi)) {
    const b = m[0];
    const link = b.match(/<a[^>]+href=["']([^"'#]+)["']/i)?.[1];
    const heading = b.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1];
    if (!link || !heading) continue;
    const url = absolute(link, baseUrl);
    const title = stripTags(heading);
    if (!title || seen.has(url)) continue;
    seen.add(url);
    const time = b.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];
    out.push({ title, url, summary: stripTags(b).slice(0, 800), publishedAt: parseDateSafe(time) });
  }
  if (out.length) return out;

  // Fallback: headline-shaped anchors.
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{4,220}?)<\/a>/gi)) {
    const url = absolute(m[1], baseUrl);
    const title = stripTags(m[2]);
    if (title.length < 25 || seen.has(url)) continue;
    if (!/^https?:/i.test(url)) continue;
    seen.add(url);
    out.push({ title, url, publishedAt: null });
    if (out.length >= 40) break;
  }

  // Single-page advisory (no link list): use OpenGraph / <title> + body.
  if (out.length === 0) {
    const title =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    if (title) {
      const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1];
      out.push({
        title,
        url: baseUrl,
        summary: (desc ?? stripTags(html)).slice(0, 4000),
        body: stripTags(html).slice(0, 8000),
        publishedAt: parseDateSafe(
          html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i)?.[1],
        ),
      });
    }
  }
  return out;
}

// ---------- Level 5: raw text bulletins ----------

export function parseTextBulletin(text: string, url: string, sourceName: string): CollectedItem[] {
  const trimmed = text.trim();
  if (trimmed.length < 40) return [];
  const firstMeaningful =
    trimmed.split("\n").map((l) => l.trim()).find((l) => l.length > 12 && !/^[-=*_ ]+$/.test(l)) ??
    `${sourceName} bulletin`;
  return [{
    title: firstMeaningful.slice(0, 200),
    url,
    summary: trimmed.slice(0, 4000),
    body: trimmed.slice(0, 12000),
    publishedAt: parseDateSafe(trimmed.match(/\b(\d{6,8}Z?)\b/)?.[1] ?? null),
  }];
}

// ---------- Level 4: sitemap ----------

export function parseSitemap(xml: string): CollectedItem[] {
  const out: CollectedItem[] = [];
  for (const m of xml.matchAll(/<url\b[\s\S]*?<\/url>/gi)) {
    const b = m[0];
    const loc = tagValue(b, "loc");
    if (!loc) continue;
    const title = tagValue(b, "title");
    out.push({
      title: title || loc.split("/").filter(Boolean).pop()!.replace(/[-_]/g, " ").slice(0, 200),
      url: loc,
      publishedAt: parseDateSafe(tagValue(b, "publication_date") || tagValue(b, "lastmod")),
    });
  }
  return out.slice(0, 60);
}

// ---------- orchestration ----------

function looksLikeJson(text: string, contentType: string): boolean {
  return /json/i.test(contentType) || /^[\[{]/.test(text.trim());
}

function looksLikeXml(text: string, contentType: string): boolean {
  return /xml|rss|atom/i.test(contentType) || /^<\?xml|<rss|<feed|<alert/i.test(text.trim());
}

/**
 * Try one URL with the best method for whatever actually comes back.
 * Never reports success just because the HTTP request worked.
 */
export async function collectFromUrl(
  url: string,
  opts: { sourceName: string; timeoutMs?: number } ,
): Promise<CollectOutcome> {
  const { res, status, text, error } = await safeFetch(url, opts.timeoutMs ?? 20000);
  if (!res || !text) {
    return { items: [], method: "none", httpStatus: status, pagesRequested: 1, error: error ?? "empty response" };
  }
  const ct = res.headers.get("content-type") ?? "";

  if (looksLikeJson(text, ct)) {
    try {
      const items = parseJsonFeed(JSON.parse(text), url);
      if (items.length) return { items, method: "json", httpStatus: status, pagesRequested: 1 };
    } catch { /* fall through */ }
  }
  if (looksLikeXml(text, ct)) {
    if (/<urlset|<sitemapindex/i.test(text)) {
      const items = parseSitemap(text);
      if (items.length) return { items, method: "sitemap", httpStatus: status, pagesRequested: 1 };
    }
    const items = parseFeed(text, url);
    if (items.length) return { items, method: "feed", httpStatus: status, pagesRequested: 1 };
  }
  if (/text\/plain/i.test(ct) || (!/[<{]/.test(text.trim()[0] ?? ""))) {
    const items = parseTextBulletin(text, url, opts.sourceName);
    if (items.length) return { items, method: "text", httpStatus: status, pagesRequested: 1 };
  }
  const items = parseHtml(text, url);
  if (items.length) return { items, method: "html", httpStatus: status, pagesRequested: 1 };

  return {
    items: [],
    method: "none",
    httpStatus: status,
    pagesRequested: 1,
    error: "PARSER_FAILURE: response retrieved but no records extracted",
  };
}

/**
 * Level 1→5 fallback chain across a list of candidate URLs for one source.
 * Also tries sitemap discovery when the configured endpoints yield nothing.
 */
export async function collectSource(
  sourceName: string,
  urls: string[],
  opts: { homepage?: string; trySitemap?: boolean } = {},
): Promise<CollectOutcome> {
  let last: CollectOutcome = { items: [], method: "none", httpStatus: 0, pagesRequested: 0, error: "no urls configured" };
  let pages = 0;
  for (const u of urls) {
    const r = await collectFromUrl(u, { sourceName });
    pages += r.pagesRequested;
    if (r.items.length) return { ...r, pagesRequested: pages };
    last = r;
  }
  if (opts.trySitemap && opts.homepage) {
    for (const path of ["/sitemap.xml", "/news-sitemap.xml", "/sitemap_index.xml"]) {
      const r = await collectFromUrl(new URL(path, opts.homepage).toString(), { sourceName });
      pages += r.pagesRequested;
      if (r.items.length) return { ...r, method: "sitemap", pagesRequested: pages };
    }
  }
  return { ...last, pagesRequested: pages };
}
