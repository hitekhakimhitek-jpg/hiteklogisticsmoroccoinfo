import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Globe2 } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateDeep } from "@/lib/translateEntries";
import { SEO } from "@/components/SEO";
import { passesFeedFilter } from "@/hooks/useIntelligenceItems";
import { ISO3 } from "@/data/iso3to2";
import { CalendarDays, X, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
  verification_status: string | null;
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

type Holiday = {
  holiday_date: string;
  local_name: string;
  name_en: string;
  affects_operations: boolean;
};

export default function DisruptionMap() {
  const { lang } = useLanguage();
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState<{ a3: string; a2: string; name: string } | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);

  const load = async () => {
    setLoading(true);
    // Same current, verified article window as the dashboard feed.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("intelligence_items")
      .select("id, headline, summary, latitude, longitude, country, port_affected, airport_affected, severity, department, category, event_date, publication_date, created_at, source_url, source_name, verification_status")
      .gte("created_at", fourteenDaysAgo)
      .neq("status", "archived")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    let rows = (((data || []) as any[]) as MapItem[]).filter(passesFeedFilter);
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

  // Initialize the Leaflet map once the container is mounted. Uses Carto
  // Voyager tiles — no API key, English labels, Google-Maps-like look.
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true,
      scrollWheelZoom: true,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
      }
    ).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Country boundary layer: clicking a country opens its holiday calendar.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || countryLayerRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/countries.geo.json");
        const geo = await res.json();
        if (cancelled || !mapRef.current) return;
        const layer = L.geoJSON(geo, {
          style: {
            color: "#94a3b8",
            weight: 0.5,
            fillColor: "#0ea5e9",
            fillOpacity: 0,
          },
          onEachFeature: (feature, lyr) => {
            lyr.on("mouseover", () => (lyr as L.Path).setStyle({ fillOpacity: 0.12 }));
            lyr.on("mouseout", () => (lyr as L.Path).setStyle({ fillOpacity: 0 }));
            lyr.on("click", () => {
              const a3 = String((feature as any).id || "");
              const meta = ISO3[a3];
              if (!meta) return;
              setCountry({
                a3,
                a2: meta.a2,
                name: lang === "fr" ? meta.fr : meta.name,
              });
            });
          },
        }).addTo(mapRef.current);
        // Markers must stay clickable above the boundary layer.
        layer.bringToBack();
        countryLayerRef.current = layer;
      } catch (e) {
        console.error("country layer failed", e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Load holidays for the selected country.
  useEffect(() => {
    if (!country) { setHolidays([]); return; }
    let cancelled = false;
    setHolidaysLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("sync-holidays", {
          body: { countryCode: country.a2 },
        });
        if (error) throw error;
        if (!cancelled) setHolidays(((data as any)?.holidays ?? []) as Holiday[]);
      } catch (e) {
        console.error("holiday fetch failed", e);
        if (!cancelled) setHolidays([]);
      } finally {
        if (!cancelled) setHolidaysLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [country]);

  // Sync markers with items.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Group items whose coordinates are effectively the same spot (~1km).
    // Any group with 2+ items renders as a single numbered marker that
    // expands into a list of headlines on click.
    const groups = new Map<string, MapItem[]>();
    for (const d of items) {
      const key = `${Number(d.latitude).toFixed(2)},${Number(d.longitude).toFixed(2)}`;
      const arr = groups.get(key);
      if (arr) arr.push(d); else groups.set(key, [d]);
    }

    const openLabel = lang === "fr" ? "Voir l'article" : "Open article";

    const singleHtml = (d: MapItem) => {
      const dateStr = (d.publication_date || d.event_date)
        ? format(new Date(d.publication_date || d.event_date!), "MMM d, yyyy")
        : "";
      const meta = [d.port_affected, d.airport_affected, d.country].filter(Boolean).join(" · ");
      return `
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
    };

    const groupHtml = (list: MapItem[]) => {
      const loc = [list[0].port_affected, list[0].airport_affected, list[0].country].filter(Boolean).join(" · ");
      // Highest severity first (act_now < this_week < awareness).
      const order = { act_now: 0, this_week: 1, awareness: 2 } as const;
      const sorted = [...list].sort((a, b) => order[a.severity] - order[b.severity]);
      const rows = sorted.map((d) => {
        const dateStr = (d.publication_date || d.event_date)
          ? format(new Date(d.publication_date || d.event_date!), "MMM d, yyyy")
          : "";
        return `
          <a href="/news/${d.id}" style="display:block;padding:8px 0;border-top:1px solid #f1f5f9;text-decoration:none;color:inherit;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${SEV_COLOR[d.severity]};display:inline-block;flex:none;"></span>
              <span style="font-weight:600;font-size:12px;line-height:1.3;">${escapeHtml(d.headline)}</span>
            </div>
            ${dateStr ? `<div style="color:#6b7280;font-size:10px;margin-left:14px;">${escapeHtml(dateStr)}</div>` : ""}
          </a>`;
      }).join("");
      const title = lang === "fr"
        ? `${list.length} événements à cet endroit`
        : `${list.length} events at this location`;
      return `
        <div style="font-family:inherit;min-width:260px;max-width:300px;font-size:13px;line-height:1.4;">
          <div style="font-weight:600;margin-bottom:2px;">${escapeHtml(title)}</div>
          ${loc ? `<div style="color:#6b7280;font-size:11px;margin-bottom:4px;">${escapeHtml(loc)}</div>` : ""}
          ${rows}
        </div>`;
    };

    groups.forEach((list) => {
      if (list.length === 1) {
        const d = list[0];
        const r = SEV_SCALE[d.severity];
        const dotSize = r * 2 + 4;
        const dotIcon = L.divIcon({
          className: "hitek-dot-marker",
          html: `<div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${SEV_COLOR[d.severity]};opacity:0.9;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>`,
          iconSize: [dotSize, dotSize],
          iconAnchor: [dotSize / 2, dotSize / 2],
        });
        const marker = L.marker([Number(d.latitude), Number(d.longitude)], {
          icon: dotIcon,
          title: d.headline,
        }).addTo(map);
        marker.bindPopup(singleHtml(d), { minWidth: 240, maxWidth: 300 });
        markersRef.current.push(marker);
        return;
      }

      // Cluster marker: numbered pin colored by the highest severity in the group.
      const order = { act_now: 0, this_week: 1, awareness: 2 } as const;
      const topSev = [...list].sort((a, b) => order[a.severity] - order[b.severity])[0].severity;
      const color = SEV_COLOR[topSev];
      const size = 34;
      const clusterIcon = L.divIcon({
        className: "hitek-cluster-marker",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.92;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 14px Inter,system-ui,sans-serif;">${list.length}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker(
        [Number(list[0].latitude), Number(list[0].longitude)],
        { icon: clusterIcon, title: `${list.length} events at this location`, zIndexOffset: 1000 }
      ).addTo(map);
      marker.bindPopup(groupHtml(list), { minWidth: 260, maxWidth: 320 });
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
              ? `Perturbations affectant les chaînes globales — synchronisé avec le tableau de bord (${items.length} éléments). Cliquez sur un pays pour voir ses jours fériés.`
              : `Disruptions affecting global trade — synced with the dashboard feed (${items.length} items). Click a country to see its upcoming public holidays.`}
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

      <div className="relative rounded-xl border border-border overflow-hidden bg-card">
        <div ref={mapDivRef} className="h-[560px] w-full" />

      {country && (
        <div className="absolute top-3 right-3 z-[1000] w-[min(360px,calc(100%-1.5rem))] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {lang === "fr" ? `Jours fériés — ${country.name}` : `Public holidays — ${country.name}`}
            </h2>
            <button
              onClick={() => setCountry(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={lang === "fr" ? "Fermer" : "Close"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {holidaysLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {lang === "fr" ? "Chargement des jours fériés…" : "Loading holidays…"}
            </p>
          ) : holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {lang === "fr"
                ? "Aucun jour férié disponible pour les 120 prochains jours."
                : "No holidays available for the next 120 days."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {holidays.map((h) => (
                <li key={`${h.holiday_date}-${h.name_en}`} className="py-2 flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground text-xs">
                    {format(new Date(h.holiday_date), "EEE, MMM d")}
                  </span>
                  <span className="font-medium leading-tight">{lang === "fr" ? h.local_name : h.name_en}</span>
                  {h.affects_operations && (
                    <span className="ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                      {lang === "fr" ? "Fermé" : "Closed"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
