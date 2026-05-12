import { useNewsEntries, useLastUpdated } from "@/hooks/useFreightData";
import { TopStories } from "@/components/dashboard/TopStories";
import { MoroccoFocus, ComplianceWatchlist } from "@/components/dashboard/QuickPanels";
import { DailyDigest } from "@/components/dashboard/DailyDigest";
import { ChangeSummaryBanner } from "@/components/dashboard/ChangeSummaryBanner";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { RefreshCw, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useAppliedSettings, filterBySettings } from "@/hooks/useAppliedSettings";
import { REGION_OPTIONS, isEntryVisibleInRegion, useRegionContext } from "@/contexts/RegionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Dashboard = () => {
  const { data: rawEntries, isLoading } = useNewsEntries({ limit: 50 });
  const { data: lastUpdated } = useLastUpdated();
  const appliedSettings = useAppliedSettings();
  const { region, setRegion } = useRegionContext();
  const { lang, toggle: toggleLang } = useLanguage();

  const newsEntries = useMemo(() => {
    if (!rawEntries) return undefined;
    const filteredBySettings = filterBySettings(rawEntries, appliedSettings);
    return filteredBySettings.filter((e) => isEntryVisibleInRegion(e, region));
  }, [rawEntries, appliedSettings, region]);

  const hasData = newsEntries && newsEntries.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Freight intelligence overview
              {newsEntries && newsEntries.length > 0 && ` · ${newsEntries.length} entries`}
            </p>
          </div>
          <div className="mt-1">
            <FreshnessIndicator lastUpdated={lastUpdated} />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Select value={region} onValueChange={(v) => setRegion(v as typeof region)}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              {REGION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={toggleLang}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
            aria-label="Toggle language"
          >
            {lang === "en" ? "Français" : "English"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasData ? (
        <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center space-y-4">
          <RefreshCw className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {region === "global" ? "No intelligence data yet" : "No items for this region"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {region === "global"
                ? "News is automatically refreshed every day at 8 AM."
                : "Try a different region or fetch new data."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <ChangeSummaryBanner entries={newsEntries} />
          <DailyDigest entries={newsEntries} />
          <TopStories entries={newsEntries} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MoroccoFocus entries={newsEntries} />
            <ComplianceWatchlist entries={newsEntries} />
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
