// Geographic logistics risk engine.
//
// Matches hazard positions / forecast tracks / free text against the
// logistics_infrastructure registry (ports, airports, chokepoints, industrial
// regions, corridors) so an event can be scored on real exposure rather than
// on whether the source happened to say the words "supply chain".

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface Infra {
  name: string;
  kind: string;
  country: string | null;
  latitude: number;
  longitude: number;
  radius_km: number;
  importance: number;
  hitek_relevance: number;
  aliases: string[];
}

export interface Exposure {
  matched: Infra[];
  ports: string[];
  airports: string[];
  lanes: string[];
  industrial: string[];
  countries: string[];
  maxImportance: number;
  maxHitekRelevance: number;
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function loadInfrastructure(db: SupabaseClient): Promise<Infra[]> {
  const { data, error } = await db
    .from("logistics_infrastructure")
    .select("name, kind, country, latitude, longitude, radius_km, importance, hitek_relevance, aliases");
  if (error) throw new Error(`infrastructure load failed: ${error.message}`);
  return (data ?? []) as Infra[];
}

function emptyExposure(): Exposure {
  return { matched: [], ports: [], airports: [], lanes: [], industrial: [], countries: [], maxImportance: 0, maxHitekRelevance: 0 };
}

function summarize(matched: Infra[]): Exposure {
  const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];
  return {
    matched,
    ports: uniq(matched.filter((m) => m.kind === "port" || m.kind === "terminal").map((m) => m.name)),
    airports: uniq(matched.filter((m) => m.kind === "airport").map((m) => m.name)),
    lanes: uniq(matched.filter((m) => ["chokepoint", "canal", "strait", "lane", "corridor"].includes(m.kind)).map((m) => m.name)),
    industrial: uniq(matched.filter((m) => ["industrial", "manufacturing", "border", "rail", "road"].includes(m.kind)).map((m) => m.name)),
    countries: uniq(matched.map((m) => m.country ?? "")),
    maxImportance: matched.reduce((n, m) => Math.max(n, m.importance), 0),
    maxHitekRelevance: matched.reduce((n, m) => Math.max(n, m.hitek_relevance), 0),
  };
}

/** Exposure from one or more geographic points (position + forecast track). */
export function exposureFromPoints(
  infra: Infra[],
  points: Array<{ lat: number; lon: number; extraKm?: number }>,
): Exposure {
  if (!points.length) return emptyExposure();
  const hit = new Map<string, Infra>();
  for (const p of points) {
    for (const i of infra) {
      const limit = i.radius_km + (p.extraKm ?? 0);
      if (haversineKm(p.lat, p.lon, i.latitude, i.longitude) <= limit) {
        hit.set(`${i.kind}:${i.name}`, i);
      }
    }
  }
  return summarize([...hit.values()]);
}

/** Exposure inferred from names/aliases appearing in the text. */
export function exposureFromText(infra: Infra[], text: string): Exposure {
  const hay = ` ${text.toLowerCase()} `;
  const hit: Infra[] = [];
  for (const i of infra) {
    const needles = [i.name, ...i.aliases].map((n) => n.toLowerCase()).filter((n) => n.length >= 4);
    if (needles.some((n) => hay.includes(` ${n}`) || hay.includes(`${n} `) || hay.includes(n))) hit.push(i);
  }
  return summarize(hit);
}

export function mergeExposure(a: Exposure, b: Exposure): Exposure {
  const map = new Map<string, Infra>();
  for (const i of [...a.matched, ...b.matched]) map.set(`${i.kind}:${i.name}`, i);
  return summarize([...map.values()]);
}

/** Extract lat/lon pairs mentioned in a meteorological bulletin. */
export function extractCoordinates(text: string): Array<{ lat: number; lon: number }> {
  const out: Array<{ lat: number; lon: number }> = [];
  // 13.4N 125.7E   /   13.4 N 125.7 E
  for (const m of text.matchAll(/(\d{1,3}(?:\.\d+)?)\s*([NS])[,\s]+(\d{1,3}(?:\.\d+)?)\s*([EW])/gi)) {
    const lat = parseFloat(m[1]) * (m[2].toUpperCase() === "S" ? -1 : 1);
    const lon = parseFloat(m[3]) * (m[4].toUpperCase() === "W" ? -1 : 1);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) out.push({ lat, lon });
    if (out.length >= 25) break;
  }
  return out;
}

/** Max sustained wind (knots) mentioned in a bulletin. */
export function extractMaxWind(text: string): number | null {
  let max: number | null = null;
  for (const m of text.matchAll(/(\d{2,3})\s*(?:kts?|knots|km\/h|kph|mph)/gi)) {
    let v = parseInt(m[1], 10);
    if (/km\/h|kph/i.test(m[0])) v = Math.round(v / 1.852);
    if (/mph/i.test(m[0])) v = Math.round(v / 1.151);
    if (v > 20 && v < 220 && (max === null || v > max)) max = v;
  }
  return max;
}
