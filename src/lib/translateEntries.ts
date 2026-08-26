import { supabase } from "@/integrations/supabase/client";
import type { DbNewsEntry } from "@/hooks/useFreightData";

const FIELDS: (keyof DbNewsEntry)[] = [
  "headline",
  "summary",
  "impact_assessment",
  "suggested_action",
  "full_content",
];

// Bump version to invalidate stale cached translations (e.g. when the
// edge function previously echoed English back unchanged).
const CACHE_VERSION = "v6";
function cacheKey(target: "fr" | "en", text: string) {
  return `tr:${CACHE_VERSION}:${target}:${text}`;
}

// In-memory cache is the source of truth for the session: localStorage can be
// full (quota) or unavailable, and relying on it alone silently dropped every
// translation, leaving cards in English.
const memCache = new Map<string, string>();

function getCached(target: "fr" | "en", text: string): string | null {
  const key = cacheKey(target, text);
  const hit = memCache.get(key);
  if (hit) return hit;
  try {
    const v = localStorage.getItem(key);
    if (v) memCache.set(key, v);
    return v;
  } catch {
    return null;
  }
}

function setCached(target: "fr" | "en", text: string, value: string) {
  const key = cacheKey(target, text);
  memCache.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded — drop old translation entries and retry once.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("tr:") && !k.startsWith(`tr:${CACHE_VERSION}:`)) localStorage.removeItem(k);
      }
      localStorage.setItem(key, value);
    } catch {
      /* keep the in-memory copy only */
    }
  }
}

async function translateChunk(
  slice: string[],
  target: "fr" | "en",
  attempt = 0,
): Promise<(string | null)[]> {
  try {
    const { data, error } = await supabase.functions.invoke("translate-text", {
      body: { texts: slice, target },
    });
    if (error) throw error;
    const translations: string[] = Array.isArray(data?.translations)
      ? data.translations
      : [];
    if (translations.length !== slice.length) return slice.map(() => null);
    // Guard against the model echoing the source back: an unchanged string that
    // still looks English must be treated as a failure, never cached as French.
    return translations.map((t, i) => {
      if (typeof t !== "string" || !t.trim()) return null;
      if (target === "fr" && t.trim() === slice[i].trim() && looksEnglish(t)) return null;
      if (target === "en" && t.trim() === slice[i].trim() && looksFrench(t)) return null;
      return t;
    });
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return translateChunk(slice, target, attempt + 1);
    }
    console.error("translate batch failed", e);
    // Return nulls so failures are NOT cached as if they were translations.
    return slice.map(() => null);
  }
}

// Cheap English detector — used only to reject echoed source strings.
const EN_WORDS =
  /\b(the|and|of|to|for|with|from|after|new|will|is|are|as|by|has|have|says|amid|over|into|per|shipping|port|freight|customs|week|strike|market|rates?)\b/i;
function looksEnglish(s: string): boolean {
  return EN_WORDS.test(s);
}

const FR_WORDS = /\b(le|la|les|des|du|de|et|pour|avec|dans|sur|une|un|est|sont|sera|ont|aux|par|depuis|importations?|transport|marché|grève|portuaire|bientôt|reprendront)\b/i;
function looksFrench(s: string): boolean {
  return FR_WORDS.test(s);
}

/**
 * Translate a list of records field-by-field with *per-record coherence*:
 * if any translatable field of a record fails to translate, the whole record
 * is returned untouched in English. This prevents cards that mix a French
 * headline with an English summary.
 */
export async function translateRecords<T extends Record<string, unknown>>(
  rows: T[],
  fields: (keyof T)[],
  target: "fr" | "en",
): Promise<T[]> {
  if (rows.length === 0) return rows;

  const need = new Set<string>();
  for (const r of rows) {
    for (const f of fields) {
      const v = r[f];
      if (typeof v === "string" && v.trim() && !getCached(target, v)) need.add(v);
    }
  }
  const uniques = Array.from(need);
  if (uniques.length > 0) {
    const translated = await batchTranslate(uniques, target);
    uniques.forEach((src, i) => {
      const t = translated[i];
      if (t) setCached(target, src, t);
    });
  }

  return rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const f of fields) {
      const v = r[f];
      if (typeof v !== "string" || !v.trim()) continue;
      const t = getCached(target, v);
      if (!t) return r; // all-or-nothing: keep the record fully in English
      out[f as string] = t;
    }
    return out as T;
  });
}

async function batchTranslate(
  texts: string[],
  target: "fr" | "en",
): Promise<(string | null)[]> {
  if (texts.length === 0) return [];
  // Small chunks + limited concurrency: long single requests were being
  // aborted by the browser ("Load failed"), which silently returned English.
  const CHUNK = 6;
  const CONCURRENCY = 4;
  const chunks: string[][] = [];
  for (let i = 0; i < texts.length; i += CHUNK) chunks.push(texts.slice(i, i + CHUNK));
  const results: (string | null)[][] = new Array(chunks.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, async () => {
      while (cursor < chunks.length) {
        const idx = cursor++;
        results[idx] = await translateChunk(chunks[idx], target);
      }
    }),
  );
  return results.flat();
}

export async function translateEntries(
  entries: DbNewsEntry[],
  target: "fr" | "en",
): Promise<DbNewsEntry[]> {
  if (entries.length === 0) return entries;
  // All-or-nothing per entry so a card never mixes French and English.
  return translateRecords(
    entries as unknown as Record<string, unknown>[],
    FIELDS as unknown as string[],
    target,
  ) as unknown as Promise<DbNewsEntry[]>;
}

/**
 * Deep translation: walks any JSON-like value and translates user-facing
 * strings while preserving structure. Used for report payloads.
 */
const SKIP_KEYS = new Set([
  "id",
  "year",
  "month",
  "week_number",
  "generated_at",
  "deadline",
  "rank",
  "status",
  "direction",
  "priority",
  "change",
  "current",
  "previous",
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function shouldTranslate(value: string): boolean {
  const v = value.trim();
  if (v.length < 6) return false;
  if (ISO_DATE_RE.test(v)) return false;
  if (/^[\d\s%.,/+\-]+$/.test(v)) return false;
  // Require at least one alphabetical word
  return /[A-Za-zÀ-ÿ]{3,}/.test(v);
}

function collectStrings(value: unknown, key: string | null, out: Set<string>) {
  if (value == null) return;
  if (typeof value === "string") {
    if (key && SKIP_KEYS.has(key)) return;
    if (shouldTranslate(value)) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, key, out);
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectStrings(v, k, out);
    }
  }
}

function applyTranslations<T>(value: T, target: "fr" | "en", key: string | null = null): T {
  if (value == null) return value;
  if (typeof value === "string") {
    if (key && SKIP_KEYS.has(key)) return value;
    if (!shouldTranslate(value)) return value;
    const t = getCached(target, value);
    return (t ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => applyTranslations(v, target, key)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = applyTranslations(v, target, k);
    }
    return out as T;
  }
  return value;
}

export async function translateDeep<T>(value: T, target: "fr" | "en"): Promise<T> {
  if (target === "en" || value == null) return value;
  const need = new Set<string>();
  collectStrings(value, null, need);
  const uniques = Array.from(need).filter((s) => !getCached(target, s));
  if (uniques.length > 0) {
    const translated = await batchTranslate(uniques, target);
    uniques.forEach((src, i) => {
      const t = translated[i];
      if (t) setCached(target, src, t);
    });
  }
  return applyTranslations(value, target);
}