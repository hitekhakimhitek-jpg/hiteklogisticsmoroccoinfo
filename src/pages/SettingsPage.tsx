import { Settings as SettingsIcon, RotateCcw, Globe, Bell, Database, Rss, Building2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { regionLabels } from "@/types/freight";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

const ALL_REGIONS = Object.keys(regionLabels) as (keyof typeof regionLabels)[];
const ALL_PRIORITIES = ["critical", "important", "informational"] as const;
const ALL_SOURCES = [
  // Tier 1 — International freight & shipping
  "Lloyd's List", "FreightWaves", "The Loadstar", "JOC",
  "Hellenic Shipping News", "Splash247", "gCaptain", "Seatrade Maritime",
  // Tier 2 — Morocco ports & customs
  "ADII Morocco (Customs)", "ADiL (Customs Clearance)", "PortNet Morocco", "Tanger Med", "Tanger Med Port Authority",
  // Tier 2b — Moroccan economic press
  "L'Economiste", "La Vie Éco", "Médias24", "Finances News Hebdo", "Le Matin",
  // Tier 3 — International regulatory bodies
  "IMO", "IATA", "WTO", "WCO", "FIATA", "ICC (Incoterms)", "UNECE", "European Commission",
  // Tier 3b — Morocco finance & fiscal
  "DGI Maroc (Impôts)", "Bank Al-Maghrib", "SGG (Bulletin Officiel)",
  // Tier 4 — IT & Cybersecurity
  "BleepingComputer", "CISA", "The Register", "TechTarget",
  "Microsoft Security", "Google Cloud", "AWS Security",
  "Ars Technica", "OpenAI", "Anthropic",
  // Tier 5 — Market intelligence
  "UNCTAD", "World Bank", "World Bank LPI", "ITC Trade Map", "ITC",
];

const SettingsPage = () => {
  const { settings, updateSettings, resetSettings } = useSettings();

  const toggleRegion = (region: string) => {
    const current = settings.focusRegions;
    updateSettings({
      focusRegions: current.includes(region) ? current.filter((r) => r !== region) : [...current, region],
    });
  };

  const togglePriority = (p: string) => {
    const current = settings.priorityFilter;
    updateSettings({
      priorityFilter: current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    });
  };

  const toggleSource = (s: string) => {
    const current = settings.newsSourcesEnabled;
    updateSettings({
      newsSourcesEnabled: current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    });
  };

  const handleReset = () => {
    resetSettings();
    toast.success("Settings reset to defaults");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 p-2 rounded-lg">
            <SettingsIcon className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure your FreightPulse preferences</p>
          </div>
        </div>
        <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-input bg-card text-card-foreground hover:bg-muted transition-colors">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      {/* Company Name */}
      <Section icon={Building2} title="Organization">
        <label className="text-sm text-muted-foreground">Company / Dashboard Name</label>
        <Input
          value={settings.companyName}
          onChange={(e) => updateSettings({ companyName: e.target.value })}
          className="max-w-xs mt-1"
          placeholder="FreightPulse"
        />
      </Section>

      {/* Focus Regions */}
      <Section icon={Globe} title="Focus Regions">
        <p className="text-sm text-muted-foreground mb-3">Select regions to prioritize in your intelligence feed.</p>
        <div className="flex flex-wrap gap-2">
          {ALL_REGIONS.map((region) => {
            const active = settings.focusRegions.includes(region);
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
                const active = settings.priorityFilter.includes(p);
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
            <Switch checked={settings.notifyOnCritical} onCheckedChange={(v) => updateSettings({ notifyOnCritical: v })} />
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
            <Switch checked={settings.autoFetchNews} onCheckedChange={(v) => updateSettings({ autoFetchNews: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">Auto-generate reports</p>
              <p className="text-xs text-muted-foreground">Generate weekly/monthly reports automatically</p>
            </div>
            <Switch checked={settings.autoGenerateReports} onCheckedChange={(v) => updateSettings({ autoGenerateReports: v })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-card-foreground">Archive retention</p>
              <Badge variant="outline" className="text-xs">{settings.archiveRetention} days</Badge>
            </div>
            <Slider
              value={[settings.archiveRetention]}
              onValueChange={([v]) => updateSettings({ archiveRetention: v })}
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
        <div className="grid grid-cols-2 gap-2">
          {ALL_SOURCES.map((source) => {
            const active = settings.newsSourcesEnabled.includes(source);
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
