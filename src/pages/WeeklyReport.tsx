import { useState } from "react";
import { FileBarChart, AlertTriangle, ShieldCheck, TrendingUp, CloudRain, Newspaper, Flag, RefreshCw, Loader2, Shield, Eye, Lightbulb, Target } from "lucide-react";
import { useNewsEntries, useWeeklyReports, triggerGenerateReport } from "@/hooks/useFreightData";
import { priorityConfig, categoryLabels, regionLabels, categoryColors } from "@/types/freight";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

const priorityBadgeClass: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  important: "bg-warning text-warning-foreground",
  monitor: "bg-secondary text-secondary-foreground",
};

function RiskGauge({ score }: { score: number }) {
  const color = score >= 70 ? "text-destructive" : score >= 40 ? "text-warning" : "text-success";
  const label = score >= 70 ? "High Risk" : score >= 40 ? "Moderate" : "Low Risk";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Operational Risk</span>
          <span className={`text-sm font-bold ${color}`}>{score}/100</span>
        </div>
        <Progress value={score} className="h-2" />
      </div>
      <Badge className={`${score >= 70 ? "bg-destructive/10 text-destructive border-destructive/20" : score >= 40 ? "bg-warning/10 text-warning border-warning/20" : "bg-success/10 text-success border-success/20"} text-[10px] px-2 py-0.5`}>
        {label}
      </Badge>
    </div>
  );
}

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
  const [genStep, setGenStep] = useState("");
  const queryClient = useQueryClient();

  const isLoading = reportsLoading || newsLoading;
  const hasReport = reports && reports.length > 0;
  const latestReport = hasReport ? reports[0] : null;

  const now = new Date();
  const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weekNews = allNews?.filter((e) => e.week_number === weekNumber && e.year === now.getFullYear()) || [];

  const riskScore = (latestReport as any)?.risk_score as number | undefined;
  const outlook = (latestReport as any)?.outlook as string | undefined;
  const keyTakeaways = ((latestReport as any)?.key_takeaways || []) as string[];
  const recommendations = ((latestReport as any)?.recommendations || []) as { priority: string; action: string; rationale: string }[];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenStep("Analyzing news entries...");
    try {
      setTimeout(() => setGenStep("Running AI analysis..."), 2000);
      setTimeout(() => setGenStep("Scoring risk & generating recommendations..."), 5000);
      await triggerGenerateReport("weekly");
      setGenStep("Done!");
      toast.success("Weekly report generated!");
      queryClient.invalidateQueries({ queryKey: ["weekly_reports"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGenerating(false);
      setGenStep("");
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
        <div className="flex flex-col items-end gap-1">
          <button onClick={handleGenerate} disabled={isGenerating || !allNews?.length}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50 font-medium">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isGenerating ? "Generating..." : "Generate Report"}
          </button>
          {isGenerating && genStep && (
            <span className="text-[11px] text-muted-foreground animate-pulse">{genStep}</span>
          )}
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
          {/* Risk Score */}
          {riskScore != null && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-secondary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Risk Assessment</h2>
              </div>
              <RiskGauge score={riskScore} />
            </motion.div>
          )}

          {/* Executive Summary */}
          {latestReport && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</h2>
              <p className="text-sm text-card-foreground leading-relaxed">{latestReport.executive_summary}</p>
            </motion.div>
          )}

          {/* Key Takeaways */}
          {keyTakeaways.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-warning" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key Takeaways</h2>
              </div>
              <ul className="space-y-2">
                {keyTakeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-card-foreground">
                    <span className="text-secondary font-bold mt-0.5">›</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-secondary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recommendations</h2>
              </div>
              <div className="space-y-3">
                {recommendations.map((r, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`${priorityBadgeClass[r.priority] || "bg-muted text-muted-foreground"} text-[10px] px-2 py-0.5`}>
                        {r.priority}
                      </Badge>
                      <span className="text-sm font-medium text-card-foreground">{r.action}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">{r.rationale}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Outlook */}
          {outlook && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-secondary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Week Ahead Outlook</h2>
              </div>
              <p className="text-sm text-card-foreground leading-relaxed">{outlook}</p>
            </motion.div>
          )}

          {/* News by Section */}
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
