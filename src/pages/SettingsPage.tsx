import { Settings as SettingsIcon, RotateCcw, Bell, Rss, RefreshCw, ServerCog } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import SettingsLoader from "@/components/SettingsLoader";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useCustomSources } from "@/hooks/useCustomSources";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ALL_PRIORITIES = ["critical", "important", "informational"] as const;
const ALL_SOURCES = [
  "Lloyd's List", "FreightWaves", "The Loadstar", "JOC",
  "Hellenic Shipping News", "Splash247", "gCaptain", "Seatrade Maritime",
  "ADII Morocco (Customs)", "ADiL (Customs Clearance)", "PortNet Morocco", "Tanger Med", "Tanger Med Port Authority",
  "L'Economiste", "La Vie Éco", "Médias24", "Finances News Hebdo", "Le Matin",
  "Hespress",
  "IMO", "IATA", "WTO", "WCO", "FIATA", "ICC (Incoterms)", "UNECE", "European Commission",
  "DGI Maroc (Impôts)", "Bank Al-Maghrib", "SGG (Bulletin Officiel)",
  "BleepingComputer", "CISA", "The Register", "TechTarget",
  "Microsoft Security", "Google Cloud", "AWS Security",
  "Ars Technica", "OpenAI", "Anthropic",
  "MIT Technology Review", "VentureBeat", "Hugging Face Blog", "Computer Weekly",
  "IT Security Guru", "SD Times", "ACM TechNews",
  "UNCTAD", "World Bank", "World Bank LPI", "ITC Trade Map", "ITC",
  "Voice of the Independent",
  "SEKO Logistics", "Kuehne+Nagel", "Hillebrand Gori", "Maersk", "MSC", "CMA CGM", "Hapag-Lloyd",
  "The Maritime Executive", "ICIS", "Supply Chain Brain", "Logistics Management", "Baird Maritime", "MarineLink",
  "project44", "Everstream Analytics", "Resilinc",
];

const SettingsPage = () => {
  const { pending, updatePending, applySettings, resetSettings, isUpdating, isDirty } = useSettings();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { sources: customSources, add: addSource, remove: removeSource } = useCustomSources(isAdmin);
  const { data: quality } = useQuery({
    queryKey: ["admin-quality-health"],
    enabled: isAdmin,
    queryFn: async () => {
      const [runs, health, pipeline] = await Promise.all([
        supabase.from("ingestion_runs").select("id,status,started_at,finished_at,candidates_found,candidates_accepted,inserted_count,enriched_count,error_message").order("started_at", { ascending: false }).limit(5),
        supabase.from("source_health").select("source_name,status,last_attempt_at,last_success_at,items_found_last_run,consecutive_failures,last_error").order("status").order("source_name").limit(100),
        supabase.from("pipeline_control").select("pipeline,status,last_started_at,last_success_at,last_stage,paused_reason").order("pipeline"),
      ]);
      const error = runs.error || health.error || pipeline.error;
      if (error) throw error;
      return { runs: runs.data || [], health: health.data || [], pipeline: pipeline.data || [] };
    },
    refetchInterval: 60_000,
  });
  const { data: technologies = [] } = useQuery({
    queryKey: ["hitek-technologies"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("hitek_technologies").select("id,name,aliases,usage_status,notes").order("name");
      if (error) throw error;
      return data || [];
    },
  });
  const updateTechnology = useMutation({
    mutationFn: async ({ id, usage_status }: { id: string; usage_status: "used" | "not_used" | "unknown" }) => {
      const { error } = await supabase.from("hitek_technologies").update({ usage_status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hitek-technologies"] }),
  });

  const togglePriority = (p: string) => {
    const current = pending.priorityFilter;
    updatePending({
      priorityFilter: current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    });
  };

  const toggleSource = (s: string) => {
    const current = pending.newsSourcesEnabled;
    updatePending({
      newsSourcesEnabled: current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    });
  };

  const [newSource, setNewSource] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const addCustomSource = async () => {
    const name = newSource.trim();
    const homepage = newSourceUrl.trim();
    if (!name) return;
    if (!/^https?:\/\/\S+\.\S+/i.test(homepage)) {
      toast.error("Enter the source website (https://…) so it can be scraped.");
      return;
    }
    const existing = [...ALL_SOURCES, ...customSources.map((s) => s.name)];
    if (existing.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error("That source is already in the list.");
      return;
    }
    try {
      await addSource.mutateAsync({ name, homepage });
      setNewSource("");
      setNewSourceUrl("");
      toast.success(`${name} added — it will be scraped on the next daily run.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleReset = () => {
    resetSettings();
    toast.success("Settings reset to defaults");
  };

  const handleApply = async () => {
    await applySettings();
    toast.success("Settings applied — dashboard updated");
  };

  return (
    <>
      {isUpdating && <SettingsLoader />}
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-secondary/10 p-2 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Configure your FreightPulse preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              disabled={isUpdating || !isDirty}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
              {isUpdating ? "Updating…" : "Update"}
            </button>
            <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-input bg-card text-card-foreground hover:bg-muted transition-colors">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>

        {isDirty && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning font-medium">
            You have unsaved changes. Click "Update" to apply them to the dashboard.
          </div>
        )}

        {/* Priority Filter */}
        <Section icon={Bell} title="Notifications & Priority">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Show entries by priority level.</p>
              <div className="flex flex-wrap gap-2">
                {ALL_PRIORITIES.map((p) => {
                  const active = pending.priorityFilter.includes(p);
                  const colors: Record<string, string> = {
                    critical: active ? "bg-destructive text-destructive-foreground border-destructive" : "",
                    important: active ? "bg-warning text-warning-foreground border-warning" : "",
                    informational: active ? "bg-success text-success-foreground border-success" : "",
                  };
                  return (
                    <button key={p} onClick={() => togglePriority(p)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors font-medium capitalize ${
                        active ? colors[p] : "bg-card text-muted-foreground border-border hover:border-secondary/50"
                      }`}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-card-foreground">Alert on critical events</p>
                <p className="text-xs text-muted-foreground">Show toast notifications for critical news</p>
              </div>
              <Switch checked={pending.notifyOnCritical} onCheckedChange={(v) => updatePending({ notifyOnCritical: v })} />
            </div>
          </div>
        </Section>

        {/* Data Sources */}
        <Section icon={Rss} title="Data Sources">
          <p className="text-sm text-muted-foreground mb-3">Enable/disable intelligence sources, or add your own.</p>

          {isAdmin ? (
            <>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <Input
                  placeholder="Source name (e.g. ShippingWatch)"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                />
                <Input
                  placeholder="https://shippingwatch.com"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSource(); } }}
                />
                <Button onClick={addCustomSource} size="sm" disabled={addSource.isPending}>
                  <Plus className="w-4 h-4 mr-1" /> Add source
                </Button>
              </div>

              {customSources.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Your custom sources</p>
                  <div className="flex flex-wrap gap-2">
                    {customSources.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-secondary/10 border border-secondary/30 text-card-foreground">
                        {s.name}
                        <button onClick={() => removeSource.mutate(s.id)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground mb-4">Sign in with a Hitek account to add your own sources.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_SOURCES.map((source) => {
              const active = pending.newsSourcesEnabled.includes(source);
              return (
                <button key={source} onClick={() => toggleSource(source)}
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left ${
                    active
                      ? "bg-secondary/10 text-card-foreground border-secondary/30"
                      : "bg-card text-muted-foreground border-border hover:border-secondary/30 line-through opacity-50"
                  }`}>
                  {source}
                </button>
              );
            })}
          </div>
        </Section>

        {isAdmin && (
          <Section icon={ServerCog} title="Hitek Technologies / Systems">
            <p className="text-sm text-muted-foreground">Applicability used by cybersecurity relevance and urgency decisions.</p>
            <Table>
              <TableHeader><TableRow><TableHead>Technology</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {technologies.map((technology) => (
                  <TableRow key={technology.id}>
                    <TableCell className="font-medium">{technology.name}</TableCell>
                    <TableCell>
                      <select
                        value={technology.usage_status}
                        onChange={(event) => updateTechnology.mutate({ id: technology.id, usage_status: event.target.value as "used" | "not_used" | "unknown" })}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                        aria-label={`Usage status for ${technology.name}`}
                      >
                        <option value="used">Used</option>
                        <option value="not_used">Not used</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        )}

        {isAdmin && (
          <Section icon={RefreshCw} title="Data Quality & Pipeline Health">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Metric label="Sources healthy" value={quality?.health.filter((s) => s.status === "healthy").length ?? 0} />
              <Metric label="Sources degraded" value={quality?.health.filter((s) => s.status !== "healthy").length ?? 0} />
              <Metric label="Last run inserted" value={quality?.runs[0]?.inserted_count ?? 0} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Found</TableHead>
                  <TableHead>Last attempt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(quality?.health ?? []).filter((s) => s.status !== "healthy").slice(0, 12).map((source) => (
                  <TableRow key={source.source_name}>
                    <TableCell className="font-medium">{source.source_name}</TableCell>
                    <TableCell className="capitalize">{source.status}</TableCell>
                    <TableCell className="text-right tabular-nums">{source.items_found_last_run}</TableCell>
                    <TableCell className="text-muted-foreground">{source.last_attempt_at ? new Date(source.last_attempt_at).toLocaleString() : "Never"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        )}
      </div>
    </>
  );
};

function Section({ icon: Icon, title, children }: { icon: typeof SettingsIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border card-elevated p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-secondary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default SettingsPage;
