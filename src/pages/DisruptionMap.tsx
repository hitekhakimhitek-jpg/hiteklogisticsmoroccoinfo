import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe2, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type DisruptionType =
  | "port"
  | "strike"
  | "weather"
  | "geopolitical"
  | "customs"
  | "infrastructure"
  | "cyber"
  | "other";
type Severity = "act_now" | "this_week" | "awareness";

type DisruptionEvent = {
  id: string;
  title: string;
  description: string | null;
  disruption_type: DisruptionType;
  severity: Severity;
  location_name: string;
  country_code: string | null;
  latitude: number;
  longitude: number;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  source_url: string | null;
};

const TYPE_LABEL: Record<DisruptionType, string> = {
  port: "Port",
  strike: "Strike",
  weather: "Weather",
  geopolitical: "Geopolitical",
  customs: "Customs",
  infrastructure: "Infrastructure",
  cyber: "Cyber",
  other: "Other",
};

const SEV_COLOR: Record<Severity, string> = {
  act_now: "#ef4444",
  this_week: "#f59e0b",
  awareness: "#3b82f6",
};
const SEV_RADIUS: Record<Severity, number> = {
  act_now: 14,
  this_week: 11,
  awareness: 8,
};

const EMPTY = {
  title: "",
  description: "",
  disruption_type: "port" as DisruptionType,
  severity: "this_week" as Severity,
  location_name: "",
  country_code: "",
  latitude: "",
  longitude: "",
  source_url: "",
  is_active: true,
};

export default function DisruptionMap() {
  const [events, setEvents] = useState<DisruptionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<typeof EMPTY>(EMPTY);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("disruption_events")
      .select("*")
      .order("started_at", { ascending: false });
    if (error) toast.error(error.message);
    setEvents((data || []) as DisruptionEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => events.filter((e) => showInactive || e.is_active),
    [events, showInactive]
  );

  const save = async () => {
    const lat = parseFloat(draft.latitude);
    const lng = parseFloat(draft.longitude);
    if (!draft.title.trim() || !draft.location_name.trim() || isNaN(lat) || isNaN(lng)) {
      toast.error("Title, location, and valid lat/lng are required");
      return;
    }
    const { error } = await supabase.from("disruption_events").insert({
      title: draft.title,
      description: draft.description || null,
      disruption_type: draft.disruption_type,
      severity: draft.severity,
      location_name: draft.location_name,
      country_code: draft.country_code || null,
      latitude: lat,
      longitude: lng,
      source_url: draft.source_url || null,
      is_active: true,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Disruption added");
    setOpen(false);
    setDraft(EMPTY);
    load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from("disruption_events")
      .update({ is_active, ended_at: is_active ? null : new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this disruption?")) return;
    const { error } = await supabase.from("disruption_events").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEvents((es) => es.filter((e) => e.id !== id));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-primary" />
            Disruption Map
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Active geographic disruptions affecting trade lanes and operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show resolved
          </label>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-1" /> Add disruption
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add disruption</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Title (e.g. Tanger Med congestion)"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <Textarea
                  placeholder="Description / impact"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={draft.disruption_type}
                    onValueChange={(v) =>
                      setDraft({ ...draft, disruption_type: v as DisruptionType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as DisruptionType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.severity}
                    onValueChange={(v) =>
                      setDraft({ ...draft, severity: v as Severity })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="act_now">Act now</SelectItem>
                      <SelectItem value="this_week">This week</SelectItem>
                      <SelectItem value="awareness">Awareness</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Location name"
                    value={draft.location_name}
                    onChange={(e) =>
                      setDraft({ ...draft, location_name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Country code (e.g. MA)"
                    value={draft.country_code}
                    onChange={(e) =>
                      setDraft({ ...draft, country_code: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Latitude"
                    value={draft.latitude}
                    onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
                  />
                  <Input
                    placeholder="Longitude"
                    value={draft.longitude}
                    onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
                  />
                </div>
                <Input
                  placeholder="Source URL"
                  value={draft.source_url}
                  onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={save}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="h-[480px] w-full">
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {visible.map((e) => (
              <CircleMarker
                key={e.id}
                center={[Number(e.latitude), Number(e.longitude)]}
                radius={SEV_RADIUS[e.severity]}
                pathOptions={{
                  color: SEV_COLOR[e.severity],
                  fillColor: SEV_COLOR[e.severity],
                  fillOpacity: e.is_active ? 0.55 : 0.2,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1 min-w-[200px]">
                    <div className="font-semibold">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.location_name} · {TYPE_LABEL[e.disruption_type]}
                    </div>
                    {e.description && <p className="text-xs">{e.description}</p>}
                    <div className="text-xs">
                      Since {format(new Date(e.started_at), "MMM d")}
                    </div>
                    {e.source_url && (
                      <a
                        href={e.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-xs underline"
                      >
                        Source
                      </a>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {visible.length} {showInactive ? "events" : "active events"}
        </h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No disruptions logged yet.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {visible.map((e) => (
              <li key={e.id} className="p-3 flex items-center gap-3 flex-wrap">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: SEV_COLOR[e.severity] }}
                />
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium text-sm">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.location_name} · {TYPE_LABEL[e.disruption_type]} ·{" "}
                    {format(new Date(e.started_at), "MMM d, yyyy")}
                  </div>
                </div>
                <Badge variant={e.is_active ? "default" : "outline"}>
                  {e.is_active ? "Active" : "Resolved"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleActive(e.id, !e.is_active)}
                >
                  {e.is_active ? "Mark resolved" : "Reopen"}
                </Button>
                {e.source_url && (
                  <a
                    href={e.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-muted rounded"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => remove(e.id)}
                  className="p-1.5 hover:bg-destructive/10 text-destructive rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}