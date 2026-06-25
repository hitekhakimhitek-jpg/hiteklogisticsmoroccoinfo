import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_CATEGORIES = [
  "geopolitical",
  "conflict",
  "strike_labor",
  "port_congestion",
  "weather",
  "customs_regulatory",
  "accident",
  "other",
];
const ALLOWED_SEVERITY = ["low", "medium", "high", "critical"];

// Map intelligence_items severity → disruptions severity
const INTEL_SEV_MAP: Record<string, string> = {
  act_now: "critical",
  this_week: "high",
  awareness: "medium",
};
// Map intelligence_items department → disruptions category
const INTEL_CAT_MAP: Record<string, string> = {
  operations: "port_congestion",
  compliance: "customs_regulatory",
  finance: "other",
  commercial: "other",
  it: "other",
};

type Extracted = {
  location_name: string;
  category: string;
  severity: string;
  is_disruption: boolean;
  specificity: "specific" | "regional" | "none";
  approx_lat?: number | null;
  approx_lng?: number | null;
};

async function extractLocation(article: { headline: string; summary: string | null; impact?: string | null }): Promise<Extracted | null> {
  const prompt = `You analyze freight & logistics news to plot disruptions on a world map.

RULES for choosing the place:
- If a specific country appears IN THE HEADLINE (e.g. "Morocco", "China", "Belgium"), that country is almost always the right place — pin it there, even if other regions are mentioned in the summary.
- "Morocco as Strategic Pivot" → place is Morocco. "Chinese ro-ro carriers exit Middle East" → place is China. "Belgium airport strike" → place is Belgium (Brussels).
- Pick the place where the disruption ACTUALLY HAPPENS or ORIGINATES, not the destination, the routing path, or an unrelated party.
- If the actor's nationality is the cause, the place is the actor's country, not the region they affect — unless the article clearly names a specific port/strait where the impact occurs.
- If the article is about an organisation (WTO, EU Commission, IMO) with no concrete country named anywhere, set specificity = "none".
- If the article only names a broad region (EU, Middle East, Asia, Sub-Saharan Africa, Latin America) and NO specific country, set specificity = "regional".
- If the article names a specific country, city, port, strait, canal, or border, set specificity = "specific" and use that exact place. Prefer the most precise one (port > city > country).
- Never default to France, the US, or Morocco unless they are actually named in the article.

Return STRICT JSON only (no prose):
{
  "is_disruption": boolean,            // true if it describes a real trade/transport disruption
  "specificity": "specific" | "regional" | "none",
  "location_name": string,             // the chosen place name (port/city/country/strait). Empty string if specificity = "none".
  "category": "geopolitical" | "conflict" | "strike_labor" | "port_congestion" | "weather" | "customs_regulatory" | "accident" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "approx_lat": number | null,         // best-guess latitude in decimal degrees (only used if geocoder fails)
  "approx_lng": number | null
}

Headline: ${article.headline}
Summary: ${article.summary ?? ""}
Impact: ${article.impact ?? ""}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    console.error("LLM extract failed", resp.status, await resp.text());
    return null;
  }
  const data = await resp.json();
  const txt = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(txt) as Extracted;
    if (!ALLOWED_CATEGORIES.includes(parsed.category)) parsed.category = "other";
    if (!ALLOWED_SEVERITY.includes(parsed.severity)) parsed.severity = "medium";
    if (parsed.specificity !== "specific" && parsed.specificity !== "regional") {
      parsed.specificity = "none";
    }
    return parsed;
  } catch (e) {
    console.error("Bad JSON from LLM:", txt);
    return null;
  }
}

async function geocode(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "hitek-info-dashboard/1.0 (contact: info@hitek.ma)" },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const top = arr[0];
    return { lat: parseFloat(top.lat), lng: parseFloat(top.lon) };
  } catch (e) {
    console.error("Geocode error:", e);
    return null;
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function titleSimilarity(a: string, b: string) {
  const toks = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  const A = toks(a), B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let limit = 25;
    try {
      const body = await req.json();
      if (typeof body.limit === "number") limit = Math.min(100, Math.max(1, body.limit));
    } catch { /* */ }

    // Pull recent intelligence items (last 14 days, non-archived) — same source as the dashboard.
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data: entries, error } = await supabase
      .from("intelligence_items")
      .select("id, headline, summary, impact, source_url, source_name, department, severity, created_at")
      .gte("created_at", twoWeeksAgo)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    // CLEANUP: remove scraped pins whose source intel item is no longer on the dashboard.
    // Keep manually-placed pins ("manual" origin) untouched.
    const liveIds = new Set<string>((entries || []).map((e: any) => e.id));
    const { data: allScraped } = await supabase
      .from("disruptions")
      .select("id, source_entry_id, origin")
      .eq("origin", "scraped");
    const orphanIds: string[] = [];
    for (const d of allScraped || []) {
      if (!d.source_entry_id || !liveIds.has(d.source_entry_id)) orphanIds.push(d.id);
    }
    let removed = 0;
    if (orphanIds.length > 0) {
      const { error: delErr } = await supabase.from("disruptions").delete().in("id", orphanIds);
      if (delErr) console.error("cleanup delete err", delErr);
      else removed = orphanIds.length;
    }

    const existingIds = new Set<string>();
    {
      const ids = (entries || []).map((e: any) => e.id);
      if (ids.length > 0) {
        const { data: existing } = await supabase
          .from("disruptions")
          .select("source_entry_id")
          .in("source_entry_id", ids);
        for (const r of existing || []) if (r.source_entry_id) existingIds.add(r.source_entry_id);
      }
    }

    // Recent disruptions for dedupe by location/title
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("disruptions")
      .select("id, title, latitude, longitude, location_name, sources")
      .gte("created_at", since);
    const recentList = (recent || []) as any[];

    let created = 0, skipped = 0, merged = 0, failed = 0;

    for (const entry of entries || []) {
      if (existingIds.has(entry.id)) { skipped++; continue; }
      try {
        const ext = await extractLocation({ headline: entry.headline, summary: entry.summary, impact: (entry as any).impact });
        if (!ext || !ext.is_disruption || !ext.location_name) { skipped++; continue; }

        // Prefer intel item's own severity (mapped). Fall back to LLM-inferred.
        const sev = INTEL_SEV_MAP[(entry as any).severity] || ext.severity;
        const cat = INTEL_CAT_MAP[(entry as any).department] || ext.category;

        // Skip non-specific places unless the item is critical (then a regional pin is OK).
        if (ext.specificity === "none") { skipped++; continue; }
        if (ext.specificity === "regional" && sev !== "critical") { skipped++; continue; }

        let coords = await geocode(ext.location_name);
        if (!coords && ext.approx_lat != null && ext.approx_lng != null) {
          coords = { lat: ext.approx_lat, lng: ext.approx_lng };
        }
        if (!coords) { skipped++; continue; }

        // Dedupe
        const dupe = recentList.find((d) =>
          haversineKm({ lat: d.latitude, lng: d.longitude }, coords!) < 50 &&
          titleSimilarity(d.title, entry.headline) > 0.4
        );

        const sourceItem = { label: entry.source_name || "Source", url: entry.source_url };

        if (dupe) {
          const sources = Array.isArray(dupe.sources) ? dupe.sources : [];
          if (!sources.find((s: any) => s.url === entry.source_url)) sources.push(sourceItem);
          await supabase.from("disruptions").update({
            sources,
            summary: entry.summary || undefined,
          }).eq("id", dupe.id);
          merged++;
        } else {
          const { error: insErr } = await supabase.from("disruptions").insert({
            title: entry.headline,
            summary: entry.summary,
            latitude: coords.lat,
            longitude: coords.lng,
            location_name: ext.location_name,
            category: cat,
            severity: sev,
            sources: [sourceItem],
            origin: "scraped",
            event_date: (entry as any).created_at ? new Date((entry as any).created_at).toISOString() : new Date().toISOString(),
            source_entry_id: entry.id,
          });
          if (insErr) { console.error("insert err", insErr); failed++; }
          else {
            created++;
            recentList.push({ id: "new", title: entry.headline, latitude: coords.lat, longitude: coords.lng, location_name: ext.location_name, sources: [sourceItem] });
          }
        }
      } catch (e) {
        console.error("entry failed", entry.id, e);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, considered: entries?.length || 0, created, merged, skipped, failed, removed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-disruptions error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});