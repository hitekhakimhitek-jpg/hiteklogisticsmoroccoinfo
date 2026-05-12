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
const CACHE_VERSION = "v2";
function cacheKey(target: "fr" | "en", text: string) {
  return `tr:${CACHE_VERSION}:${target}:${text}`;
}

function getCached(target: "fr" | "en", text: string): string | null {
  try {
    return sessionStorage.getItem(cacheKey(target, text));
  } catch {
    return null;
  }
}

function setCached(target: "fr" | "en", text: string, value: string) {
  try {
    sessionStorage.setItem(cacheKey(target, text), value);
  } catch {
    /* quota — ignore */
  }
}

async function batchTranslate(
  texts: string[],
  target: "fr" | "en",
): Promise<string[]> {
  if (texts.length === 0) return [];
  // Chunk to keep prompts manageable.
  const CHUNK = 40;
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += CHUNK) {
    const slice = texts.slice(i, i + CHUNK);
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: { texts: slice, target },
      });
      if (error) throw error;
      const translations: string[] = Array.isArray(data?.translations)
        ? data.translations
        : slice;
      out.push(...(translations.length === slice.length ? translations : slice));
    } catch (e) {
      console.error("translate batch failed", e);
      out.push(...slice);
    }
  }
  return out;
}

export async function translateEntries(
  entries: DbNewsEntry[],
  target: "fr" | "en",
): Promise<DbNewsEntry[]> {
  if (target === "en" || entries.length === 0) return entries;

  // Collect unique strings needing translation.
  const need = new Set<string>();
  for (const e of entries) {
    for (const f of FIELDS) {
      const v = e[f] as unknown;
      if (typeof v === "string" && v.trim() && !getCached(target, v)) {
        need.add(v);
      }
    }
  }

  const uniques = Array.from(need);
  if (uniques.length > 0) {
    const translated = await batchTranslate(uniques, target);
    uniques.forEach((src, i) => setCached(target, src, translated[i] ?? src));
  }

  // Build translated copies.
  return entries.map((e) => {
    const copy: DbNewsEntry = { ...e };
    for (const f of FIELDS) {
      const v = e[f] as unknown;
      if (typeof v === "string" && v.trim()) {
        const t = getCached(target, v);
        if (t) (copy as Record<string, unknown>)[f as string] = t;
      }
    }
    return copy;
  });
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
  "impact",
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
    uniques.forEach((src, i) => setCached(target, src, translated[i] ?? src));
  }
  return applyTranslations(value, target);
}