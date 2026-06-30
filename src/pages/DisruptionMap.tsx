import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Popup, Marker } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
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
const SEV_RADIUS: Record<Severity, number> = {
  act_now: 16, this_week: 13, awareness: 10,
};

function pinIcon(sev: Severity) {
  const size = SEV_RADIUS[sev] * 2;
  const color = SEV_COLOR[sev];
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px ${color};opacity:0.85;"></div>`,
  });
}
export default function DisruptionMap() {
  const { lang } = useLanguage();
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="h-[560px] w-full">
          <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors, &copy; Wikimedia'
              url="https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png"
            />
            <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={35}>
              {items.map((d) => (
                <Marker
                  key={d.id}
                  position={[Number(d.latitude), Number(d.longitude)]}
                  icon={pinIcon(d.severity)}
                >
                  <Popup>
                    <div className="text-sm space-y-1 min-w-[230px] max-w-[280px]">
                      <div className="font-semibold leading-tight">{d.headline}</div>
                      <div className="text-xs text-muted-foreground">
                        {[d.port_affected, d.airport_affected, d.country].filter(Boolean).join(" · ")}
                        {(d.event_date || d.publication_date) && (
                          <> · {format(new Date(d.event_date || d.publication_date!), "MMM d, yyyy")}</>
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {d.category && (
                          <Badge variant="outline" className="text-[10px] capitalize">{d.category}</Badge>
                        )}
                        <Badge className="text-[10px]" style={{ background: SEV_COLOR[d.severity], color: "white" }}>
                          {SEV_LABEL[d.severity]}
                        </Badge>
                      </div>
                      {d.summary && <p className="text-xs">{d.summary}</p>}
                      <div className="flex gap-3 pt-1 text-xs">
                        <Link to={`/news/${d.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                          {lang === "fr" ? "Voir l'article" : "Open article"} <ExternalLink className="w-3 h-3" />
                        </Link>
                        {d.source_url && (
                          <a href={d.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline truncate">
                            {d.source_name || "Source"}
                          </a>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground">{lang === "fr" ? "Chargement…" : "Loading…"}</p>
      )}
    </div>
  );
}
