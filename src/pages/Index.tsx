import { useNewsEntries, triggerFetchNews, useLastUpdated } from "@/hooks/useFreightData";
import { TopStories } from "@/components/dashboard/TopStories";
import { MoroccoFocus, ComplianceWatchlist } from "@/components/dashboard/QuickPanels";
import { DailyDigest } from "@/components/dashboard/DailyDigest";
import { ChangeSummaryBanner } from "@/components/dashboard/ChangeSummaryBanner";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { RefreshCw, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAppliedSettings, filterBySettings } from "@/hooks/useAppliedSettings";
import { REGION_OPTIONS, isEntryRelevantToRegion, useRegionContext } from "@/contexts/RegionContext";
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
  const { region, setRegion, activeSources } = useRegionContext();

  const newsEntries = useMemo(() => {
    if (!rawEntries) return undefined;
    const filteredBySettings = filterBySettings(rawEntries, appliedSettings);
    return filteredBySettings.filter((e) => isEntryRelevantToRegion(e.region, region));
  }, [rawEntries, appliedSettings, region]);

  const [isFetching, setIsFetching] = useState(false);
  const queryClient = useQueryClient();

  const handleFetchNews = async () => {
    setIsFetching(true);
    try {
      const result = await triggerFetchNews(activeSources);
      if (result.status === "success") {
        toast.success(result.count > 0 ? "Refresh successful" : "Refresh successful: 0 new entries");
      } else if (result.status === "checked_no_new") {
        toast.success("Refresh successful: 0 new entries");
      } else {
        toast.error(result.message || "Refresh failed");
      }
      queryClient.invalidateQueries({ queryKey: ["news_entries"] });
      queryClient.invalidateQueries({ queryKey: ["news_entries_last_updated"] });
    } catch (e) {
      toast.error(e instanceof Error ? `Refresh failed — ${e.message}` : "Refresh failed");
    } finally {
      setIsFetching(false);
    }
  };

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
        <div className="flex items-center gap-2">
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
            onClick={handleFetchNews}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50 font-medium"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isFetching ? "Fetching..." : "Fetch News"}
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
              {region === "all" ? "No intelligence data yet" : "No items for this region"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {region === "all"
                ? 'Click "Fetch News" to pull the latest freight intelligence using AI.'
                : "Try a different region or fetch new data."}
            </p>
          </div>
          <button
            onClick={handleFetchNews}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50 font-medium"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isFetching ? "Fetching..." : "Fetch News Now"}
          </button>
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
