const NON_ARTICLE_PATH = /\/(white-papers?|special-reports?|magazine|director(?:y|ies)|categor(?:y|ies)|tags?|topics?|media-kit|newsletters?|release-notes?|search|authors?|feedback-from)(?:\/|$|\?)/i;
const NON_ARTICLE_TITLE = /^(?:page not found|404|white papers?|special reports?|magazine|rail directories|logistics technology news|feedback from)(?:\s*[|:\-–—].*)?$/i;

export function canonicalizeUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function cleanTitle(value?: string | null, sourceName?: string | null): string {
  let title = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\.(?:svg|png|jpe?g|gif)[^)]*\)/gi, " ")
    .replace(/\[[^\]]*\.(?:svg|png|jpe?g|gif)\]\([^)]*\)/gi, " ")
    .replace(/(?:https?:\/\/\S+)?\S+\.svg\b/gi, " ")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[|>*_`]+|[|>*_`]+\s*$/g, "")
    .replace(/^\s*(?:by|author)\s+[\p{L} .'-]{2,60}\s*$/giu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (sourceName) {
    const escaped = sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`\\s*[|–—-]\\s*${escaped}\\s*$`, "i"), "").trim();
  }
  return title.slice(0, 240);
}

export function cleanSummary(value?: string | null): string {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/^\s*(?:by|author)\s+[\p{L} .'-]{2,60}\s*$/gimu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

export function nonArticleReason(input: { title?: string | null; url?: string | null; content?: string | null }): string | null {
  const title = cleanTitle(input.title);
  const url = canonicalizeUrl(input.url);
  if (!url) return "invalid_url";
  const parsed = new URL(url);
  if (NON_ARTICLE_PATH.test(`${parsed.pathname}${parsed.search}`)) return "non_article_path";
  if (NON_ARTICLE_TITLE.test(title)) return "non_article_title";
  if (/\.(?:svg|png|jpe?g|gif|css|js|xml|pdf)$/i.test(parsed.pathname)) return "non_article_asset";
  if (!title || title.length < 18) return "missing_article_title";
  if (/page not found|404 not found/i.test(`${title} ${input.content || ""}`.slice(0, 1000))) return "page_not_found";
  return null;
}

export function normalizedTitle(value?: string | null): string {
  return cleanTitle(value).toLowerCase().replace(/[^a-z0-9\p{L}]+/gu, " ").trim();
}