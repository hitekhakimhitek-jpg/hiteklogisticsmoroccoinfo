const NON_ARTICLE_PATH = /\/(white-papers?|special-reports?|magazine|director(?:y|ies)|categor(?:y|ies)|tags?|topics?|media-kit|newsletters?|release-notes?|search|authors?|feedback-from)(?:\/|$|\?)/i;
const NON_ARTICLE_TITLE = /^(?:page not found|404|white papers?|special reports?|magazine|rail directories|logistics technology news|feedback from|(?:air cargo|rail|container shipping|maritime|trucking|logistics|shipping|freight|ports?) news)(?:\s*[|:\-–—].*)?$/i;

const PROMOTIONAL_SENTENCE = /(?:get the daily insights|insights that power|subscribe(?: now)?|sign up|register now|read more|click here|follow us|join our newsletter|all rights reserved|advertisement|related articles?|recommended for you|share this article|download the app)/i;
const NAVIGATION_FRAGMENT = /^(?:home|news|latest news|markets?|topics?|sections?|menu|search|login|sign in|subscribe)$/i;

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
  const cleaned = String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|ma|fr|co\.uk)\/\S*/gi, " ")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/#{2,}\w*/g, " ")
    .replace(/[*_`~|>{}\[\]]+/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/^\s*(?:by|author)\s+[\p{L} .'-]{2,60}\s*$/gimu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\s*[•·]\s*/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20 && !PROMOTIONAL_SENTENCE.test(sentence) && !NAVIGATION_FRAGMENT.test(sentence));
  return sentences.join(" ").slice(0, 900).trim();
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

const DUPLICATE_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "after", "amid", "over", "new", "news", "update", "updates",
  "a", "an", "of", "to", "in", "on", "at", "as", "is", "are", "de", "la", "le", "les", "des", "du", "et", "en",
]);

export function titleFingerprint(value?: string | null): string {
  return normalizedTitle(value)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !DUPLICATE_STOP_WORDS.has(word))
    .sort()
    .join(" ");
}

export function areLikelyDuplicateTitles(a?: string | null, b?: string | null): boolean {
  const left = titleFingerprint(a);
  const right = titleFingerprint(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const A = new Set(left.split(" "));
  const B = new Set(right.split(" "));
  let overlap = 0;
  for (const word of A) if (B.has(word)) overlap++;
  return overlap >= 4 && overlap / Math.min(A.size, B.size) >= 0.82;
}