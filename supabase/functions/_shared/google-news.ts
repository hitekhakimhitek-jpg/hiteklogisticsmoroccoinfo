import { sanitizeNewsText } from "./intel-article.ts";

export type GoogleNewsArticle = {
  title: string;
  url: string;
  description: string;
  source: string;
  requestedSource: string;
  markdown: string;
  publishedDate: string | null;
};

function decodeXml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tagText(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match?.[1]
    ? sanitizeNewsText(decodeXml(match[1].replace(/<!\[CDATA\[|\]\]>/g, "")))
    : "";
}

export function buildGoogleNewsRssUrl(query: string, preserveSiteFilter = false): string {
  const base = preserveSiteFilter
    ? query
    : query.replace(/\bsite:\S+/gi, " ");
  const normalized = base
    .replace(/\s+OR\s+(OR\s+)+/gi, " OR ")
    .replace(/(^\s*OR\s+|\s+OR\s*$)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${normalized} when:7d`);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

export function parseGoogleNewsRss(xml: string, requestedSource: string, limit = 10): GoogleNewsArticle[] {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
    .slice(0, Math.max(0, limit))
    .map((match) => {
      const item = match[1];
      const publisher = tagText(item, "source");
      let title = tagText(item, "title");
      if (publisher && title.endsWith(` - ${publisher}`)) {
        title = title.slice(0, -(publisher.length + 3)).trim();
      }
      const url = tagText(item, "link");
      const rawDate = tagText(item, "pubDate");
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const publishedDate = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString().slice(0, 10)
        : null;
      const description = tagText(item, "description").slice(0, 700) || title;
      return {
        title,
        url,
        description,
        source: publisher || requestedSource,
        requestedSource,
        markdown: `${title}. Publisher: ${publisher || requestedSource}`,
        publishedDate,
      };
    })
    .filter((article) => article.title.length > 0 && /^https?:\/\//i.test(article.url));
}