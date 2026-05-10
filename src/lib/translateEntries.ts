import { supabase } from "@/integrations/supabase/client";
import type { DbNewsEntry } from "@/hooks/useFreightData";

const FIELDS: (keyof DbNewsEntry)[] = [
  "headline",
  "summary",
  "impact_assessment",
  "suggested_action",
  "full_content",
];

function cacheKey(target: "fr" | "en", text: string) {
  return `tr:${target}:${text}`;
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