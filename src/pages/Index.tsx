import { useNewsEntries, triggerFetchNews, triggerGenerateReport } from "@/hooks/useFreightData";
import { KPICards } from "@/components/dashboard/KPICards";
import { TopStories } from "@/components/dashboard/TopStories";
import { MoroccoFocus, ComplianceWatchlist } from "@/components/dashboard/QuickPanels";
import { Search, Calendar, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const Dashboard = () => {
  const { data: newsEntries, isLoading } = useNewsEntries({ limit: 50 });
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

  const handleGenerateReports = async () => {
    try {
      await triggerGenerateReport("weekly");
      toast.success("Weekly report generated");
      await triggerGenerateReport("monthly");
      toast.success("Monthly summary generated");
      queryClient.invalidateQueries({ queryKey: ["weekly_reports"] });
      queryClient.invalidateQueries({ queryKey: ["monthly_summaries"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to generate reports");
    }
  };

  const hasData = newsEntries && newsEntries.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
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
          {hasData && (
            <button
              onClick={handleGenerateReports}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-input bg-card text-card-foreground hover:bg-muted transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Generate Reports
            </button>
          )}
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
          <KPICards entries={newsEntries} />
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
