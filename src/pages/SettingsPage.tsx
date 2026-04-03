import { Settings as SettingsIcon, RotateCcw, Globe, Bell, Database, Rss, RefreshCw } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { regionLabels } from "@/types/freight";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import SettingsLoader from "@/components/SettingsLoader";

const ALL_REGIONS = Object.keys(regionLabels) as (keyof typeof regionLabels)[];
const ALL_PRIORITIES = ["critical", "important", "informational"] as const;
const ALL_SOURCES = [
  "Lloyd's List", "FreightWaves", "The Loadstar", "JOC",
  "Hellenic Shipping News", "Splash247", "gCaptain", "Seatrade Maritime",
  "ADII Morocco (Customs)", "ADiL (Customs Clearance)", "PortNet Morocco", "Tanger Med", "Tanger Med Port Authority",
  "L'Economiste", "La Vie Éco", "Médias24", "Finances News Hebdo", "Le Matin",
  "IMO", "IATA", "WTO", "WCO", "FIATA", "ICC (Incoterms)", "UNECE", "European Commission",
  "DGI Maroc (Impôts)", "Bank Al-Maghrib", "SGG (Bulletin Officiel)",
  "BleepingComputer", "CISA", "The Register", "TechTarget",
  "Microsoft Security", "Google Cloud", "AWS Security",
  "Ars Technica", "OpenAI", "Anthropic",
  "UNCTAD", "World Bank", "World Bank LPI", "ITC Trade Map", "ITC",
];

const SettingsPage = () => {
  const { pending, updatePending, applySettings, resetSettings, isUpdating, isDirty } = useSettings();

  const toggleRegion = (region: string) => {
    const current = pending.focusRegions;
    updatePending({
      focusRegions: current.includes(region) ? current.filter((r) => r !== region) : [...current, region],
    });
  };

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

        {/* Focus Regions */}
        <Section icon={Globe} title="Focus Regions">
          <p className="text-sm text-muted-foreground mb-3">Select regions to prioritize in your intelligence feed.</p>
          <div className="flex flex-wrap gap-2">
            {ALL_REGIONS.map((region) => {
              const active = pending.focusRegions.includes(region);
              return (
                <button key={region} onClick={() => toggleRegion(region)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors font-medium ${
                    active
                      ? "bg-secondary text-secondary-foreground border-secondary"
                      : "bg-card text-muted-foreground border-border hover:border-secondary/50"
                  }`}>
                  {regionLabels[region]}
                </button>
              );
            })}
          </div>
        </Section>

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

        {/* Automation */}
        <Section icon={Database} title="Automation & Retention">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-card-foreground">Auto-fetch news (daily)</p>
                <p className="text-xs text-muted-foreground">Automatically pull intelligence via scheduled jobs</p>
              </div>
              <Switch checked={pending.autoFetchNews} onCheckedChange={(v) => updatePending({ autoFetchNews: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-card-foreground">Auto-generate reports</p>
                <p className="text-xs text-muted-foreground">Generate weekly/monthly reports automatically</p>
              </div>
              <Switch checked={pending.autoGenerateReports} onCheckedChange={(v) => updatePending({ autoGenerateReports: v })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-card-foreground">Archive retention</p>
                <Badge variant="outline" className="text-xs">{pending.archiveRetention} days</Badge>
              </div>
              <Slider
                value={[pending.archiveRetention]}
                onValueChange={([v]) => updatePending({ archiveRetention: v })}
                min={30}
                max={365}
                step={30}
                className="max-w-sm"
              />
              <div className="flex justify-between max-w-sm text-[10px] text-muted-foreground mt-1">
                <span>30 days</span><span>1 year</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Data Sources */}
        <Section icon={Rss} title="Data Sources">
          <p className="text-sm text-muted-foreground mb-3">Enable/disable intelligence sources.</p>
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

export default SettingsPage;
