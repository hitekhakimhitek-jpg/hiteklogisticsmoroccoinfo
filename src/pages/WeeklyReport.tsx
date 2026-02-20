import { useState } from "react";
import { FileBarChart, Download, Mail, ChevronDown, AlertTriangle, ShieldCheck, TrendingUp, CloudRain, Newspaper, Flag, RefreshCw, Loader2 } from "lucide-react";
import { useNewsEntries, useWeeklyReports, triggerGenerateReport } from "@/hooks/useFreightData";
import { priorityConfig, categoryLabels, regionLabels, categoryColors } from "@/types/freight";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { DbNewsEntry } from "@/hooks/useFreightData";

const sectionConfig = [
  { key: "critical", filter: (e: DbNewsEntry) => e.priority === "critical", title: "Critical Alerts", subtitle: "Sanctions, blocked lanes, strikes, major disruptions", icon: AlertTriangle, accent: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  { key: "regulatory", filter: (e: DbNewsEntry) => e.category === "regulation" || e.category === "compliance", title: "Regulatory & Compliance", subtitle: "New laws, customs changes, tariffs, certifications", icon: ShieldCheck, accent: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/20" },
  { key: "trade", filter: (e: DbNewsEntry) => e.category === "trade" || e.category === "market", title: "Trade & Market Updates", subtitle: "Rate changes, carrier updates, new routes", icon: TrendingUp, accent: "text-success", bg: "bg-success/10", border: "border-success/20" },
  { key: "disruptions", filter: (e: DbNewsEntry) => e.category === "weather" || e.category === "port", title: "Disruptions & Weather", subtitle: "Port congestion, weather warnings, lane closures", icon: CloudRain, accent: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
  { key: "general", filter: (e: DbNewsEntry) => e.category === "general", title: "General Industry News", subtitle: "Mergers, tech, sustainability, trends", icon: Newspaper, accent: "text-muted-foreground", bg: "bg-muted", border: "border-muted" },
  { key: "morocco", filter: (e: DbNewsEntry) => e.region === "morocco", title: "Morocco Spotlight", subtitle: "Tanger Med, customs, local port changes", icon: Flag, accent: "text-success", bg: "bg-success/10", border: "border-success/20" },
];

function ReportEntry({ entry }: { entry: DbNewsEntry }) {
  const pConfig = priorityConfig[entry.priority];
  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-2">
      <div className="flex items-start gap-2">
        <Badge className={`${pConfig.className} text-[10px] px-2 py-0.5 shrink-0`}>{pConfig.label}</Badge>
        <h4 className="text-sm font-semibold text-card-foreground">{entry.headline}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{entry.summary}</p>
      {entry.impact_assessment && (
        <div className="bg-muted/50 rounded-md p-3 space-y-1">
          <p className="text-xs font-medium text-foreground">📌 What this means for your operations:</p>
          <p className="text-xs text-muted-foreground">{entry.impact_assessment}</p>
        </div>
      )}
      {entry.action_required && entry.suggested_action && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 space-y-1">
          <p className="text-xs font-semibold text-destructive">⚠ Action Required</p>
          <p className="text-xs text-card-foreground">{entry.suggested_action}</p>
        </div>
      )}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
        <span className={`px-2 py-0.5 rounded-full border ${categoryColors[entry.category]}`}>{categoryLabels[entry.category]}</span>
        <span className="px-2 py-0.5 rounded-full bg-muted">{regionLabels[entry.region]}</span>
        <span className="ml-auto">Source: {entry.source_name}</span>
      </div>
    </div>
  );
}

const WeeklyReport = () => {
  const { data: reports, isLoading: reportsLoading } = useWeeklyReports();
  const { data: allNews, isLoading: newsLoading } = useNewsEntries({});
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const isLoading = reportsLoading || newsLoading;
  const hasReport = reports && reports.length > 0;
  const latestReport = hasReport ? reports[0] : null;

  // Group news by current week
  const now = new Date();
  const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weekNews = allNews?.filter((e) => e.week_number === weekNumber && e.year === now.getFullYear()) || [];

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await triggerGenerateReport("weekly");
      toast.success("Weekly report generated!");
      queryClient.invalidateQueries({ queryKey: ["weekly_reports"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 p-2 rounded-lg">
            <FileBarChart className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Weekly Intelligence Report</h1>
            <p className="text-sm text-muted-foreground">Week {weekNumber}, {now.getFullYear()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerate} disabled={isGenerating || !allNews?.length}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50 font-medium">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isGenerating ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : weekNews.length === 0 ? (
        <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center">
          <p className="text-muted-foreground">No news entries for this week. Fetch news from the Dashboard first.</p>
        </div>
      ) : (
        <>
          {latestReport && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</h2>
              <p className="text-sm text-card-foreground leading-relaxed">{latestReport.executive_summary}</p>
            </motion.div>
          )}

          <div className="space-y-4">
            {sectionConfig.map((section) => {
              const entries = weekNews.filter(section.filter);
              return (
                <div key={section.key} className="space-y-3">
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${section.bg} border ${section.border}`}>
                    <section.icon className={`w-5 h-5 ${section.accent}`} />
                    <div>
                      <h3 className={`text-sm font-bold ${section.accent}`}>{section.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{section.subtitle}</p>
                    </div>
                    <span className="ml-auto text-xs font-medium text-muted-foreground">{entries.length} items</span>
                  </div>
                  {entries.length > 0 ? (
                    <div className="space-y-2 pl-2">{entries.map((e) => <ReportEntry key={e.id} entry={e} />)}</div>
                  ) : (
                    <p className="text-xs text-muted-foreground pl-2 italic">No items this week.</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default WeeklyReport;
