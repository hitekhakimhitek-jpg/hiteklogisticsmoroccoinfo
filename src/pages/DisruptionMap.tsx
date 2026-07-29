import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Globe2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateDeep } from "@/lib/translateEntries";
import { SEO } from "@/components/SEO";

// Single source of truth: read intelligence_items directly (same feed as the Dashboard).
type Severity = "act_now" | "this_week" | "awareness";

type MapItem = {
  id: string;
  headline: string;
  summary: string | null;
  latitude: number;
  longitude: number;
  country: string | null;
  port_affected: string | null;
  airport_affected: string | null;
  severity: Severity;
  department: string | null;
  category: string | null;
  event_date: string | null;
  publication_date: string | null;
  created_at: string;
  source_url: string | null;
  source_name: string | null;
};

const SEV_COLOR: Record<Severity, string> = {
  act_now: "#ef4444",   // red
  this_week: "#f97316", // orange
  awareness: "#22c55e", // green
};
const SEV_LABEL: Record<Severity, string> = {
  act_now: "Critical",
  this_week: "Important",
  awareness: "To be aware of",
};
const SEV_SCALE: Record<Severity, number> = { act_now: 11, this_week: 9, awareness: 7 };

// Load the Google Maps JS API once, using the browser key + async loader.
let mapsLoaderPromise: Promise<typeof google> | null = null;
function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window !== "undefined" && (window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }
  if (mapsLoaderPromise) return mapsLoaderPromise;
  mapsLoaderPromise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) {
      reject(new Error("Google Maps browser key missing"));
      return;
    }
    (window as any).__initHitekMap = () => resolve((window as any).google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initHitekMap${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return mapsLoaderPromise;
}

export default function DisruptionMap() {
  const { lang } = useLanguage();
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  const load = async () => {
    setLoading(true);
    // Rolling 14-day window, matches the dashboard.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("intelligence_items")
      .select("id, headline, summary, latitude, longitude, country, port_affected, airport_affected, severity, department, category, event_date, publication_date, created_at, source_url, source_name")
      .gte("created_at", fourteenDaysAgo)
      .neq("status", "archived")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    let rows = ((data || []) as any[]) as MapItem[];
    if (lang === "fr" && rows.length > 0) {
      try {
        const payload = rows.map((r) => ({ id: r.id, headline: r.headline, summary: r.summary }));
        const translated = await translateDeep(payload, "fr");
        const byId = new Map(translated.map((t: any) => [t.id, t]));
        rows = rows.map((r) => {
          const t = byId.get(r.id) as any;
          return t ? { ...r, headline: t.headline ?? r.headline, summary: t.summary ?? r.summary } : r;
        });
      } catch (e) { console.error("map translate failed", e); }
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("intel-items-rt-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "intelligence_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Initialize the Google Map once the container is mounted.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapDivRef.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });
        infoRef.current = new google.maps.InfoWindow();
      })
      .catch((e) => console.error("Google Maps init failed", e));
    return () => { cancelled = true; };
  }, []);

  // Sync markers with items.
  useEffect(() => {
    const google = (window as any).google;
    if (!google?.maps || !mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    items.forEach((d) => {
      const marker = new google.maps.Marker({
        position: { lat: Number(d.latitude), lng: Number(d.longitude) },
        map: mapRef.current,
        title: d.headline,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: SEV_SCALE[d.severity],
          fillColor: SEV_COLOR[d.severity],
          fillOpacity: 0.85,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        const dateStr = (d.event_date || d.publication_date)
          ? format(new Date(d.event_date || d.publication_date!), "MMM d, yyyy")
          : "";
        const meta = [d.port_affected, d.airport_affected, d.country].filter(Boolean).join(" · ");
        const openLabel = lang === "fr" ? "Voir l'article" : "Open article";
        const html = `
          <div style="font-family:inherit;min-width:230px;max-width:280px;font-size:13px;line-height:1.4;">
            <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(d.headline)}</div>
            <div style="color:#6b7280;font-size:11px;margin-bottom:6px;">${escapeHtml(meta)}${meta && dateStr ? " · " : ""}${escapeHtml(dateStr)}</div>
            <div style="margin-bottom:6px;">
              ${d.category ? `<span style="display:inline-block;padding:1px 6px;border:1px solid #e5e7eb;border-radius:999px;font-size:10px;text-transform:capitalize;margin-right:4px;">${escapeHtml(d.category)}</span>` : ""}
              <span style="display:inline-block;padding:1px 6px;border-radius:999px;font-size:10px;background:${SEV_COLOR[d.severity]};color:#fff;">${SEV_LABEL[d.severity]}</span>
            </div>
            ${d.summary ? `<p style="margin:0 0 6px 0;font-size:12px;">${escapeHtml(d.summary)}</p>` : ""}
            <div style="display:flex;gap:12px;font-size:12px;">
              <a href="/news/${d.id}" style="color:hsl(var(--primary,220 90% 56%));text-decoration:none;">${openLabel} →</a>
              ${d.source_url ? `<a href="${escapeAttr(d.source_url)}" target="_blank" rel="noreferrer" style="color:#6b7280;text-decoration:none;">${escapeHtml(d.source_name || "Source")}</a>` : ""}
            </div>
          </div>`;
        infoRef.current.setContent(html);
        infoRef.current.open({ anchor: marker, map: mapRef.current });
      });
      markersRef.current.push(marker);
    });
  }, [items, lang]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <SEO
        title="Disruption Map"
        description="Live geocoded map of freight and logistics disruptions affecting Morocco and global trade lanes, refreshed daily."
      />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-primary" />
            {lang === "fr" ? "Carte des perturbations" : "Disruption Map"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "fr"
              ? `Perturbations affectant les chaînes globales — synchronisé avec le tableau de bord (${items.length} éléments).`
              : `Disruptions affecting global trade — synced with the dashboard feed (${items.length} items).`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {(["act_now","this_week","awareness"] as Severity[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEV_COLOR[s] }} /> {SEV_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div ref={mapDivRef} className="h-[560px] w-full" />
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground">{lang === "fr" ? "Chargement…" : "Loading…"}</p>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
