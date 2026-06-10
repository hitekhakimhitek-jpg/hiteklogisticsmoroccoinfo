import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Globe2, Plus, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Severity = "low" | "medium" | "high" | "critical";
type Category =
  | "geopolitical" | "conflict" | "strike_labor" | "port_congestion"
  | "weather" | "customs_regulatory" | "accident" | "other";

type Disruption = {
  id: string;
  title: string;
  summary: string | null;
  latitude: number;
  longitude: number;
  location_name: string | null;
  category: Category;
  severity: Severity;
  sources: Array<{ label: string; url: string }>;
  origin: "scraped" | "manual";
  event_date: string;
  created_at: string;
};

const CATEGORY_LABEL: Record<Category, string> = {
  geopolitical: "Geopolitical",
  conflict: "Conflict",
  strike_labor: "Strike / Labor",
  port_congestion: "Port congestion",
  weather: "Weather",
  customs_regulatory: "Customs / Regulatory",
  accident: "Accident",
  other: "Other",
};

const SEV_COLOR: Record<Severity, string> = {
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};
const SEV_RADIUS: Record<Severity, number> = {
  low: 7, medium: 10, high: 13, critical: 16,
};

// Fix the default Leaflet marker icon (Vite asset issue)
const draftIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

type DraftPin = { lat: number; lng: number };

function ClickHandler({ enabled, onPick }: { enabled: boolean; onPick: (p: DraftPin) => void }) {
  useMapEvents({
    click(e) { if (enabled) onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!r.ok) return "";
    const j = await r.json();
    return j.display_name || "";
  } catch { return ""; }
}

export default function DisruptionMap() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Disruption[]>([]);
  const [loading, setLoading] = useState(true);

  // Placement mode + form
  const [placeMode, setPlaceMode] = useState(false);
  const [draft, setDraft] = useState<DraftPin | null>(null);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    location_name: "",
    category: "other" as Category,
    severity: "medium" as Severity,
    event_date: new Date().toISOString().slice(0, 16),
    sources: [{ label: "", url: "" }] as Array<{ label: string; url: string }>,
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("disruptions" as any)
      .select("*")
      .order("event_date", { ascending: false });
    if (error) toast.error(error.message);
    setItems(((data || []) as any[]).map((d) => ({
      ...d,
      sources: Array.isArray(d.sources) ? d.sources : [],
    })) as Disruption[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("disruptions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "disruptions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const visible = items;

  const startPlacement = () => {
    if (!isAdmin) { toast.error("Sign in as the Hitek admin to add disruptions."); return; }
    setPlaceMode(true);
    setDraft(null);
    toast.info("Click on the map to place the disruption.");
  };

  const cancelDraft = () => { setDraft(null); setPlaceMode(false); };

  const onPickPoint = async (p: DraftPin) => {
    setDraft(p);
    setForm((f) => ({ ...f, location_name: f.location_name || "Locating…" }));
    const name = await reverseGeocode(p.lat, p.lng);
    setForm((f) => ({ ...f, location_name: name || `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}` }));
  };

  const save = async () => {
    if (!draft) return;
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const cleanSources = form.sources.filter((s) => s.url.trim()).map((s) => ({
      label: s.label.trim() || "Source", url: s.url.trim(),
    }));
    const { error } = await supabase.from("disruptions" as any).insert({
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      latitude: draft.lat,
      longitude: draft.lng,
      location_name: form.location_name.trim() || null,
      category: form.category,
      severity: form.severity,
      sources: cleanSources,
      origin: "manual",
      event_date: new Date(form.event_date).toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Disruption added");
    setDraft(null);
    setPlaceMode(false);
    setForm({
      title: "", summary: "", location_name: "",
      category: "other", severity: "medium",
      event_date: new Date().toISOString().slice(0, 16),
      sources: [{ label: "", url: "" }],
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this disruption?")) return;
    const { error } = await supabase.from("disruptions" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-primary" /> Disruption Map
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Disruptions affecting global trade lanes. Updated daily.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            placeMode ? (
              <Button variant="secondary" size="sm" onClick={cancelDraft}>
                <X className="w-4 h-4 mr-1" /> Cancel placement
              </Button>
            ) : (
              <Button size="sm" onClick={startPlacement}>
                <Plus className="w-4 h-4 mr-1" /> Add disruption
              </Button>
            )
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {(["critical","high","medium","low"] as Severity[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEV_COLOR[s] }} /> {s}
            </span>
          ))}
        </div>
      </div>

      {placeMode && (
        <div className="rounded-md border border-primary/40 bg-primary/5 text-sm px-3 py-2 text-primary">
          Placement mode — click anywhere on the map to drop a pin.
        </div>
      )}

      <div className={cn("rounded-xl border border-border overflow-hidden bg-card", placeMode && "cursor-crosshair")}>
        <div className="h-[520px] w-full">
          <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap, &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <ClickHandler enabled={placeMode} onPick={onPickPoint} />
            {visible.map((d) => (
              <CircleMarker
                key={d.id}
                center={[Number(d.latitude), Number(d.longitude)]}
                radius={SEV_RADIUS[d.severity]}
                pathOptions={{
                  color: SEV_COLOR[d.severity],
                  fillColor: SEV_COLOR[d.severity],
                  fillOpacity: 0.6,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1 min-w-[220px] max-w-[260px]">
                    <div className="font-semibold">{d.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.location_name} · {format(new Date(d.event_date), "MMM d, yyyy")}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[d.category]}</Badge>
                      <Badge className="text-[10px]" style={{ background: SEV_COLOR[d.severity], color: "white" }}>
                        {d.severity}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">{d.origin}</Badge>
                    </div>
                    {d.summary && <p className="text-xs">{d.summary}</p>}
                    {d.sources.length > 0 && (
                      <div className="text-xs space-y-0.5 pt-1">
                        <div className="font-medium">Sources:</div>
                        {d.sources.map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-primary underline truncate">
                            {s.label || s.url}
                          </a>
                        ))}
                      </div>
                    )}
                    {isAdmin && (
                      <button onClick={() => remove(d.id)} className="text-xs text-destructive hover:underline pt-1">
                        Delete
                      </button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            {draft && (
              <Marker
                position={[draft.lat, draft.lng]}
                draggable
                icon={draftIcon}
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = (e.target as any).getLatLng();
                    onPickPoint({ lat, lng });
                  },
                }}
              />
            )}
          </MapContainer>
        </div>
      </div>

      {/* Form panel when a draft pin is placed */}
      {draft && isAdmin && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">New disruption at {draft.lat.toFixed(3)}, {draft.lng.toFixed(3)}</h2>
            <Button variant="ghost" size="sm" onClick={cancelDraft}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Location name</Label>
              <Input value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as Severity })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Event date</Label>
              <Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Sources</Label>
              {form.sources.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Label"
                    value={s.label}
                    onChange={(e) => {
                      const arr = [...form.sources]; arr[i] = { ...arr[i], label: e.target.value };
                      setForm({ ...form, sources: arr });
                    }}
                  />
                  <Input
                    placeholder="https://…"
                    value={s.url}
                    onChange={(e) => {
                      const arr = [...form.sources]; arr[i] = { ...arr[i], url: e.target.value };
                      setForm({ ...form, sources: arr });
                    }}
                  />
                  {form.sources.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => {
                      const arr = form.sources.filter((_, j) => j !== i);
                      setForm({ ...form, sources: arr });
                    }}><Trash2 className="w-4 h-4" /></Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() =>
                setForm({ ...form, sources: [...form.sources, { label: "", url: "" }] })
              }><Plus className="w-4 h-4 mr-1" /> Add source</Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelDraft}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
            </Button>
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Showing {visible.length} of {items.length} disruptions
        {loading && <span className="ml-2"><Loader2 className="inline w-3 h-3 animate-spin" /></span>}
      </div>
    </div>
  );
}