// Best-effort geolocation for intelligence items that the ingestion pipeline
// left without coordinates. Without this the map shows a fraction of the
// dashboard feed, which made the two surfaces disagree.
import { ISO3 } from "@/data/iso3to2";

export type Centroids = Record<string, { lat: number; lng: number }>; // lowercase country name -> point

type Ring = number[][];

function ringCentroid(coords: Ring): { lat: number; lng: number; area: number } {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [x1, y1] = coords[j];
    const [x2, y2] = coords[i];
    const f = x1 * y2 - x2 * y1;
    area += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  area = area / 2;
  if (!area) {
    const [x, y] = coords[0] || [0, 0];
    return { lat: y, lng: x, area: 0 };
  }
  return { lat: cy / (6 * area), lng: cx / (6 * area), area: Math.abs(area) };
}

/** Build a lowercase country-name -> centroid lookup from the map GeoJSON. */
export function buildCentroids(geo: any): Centroids {
  const out: Centroids = {};
  for (const f of geo?.features ?? []) {
    const polys: Ring[][] =
      f.geometry?.type === "Polygon" ? [f.geometry.coordinates]
      : f.geometry?.type === "MultiPolygon" ? f.geometry.coordinates
      : [];
    let best: { lat: number; lng: number; area: number } | null = null;
    for (const p of polys) {
      const c = ringCentroid(p[0] as Ring);
      if (!best || c.area > best.area) best = c;
    }
    if (!best) continue;
    const point = { lat: best.lat, lng: best.lng };
    const names = new Set<string>();
    if (f.properties?.name) names.add(String(f.properties.name).toLowerCase());
    const meta = ISO3[String(f.id || "")];
    if (meta) { names.add(meta.name.toLowerCase()); names.add(meta.fr.toLowerCase()); }
    for (const n of names) out[n] = point;
  }
  // Common aliases used by newsrooms.
  const alias: Record<string, string> = {
    usa: "united states of america", "united states": "united states of america",
    us: "united states of america", uk: "united kingdom", uae: "united arab emirates",
    "south korea": "korea", holland: "netherlands",
  };
  for (const [a, target] of Object.entries(alias)) if (out[target]) out[a] = out[target];
  return out;
}

export type Place = { name: string; aliases: string[]; lat: number; lng: number };

/**
 * Infer coordinates from the item's own fields: named port/airport first,
 * then explicit country, then any country/place named in the text.
 */
export function inferPoint(
  item: {
    country?: string | null;
    port_affected?: string | null;
    airport_affected?: string | null;
    headline?: string | null;
    summary?: string | null;
    affected_tags?: string[] | null;
  },
  places: Place[],
  centroids: Centroids,
): { lat: number; lng: number } | null {
  const named = [item.port_affected, item.airport_affected].filter(Boolean).join(" ").toLowerCase();
  const text = [item.headline, item.summary, (item.affected_tags || []).join(" ")]
    .filter(Boolean).join(" ").toLowerCase();

  const matchPlace = (haystack: string) => {
    if (!haystack) return null;
    for (const p of places) {
      for (const n of [p.name, ...p.aliases]) {
        const k = n.toLowerCase();
        if (k.length >= 4 && haystack.includes(k)) return { lat: p.lat, lng: p.lng };
      }
    }
    return null;
  };

  const byAsset = matchPlace(named);
  if (byAsset) return byAsset;

  const country = (item.country || "").trim().toLowerCase();
  if (country && country !== "global" && centroids[country]) return centroids[country];

  const byText = matchPlace(text);
  if (byText) return byText;

  for (const key of Object.keys(centroids)) {
    if (key.length >= 4 && new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) {
      return centroids[key];
    }
  }
  return null;
}