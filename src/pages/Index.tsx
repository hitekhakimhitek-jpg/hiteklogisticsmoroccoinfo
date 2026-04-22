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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RegionKey = "all" | "morocco" | "europe" | "asia" | "americas" | "africa" | "middle_east" | "global";

const REGION_OPTIONS: { value: RegionKey; label: string }[] = [
  { value: "all", label: "All regions" },
  { value: "morocco", label: "Morocco" },
  { value: "europe", label: "Europe" },
  { value: "africa", label: "Africa" },
  { value: "middle_east", label: "Middle East" },
  { value: "asia", label: "Asia" },
  { value: "americas", label: "Americas" },
  { value: "global", label: "Global" },
];

/**
 * Internal mapping: when the user picks a region on the dashboard,
 * we forward an explicit list of sources to the scraping function so it
 * focuses on the relevant outlets. This is intentionally invisible to the user.
 */
const REGION_SOURCE_HINTS: Partial<Record<RegionKey, string[]>> = {
  morocco: [
    "ADII Morocco (Customs)", "ADiL (Customs Clearance)", "PortNet Morocco",
    "Tanger Med", "Tanger Med Port Authority",
    "L'Economiste", "La Vie Éco", "Médias24", "Finances News Hebdo", "Le Matin",
    "DGI Maroc (Impôts)", "Bank Al-Maghrib", "SGG (Bulletin Officiel)",
    "Voice of the Independent",
  ],
  europe: [
    "Lloyd's List", "The Loadstar", "Hellenic Shipping News",
    "European Commission", "UNECE", "Splash247",
  ],
  global: [
    "FreightWaves", "JOC", "Lloyd's List", "Splash247", "gCaptain",
    "Seatrade Maritime", "IMO", "IATA", "WTO", "WCO", "FIATA", "ICC (Incoterms)",
    "UNCTAD", "World Bank",
  ],
};

const Dashboard = () => {
  const { data: rawEntries, isLoading } = useNewsEntries({ limit: 50 });
  const { data: lastUpdated } = useLastUpdated();
  const appliedSettings = useAppliedSettings();
  const [region, setRegion] = useState<RegionKey>("all");

  const newsEntries = useMemo(() => {
    if (!rawEntries) return undefined;
    const filteredBySettings = filterBySettings(rawEntries, appliedSettings);
    if (region === "all") return filteredBySettings;
    return filteredBySettings.filter((e) => e.region === region);
  }, [rawEntries, appliedSettings, region]);

  const [isFetching, setIsFetching] = useState(false);
  const queryClient = useQueryClient();

  const handleFetchNews = async () => {
    setIsFetching(true);
    try {
      // Prefer region-targeted sources when available; otherwise fall back to all enabled sources.
      const sources =
        region !== "all" && REGION_SOURCE_HINTS[region]
          ? REGION_SOURCE_HINTS[region]!
          : appliedSettings.newsSourcesEnabled;
      const result = await triggerFetchNews(sources);
      toast.success(`Fetched ${result.count} new intelligence entries`);
      queryClient.invalidateQueries({ queryKey: ["news_entries"] });
      queryClient.invalidateQueries({ queryKey: ["news_entries_last_updated"] });
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
          <Select value={region} onValueChange={(v) => setRegion(v as RegionKey)}>
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
