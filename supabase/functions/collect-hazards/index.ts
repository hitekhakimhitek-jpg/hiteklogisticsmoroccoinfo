// Weather / Natural Hazard Intelligence Collector.
//
// Official meteorological and hazard authorities do NOT publish news articles.
// They publish warnings, advisories, cyclone bulletins, CAP alerts and raw
// text products. This collector understands those formats directly, so a JTWC
// or NMC warning is detected without waiting for a newspaper to write about it.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireHitekAdmin } from "../_shared/auth.ts";
import { collectSource, CollectedItem } from "../_shared/collect.ts";
import { recordSourceRun, serviceClient } from "../_shared/health.ts";
import {
  Exposure,
  extractCoordinates,
  extractMaxWind,
  exposureFromPoints,
  exposureFromText,
  loadInfrastructure,
  mergeExposure,
} from "../_shared/geo.ts";
import { HAZARD_SOURCE_META, isDue, syncSourceRegistry } from "../_shared/registry.ts";

interface HazardSource {
  name: string;
  type: "weather" | "hazard";
  tier: 1 | 2;
  urls: string[];
  homepage?: string;
  language?: string;
  hazard?: string;
}

// Official RSMCs / TCWCs / national authorities and global hazard platforms.
const HAZARD_SOURCES: HazardSource[] = [
  {
    name: "JTWC",
    type: "weather", tier: 1, hazard: "tropical_cyclone",
    urls: ["https://www.metoc.navy.mil/jtwc/rss/jtwc.rss?tropical"],
    homepage: "https://www.metoc.navy.mil/jtwc/jtwc.html",
  },
  {
    name: "NOAA National Hurricane Center",
    type: "weather", tier: 1, hazard: "tropical_cyclone",
    urls: [
      "https://www.nhc.noaa.gov/index-at.xml",
      "https://www.nhc.noaa.gov/index-ep.xml",
    ],
    homepage: "https://www.nhc.noaa.gov/",
  },
  {
    name: "NOAA NWS Alerts",
    type: "weather", tier: 1,
    urls: ["https://api.weather.gov/alerts/active?severity=Extreme,Severe&limit=60"],
    homepage: "https://alerts.weather.gov/",
  },
  {
    name: "WMO Severe Weather Information Centre",
    type: "weather", tier: 1,
    urls: [
      "https://severeweather.wmo.int/feed/rss_en.xml",
      "https://severeweather.wmo.int/rss.xml",
    ],
    homepage: "https://severeweather.wmo.int/",
  },
  {
    name: "JMA / RSMC Tokyo",
    type: "weather", tier: 1, hazard: "tropical_cyclone", language: "ja",
    urls: [
      "https://www.data.jma.go.jp/developer/xml/feed/extra.xml",
      "https://www.jma.go.jp/bosai/typhoon/data/targetTc.json",
    ],
    homepage: "https://www.jma.go.jp/bosai/map.html",
  },
  {
    name: "China NMC",
    type: "weather", tier: 1, language: "zh",
    urls: [
      "https://www.nmc.cn/rest/findAlarm?pageNo=1&pageSize=40",
      "https://www.nmc.cn/publish/alarm.html",
    ],
    homepage: "https://www.nmc.cn/",
  },
  {
    name: "PAGASA",
    type: "weather", tier: 1, hazard: "tropical_cyclone",
    urls: [
      "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin",
      "https://www.pagasa.dost.gov.ph/regional-forecast/ncrprsd",
    ],
    homepage: "https://www.pagasa.dost.gov.ph/",
  },
  {
    name: "Hong Kong Observatory",
    type: "weather", tier: 1,
    urls: ["https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml"],
    homepage: "https://www.hko.gov.hk/",
  },
  {
    name: "Taiwan CWA",
    type: "weather", tier: 1, language: "zh",
    urls: [
      "https://www.cwa.gov.tw/rss/Data/cwa_warning.xml",
      "https://www.cwa.gov.tw/V8/E/index.html",
    ],
    homepage: "https://www.cwa.gov.tw/",
  },
  {
    name: "India Meteorological Department",
    type: "weather", tier: 1,
    urls: [
      "https://mausam.imd.gov.in/responsive/rss/allIndiaWeatherWarning.xml",
      "https://mausam.imd.gov.in/",
    ],
    homepage: "https://mausam.imd.gov.in/",
  },
  {
    name: "Australian Bureau of Meteorology",
    type: "weather", tier: 1,
    urls: [
      "http://www.bom.gov.au/fwo/IDZ00056.warnings_land_sea.xml",
      "https://www.bom.gov.au/australia/warnings/",
    ],
    homepage: "https://www.bom.gov.au/",
  },
  {
    name: "Meteo-France Vigilance",
    type: "weather", tier: 1, language: "fr",
    urls: [
      "https://vigilance.meteofrance.fr/fr",
      "https://meteofrance.com/avertissements",
    ],
    homepage: "https://vigilance.meteofrance.fr/",
  },
  {
    name: "GDACS",
    type: "hazard", tier: 1,
    urls: ["https://www.gdacs.org/xml/rss.xml"],
    homepage: "https://www.gdacs.org/",
  },
  {
    name: "USGS Earthquakes",
    type: "hazard", tier: 1, hazard: "earthquake",
    urls: ["https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"],
    homepage: "https://earthquake.usgs.gov/",
  },
  {
    name: "Copernicus EMS Rapid Mapping",
    type: "hazard", tier: 1,
    urls: ["https://rapidmapping.emergency.copernicus.eu/backend/api/activations/?format=json"],
    homepage: "https://emergency.copernicus.eu/",
  },
];

const HAZARD_KEYWORDS =
  /(typhoon|hurricane|cyclone|tropical storm|tropical depression|storm surge|gale|flood|inundation|landslide|earthquake|tsunami|volcan|wildfire|blizzard|snowstorm|heavy rain|torrential|severe wind|drought|heat ?wave|marine warning|warning|advisory|alert|bulletin|台风|台風|颱風|暴雨|洪水|地震|警报|警報)/i;

function hazardTypeOf(text: string, fallback?: string): string {
  const t = text.toLowerCase();
  if (/typhoon|hurricane|cyclone|tropical storm|tropical depression|台风|台風|颱風/.test(t)) return "tropical_cyclone";
  if (/earthquake|seismic|地震/.test(t)) return "earthquake";
  if (/tsunami/.test(t)) return "tsunami";
  if (/volcan/.test(t)) return "volcano";
  if (/flood|inundation|洪水|暴雨/.test(t)) return "flood";
  if (/wildfire|bushfire|forest fire/.test(t)) return "wildfire";
  if (/snow|blizzard|ice storm/.test(t)) return "winter_storm";
  if (/drought|low water|water level/.test(t)) return "drought";
  return fallback ?? "severe_weather";
}

function geoOf(item: CollectedItem): { lat: number | null; lon: number | null; track: Array<{ lat: number; lon: number }> } {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  // GeoJSON geometry (USGS, some CAP-derived feeds)
  const geom = raw.geometry as { coordinates?: number[] } | undefined;
  if (geom?.coordinates && geom.coordinates.length >= 2) {
    return { lat: geom.coordinates[1], lon: geom.coordinates[0], track: [] };
  }
  const blob = `${item.title} ${item.summary ?? ""} ${item.body ?? ""} ${JSON.stringify(raw).slice(0, 4000)}`;
  // georss / GDACS style point
  const pt = blob.match(/<georss:point>\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
  if (pt) return { lat: parseFloat(pt[1]), lon: parseFloat(pt[2]), track: [] };
  const coords = extractCoordinates(blob);
  if (coords.length) return { lat: coords[0].lat, lon: coords[0].lon, track: coords.slice(1) };
  return { lat: null, lon: null, track: [] };
}

function hashUrl(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(36)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireHitekAdmin(req);
  if (denied) return denied;

  const db = serviceClient();
  const runId = crypto.randomUUID();
  const infra = await loadInfrastructure(db);
  const report: Array<Record<string, unknown>> = [];
  let inserted = 0;

  let onlySource: string | null = null;
  let force = false;
  try {
    const body = await req.json();
    if (typeof body?.source === "string") onlySource = body.source;
    force = body?.force === true;
  } catch { /* no body */ }

  await syncSourceRegistry(db, HAZARD_SOURCE_META);

  // Respect each source's own polling interval instead of hammering
  // everything at the same frequency.
  const { data: healthRows } = await db.from("source_health").select("source_name, last_attempt_at");
  const lastAttempt = new Map((healthRows ?? []).map((h) => [h.source_name as string, h.last_attempt_at as string | null]));
  const intervals = new Map(HAZARD_SOURCE_META.map((m) => [m.name, m.poll_interval_minutes]));

  const sources = (onlySource
    ? HAZARD_SOURCES.filter((s) => s.name.toLowerCase() === onlySource!.toLowerCase())
    : HAZARD_SOURCES
  ).filter((s) => force || onlySource || isDue(lastAttempt.get(s.name), intervals.get(s.name) ?? 30));

  for (const src of sources) {
    const startedAt = Date.now();
    let outcome;
    try {
      outcome = await collectSource(src.name, src.urls, { homepage: src.homepage });
    } catch (e) {
      outcome = { items: [], method: "none", httpStatus: 0, pagesRequested: src.urls.length, error: (e as Error).message };
    }

    // Keep only genuinely hazard-shaped records, but never on "supply chain"
    // wording — exposure is decided later by the risk engine.
    const items = outcome.items.filter((i) =>
      HAZARD_KEYWORDS.test(`${i.title} ${i.summary ?? ""}`)
    );

    let newCount = 0, dupes = 0;
    let latestPub: string | null = null;

    for (const item of items.slice(0, 40)) {
      if (item.publishedAt && (!latestPub || item.publishedAt > latestPub)) latestPub = item.publishedAt;
      const blob = `${item.title} ${item.summary ?? ""} ${item.body ?? ""}`;
      const { lat, lon, track } = geoOf(item);
      const points = [
        ...(lat !== null && lon !== null ? [{ lat, lon, extraKm: 250 }] : []),
        ...track.map((p) => ({ ...p, extraKm: 250 })),
      ];
      let exposure: Exposure = exposureFromPoints(infra, points);
      exposure = mergeExposure(exposure, exposureFromText(infra, blob));

      const url = item.url || `${src.homepage}#${hashUrl(item.title)}`;
      const { error, data } = await db.from("raw_items").upsert(
        {
          source_name: src.name,
          source_type: src.type,
          fetch_method: outcome.method,
          url,
          url_hash: hashUrl(`${url}|${item.title}`),
          original_title: item.title.slice(0, 500),
          original_summary: (item.summary ?? "").slice(0, 4000),
          body: (item.body ?? "").slice(0, 12000),
          source_language: src.language ?? "en",
          published_at: item.publishedAt,
          countries: exposure.countries,
          latitude: lat,
          longitude: lon,
          payload: {
            tier: src.tier,
            hazard_type: hazardTypeOf(blob, src.hazard),
            forecast_track: track,
            maximum_wind: extractMaxWind(blob),
            exposure: {
              ports: exposure.ports,
              airports: exposure.airports,
              lanes: exposure.lanes,
              industrial: exposure.industrial,
              max_importance: exposure.maxImportance,
              max_hitek_relevance: exposure.maxHitekRelevance,
            },
          },
        },
        { onConflict: "source_name,url_hash", ignoreDuplicates: false },
      ).select("id, created_at");
      if (error) continue;
      const row = data?.[0];
      if (row && Math.abs(new Date(row.created_at).getTime() - Date.now()) < 60_000) newCount++;
      else dupes++;
    }
    inserted += newCount;

    await recordSourceRun(db, runId, {
      sourceName: src.name,
      sourceUrl: src.homepage ?? src.urls[0],
      sourceType: src.type,
      fetchMethod: outcome.method,
      httpStatus: outcome.httpStatus,
      pagesRequested: outcome.pagesRequested,
      itemsDiscovered: items.length,
      itemsNew: newCount,
      itemsDuplicates: dupes,
      itemsRejected: outcome.items.length - items.length,
      latestPublicationAt: latestPub,
      startedAt,
      error: outcome.error ?? (outcome.items.length > 0 && items.length === 0 ? "records parsed but none hazard-shaped" : null),
    });

    report.push({
      source: src.name,
      method: outcome.method,
      http: outcome.httpStatus,
      discovered: outcome.items.length,
      hazards: items.length,
      new: newCount,
      error: outcome.error ?? null,
    });
  }

  return new Response(JSON.stringify({ run_id: runId, inserted, sources: report }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
