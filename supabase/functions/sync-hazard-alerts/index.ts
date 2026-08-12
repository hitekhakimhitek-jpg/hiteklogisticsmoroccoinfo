import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireHitekAdmin } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// GDACS public alert feed (no API key). Covers cyclones, floods, earthquakes,
// volcanoes and wildfires worldwide, with coordinates and an alert level.
const GDACS_RSS = "https://www.gdacs.org/xml/rss.xml";

// Major logistics hubs used to decide whether a hazard actually threatens
// freight operations. Radius in km.
const HUBS: Array<{ name: string; country: string; lat: number; lon: number; radiusKm: number }> = [
  { name: "Tanger Med", country: "Morocco", lat: 35.8838, lon: -5.4986, radiusKm: 250 },
  { name: "Casablanca", country: "Morocco", lat: 33.6035, lon: -7.6167, radiusKm: 250 },
  { name: "Agadir", country: "Morocco", lat: 30.4202, lon: -9.6000, radiusKm: 200 },
  { name: "Algeciras", country: "Spain", lat: 36.1408, lon: -5.4526, radiusKm: 200 },
  { name: "Valencia", country: "Spain", lat: 39.4460, lon: -0.3170, radiusKm: 200 },
  { name: "Barcelona", country: "Spain", lat: 41.3510, lon: 2.1730, radiusKm: 200 },
  { name: "Rotterdam", country: "Netherlands", lat: 51.9490, lon: 4.1400, radiusKm: 200 },
  { name: "Antwerp", country: "Belgium", lat: 51.2600, lon: 4.4000, radiusKm: 200 },
  { name: "Hamburg", country: "Germany", lat: 53.5400, lon: 9.9300, radiusKm: 200 },
  { name: "Le Havre", country: "France", lat: 49.4830, lon: 0.1200, radiusKm: 200 },
  { name: "Marseille", country: "France", lat: 43.3400, lon: 5.3400, radiusKm: 200 },
  { name: "Genoa", country: "Italy", lat: 44.4050, lon: 8.9200, radiusKm: 200 },
  { name: "Piraeus", country: "Greece", lat: 37.9420, lon: 23.6460, radiusKm: 200 },
  { name: "Suez Canal", country: "Egypt", lat: 30.5230, lon: 32.3450, radiusKm: 250 },
  { name: "Jebel Ali", country: "United Arab Emirates", lat: 25.0110, lon: 55.0610, radiusKm: 250 },
  { name: "Singapore", country: "Singapore", lat: 1.2650, lon: 103.8200, radiusKm: 250 },
  { name: "Shanghai", country: "China", lat: 31.2300, lon: 121.4700, radiusKm: 250 },
  { name: "Ningbo", country: "China", lat: 29.8700, lon: 121.5400, radiusKm: 250 },
  { name: "Shenzhen", country: "China", lat: 22.5400, lon: 114.0600, radiusKm: 250 },
  { name: "Hong Kong", country: "China", lat: 22.3200, lon: 114.1700, radiusKm: 250 },
  { name: "Busan", country: "South Korea", lat: 35.1000, lon: 129.0400, radiusKm: 250 },
  { name: "Tokyo / Yokohama", country: "Japan", lat: 35.4500, lon: 139.6400, radiusKm: 250 },
  { name: "Kaohsiung", country: "Taiwan", lat: 22.6100, lon: 120.2800, radiusKm: 250 },
  { name: "Port Klang", country: "Malaysia", lat: 3.0000, lon: 101.3900, radiusKm: 250 },
  { name: "Colombo", country: "Sri Lanka", lat: 6.9500, lon: 79.8400, radiusKm: 250 },
  { name: "Nhava Sheva", country: "India", lat: 18.9490, lon: 72.9500, radiusKm: 250 },
  { name: "Los Angeles / Long Beach", country: "United States", lat: 33.7400, lon: -118.2600, radiusKm: 250 },
  { name: "New York / New Jersey", country: "United States", lat: 40.6700, lon: -74.0400, radiusKm: 250 },
  { name: "Savannah", country: "United States", lat: 32.1300, lon: -81.1400, radiusKm: 250 },
  { name: "Houston", country: "United States", lat: 29.7300, lon: -95.2700, radiusKm: 250 },
  { name: "Panama Canal", country: "Panama", lat: 9.0800, lon: -79.6800, radiusKm: 200 },
  { name: "Santos", country: "Brazil", lat: -23.9600, lon: -46.3300, radiusKm: 250 },
  { name: "Durban", country: "South Africa", lat: -29.8700, lon: 31.0300, radiusKm: 250 },
  { name: "Lagos (Apapa)", country: "Nigeria", lat: 6.4400, lon: 3.3600, radiusKm: 250 },
];

type Hazard = {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  lat: number;
  lon: number;
  alertLevel: string;
  eventType: string;
};

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGdacs(xml: string): Hazard[] {
  const items = xml.split(/<item>/i).slice(1).map((s) => s.split(/<\/item>/i)[0]);
  const out: Hazard[] = [];
  for (const block of items) {
    const lat = parseFloat(tag(block, "geo:lat") || tag(block, "gdacs:latitude"));
    const lon = parseFloat(tag(block, "geo:long") || tag(block, "gdacs:longitude"));
    const link = tag(block, "link");
    const title = tag(block, "title");
    if (!title || !link || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    out.push({
      title,
      link,
      description: tag(block, "description").slice(0, 1200),
      pubDate: tag(block, "pubDate") || null,
      lat,
      lon,
      alertLevel: (tag(block, "gdacs:alertlevel") || "Green").toLowerCase(),
      eventType: (tag(block, "gdacs:eventtype") || "").toUpperCase(),
    });
  }
  return out;
}

// IT items can never be critical; hazards are operations items, so only the
// GDACS red level maps to act_now.
function severityFor(level: string, distanceKm: number): "act_now" | "this_week" | "awareness" {
  if (level === "red" && distanceKm <= 150) return "act_now";
  if (level === "red" || level === "orange") return "this_week";
  return "awareness";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authError = await requireHitekAdmin(req, corsHeaders);
  if (authError) return authError;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;

  try {
    const res = await fetch(GDACS_RSS, { headers: { "User-Agent": "HitekIntel/1.0" } });
    if (!res.ok) throw new Error(`GDACS feed returned ${res.status}`);
    const hazards = parseGdacs(await res.text());

    let inserted = 0;
    let skipped = 0;

    for (const h of hazards) {
      const published = h.pubDate ? new Date(h.pubDate) : null;
      const pubMs = published && !Number.isNaN(published.getTime()) ? published.getTime() : Date.now();
      if (pubMs < cutoff) { skipped++; continue; }

      // Only keep hazards that threaten a known logistics hub.
      let nearest: { hub: typeof HUBS[number]; km: number } | null = null;
      for (const hub of HUBS) {
        const km = haversineKm(h.lat, h.lon, hub.lat, hub.lon);
        if (km <= hub.radiusKm && (!nearest || km < nearest.km)) nearest = { hub, km };
      }
      if (!nearest) { skipped++; continue; }

      // Deduplicate on the source link.
      const { data: existing } = await supabase
        .from("intelligence_items")
        .select("id")
        .eq("source_url", h.link)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      const severity = severityFor(h.alertLevel, nearest.km);
      const pubDate = new Date(pubMs).toISOString().slice(0, 10);
      const distance = Math.round(nearest.km);

      const { error } = await supabase.from("intelligence_items").insert({
        headline: h.title,
        summary: h.description || h.title,
        impact: `Hazard detected ~${distance} km from ${nearest.hub.name}. Possible port closures, vessel diversions and inland transport delays.`,
        why_it_matters_to_hitek: `${nearest.hub.name} (${nearest.hub.country}) is a logistics hub used on Hitek trade lanes; a ${h.eventType || "natural"} hazard nearby can disrupt sailings, terminal operations and customs clearance.`,
        action_required: severity === "act_now" ? "Check bookings routed via this hub and notify affected customers." : "",
        suggested_action: severity === "act_now" ? "Check bookings routed via this hub and notify affected customers." : null,
        action_required_bool: severity === "act_now",
        department: "operations",
        severity,
        time_to_impact: severity === "act_now" ? "today" : "this_week",
        category: "weather",
        source_name: "GDACS",
        source_url: h.link,
        status: "new",
        verification_status: "verified",
        publication_date: pubDate,
        event_date: pubDate,
        latitude: h.lat,
        longitude: h.lon,
        country: nearest.hub.country,
        port_affected: nearest.hub.name,
        transport_modes: ["sea"],
        affected_tags: ["hazard", "weather", nearest.hub.name],
        language: "en",
      });
      if (error) {
        console.error("[hazard] insert failed:", error.message);
        skipped++;
      } else {
        inserted++;
      }
    }

    console.log(`[sync-hazard-alerts] parsed=${hazards.length} inserted=${inserted} skipped=${skipped}`);
    return new Response(JSON.stringify({ success: true, parsed: hazards.length, inserted, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sync-hazard-alerts] failed:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});