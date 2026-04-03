import { useNewsEntries, triggerFetchNews } from "@/hooks/useFreightData";

import { TopStories } from "@/components/dashboard/TopStories";
import { MoroccoFocus, ComplianceWatchlist } from "@/components/dashboard/QuickPanels";
import { RefreshCw, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAppliedSettings, filterBySettings } from "@/hooks/useAppliedSettings";

const Dashboard = () => {
  const { data: rawEntries, isLoading } = useNewsEntries({ limit: 50 });
  const appliedSettings = useAppliedSettings();
  const newsEntries = useMemo(
    () => (rawEntries ? filterBySettings(rawEntries, appliedSettings) : undefined),
    [rawEntries, appliedSettings]
  );
  const [isFetching, setIsFetching] = useState(false);
  const queryClient = useQueryClient();

  const handleFetchNews = async () => {
    setIsFetching(true);
    try {
      const result = await triggerFetchNews();
      toast.success(`Fetched ${result.count} new intelligence entries`);
      queryClient.invalidateQueries({ queryKey: ["news_entries"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch news");
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
          <p className="text-sm text-muted-foreground">
            Freight intelligence overview
            {newsEntries && newsEntries.length > 0 && ` · ${newsEntries.length} entries`}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <h2 className="text-lg font-semibold text-foreground mb-1">No intelligence data yet</h2>
            <p className="text-sm text-muted-foreground">
              Click "Fetch News" to pull the latest freight intelligence using AI.
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
