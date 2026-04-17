import { useState } from "react";
import { FileBarChart, RefreshCw, Loader2, Shield, Eye, ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown, Lightbulb, Target } from "lucide-react";
import { useNewsEntries, useWeeklyReports, triggerGenerateReport } from "@/hooks/useFreightData";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const impactColors: Record<string, string> = {
  Critical: "bg-destructive text-destructive-foreground",
  High: "bg-warning text-warning-foreground",
  Medium: "bg-secondary text-secondary-foreground",
  Low: "bg-muted text-muted-foreground",
};

const statusDisplay: Record<string, { className: string; label: string }> = {
  addressed: { className: "text-success", label: "✅ Addressed" },
  pending: { className: "text-warning", label: "⏳ Pending" },
  action_needed: { className: "text-destructive", label: "🔴 Action Needed" },
};

const directionIcon: Record<string, typeof ArrowUpRight> = {
  rising: ArrowUpRight,
  declining: ArrowDownRight,
  stable: Minus,
};

const directionColor: Record<string, string> = {
  rising: "text-destructive",
  declining: "text-success",
  stable: "text-muted-foreground",
};

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
          <span className="text-xs font-medium text-muted-foreground">Weekly Risk Score</span>
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

const WeeklyReport = () => {
  const { data: reports, isLoading: reportsLoading } = useWeeklyReports();
  const { data: allNews, isLoading: newsLoading } = useNewsEntries({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState("");
  const queryClient = useQueryClient();

  const isLoading = reportsLoading || newsLoading;
  const latestReport = reports && reports.length > 0 ? reports[0] : null;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${sevenDaysAgo.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
  const weekNews = allNews?.filter((e) => {
    const d = new Date(e.published_date);
    return d >= sevenDaysAgo && d <= now;
  }) || [];

  const reportJson = (latestReport?.report_json || {}) as any;
  const riskScore = (latestReport as any)?.risk_score as number | undefined;
  const outlook = (latestReport as any)?.outlook as string | undefined;
  const keyTakeaways = ((latestReport as any)?.key_takeaways || []) as string[];
  const recommendations = ((latestReport as any)?.recommendations || []) as { priority: string; action: string; rationale: string }[];
  const topEvents = (reportJson.top_events as any[]) || [];
  const compliance = (reportJson.compliance_tracker as any[]) || [];
  const trendAnalysis = (reportJson.trend_analysis as { trend: string; direction: string; description: string }[]) || [];
  const moroccoDigest = reportJson.morocco_digest as string | undefined;
  const comparison = reportJson.week_comparison as any;

  const comparisonData = comparison
    ? [
        { name: "Disruptions", current: comparison.disruptions?.current || 0, previous: comparison.disruptions?.previous || 0 },
        { name: "Regulations", current: comparison.regulations?.current || 0, previous: comparison.regulations?.previous || 0 },
        { name: "Critical", current: comparison.criticalAlerts?.current || 0, previous: comparison.criticalAlerts?.previous || 0 },
        { name: "Total", current: comparison.newsItems?.current || 0, previous: comparison.newsItems?.previous || 0 },
      ]
    : [];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenStep("Collecting last 7 days of news...");
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 p-2 rounded-lg"><FileBarChart className="w-5 h-5 text-secondary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Weekly Intelligence Report</h1>
            <p className="text-sm text-muted-foreground">{dateRange} · {weekNews.length} sources</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button onClick={handleGenerate} disabled={isGenerating || !allNews?.length}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50 font-medium">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isGenerating ? "Generating..." : "Generate Report"}
          </button>
          {isGenerating && genStep && <span className="text-[11px] text-muted-foreground animate-pulse">{genStep}</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !latestReport ? (
        <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center">
          <p className="text-muted-foreground">No weekly report yet. Fetch news first, then generate a report.</p>
        </div>
      ) : (
        <div id="weekly-report-content" className="space-y-6">
          {riskScore != null && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-secondary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Risk Assessment</h2>
              </div>
              <RiskGauge score={riskScore} />
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-lg border border-border card-elevated p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</h2>
            <p className="text-sm text-card-foreground leading-relaxed">{latestReport.executive_summary}</p>
          </motion.div>

          {keyTakeaways.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-card rounded-lg border border-border card-elevated p-5">
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

          {trendAnalysis.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Trend Analysis</h2>
              <div className="space-y-3">
                {trendAnalysis.map((t, i) => {
                  const DirIcon = directionIcon[t.direction] || Minus;
                  const dirColor = directionColor[t.direction] || "text-muted-foreground";
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <DirIcon className={`w-5 h-5 shrink-0 mt-0.5 ${dirColor}`} />
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{t.trend}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                      </div>
                      <Badge className={`ml-auto shrink-0 ${dirColor} bg-transparent border text-[10px]`}>{t.direction}</Badge>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {topEvents.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Top Events of the Week</h2>
              <div className="space-y-2">
                {topEvents.map((event: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-lg font-bold text-muted-foreground w-8 text-center shrink-0">{event.rank || i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground">{event.headline}</p>
                      {event.analysis && <p className="text-xs text-muted-foreground mt-0.5">{event.analysis}</p>}
                    </div>
                    <Badge className={`${impactColors[event.impact] || "bg-muted text-muted-foreground"} text-[10px] px-2 py-0.5 shrink-0`}>{event.impact}</Badge>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {recommendations.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-card rounded-lg border border-border card-elevated p-5">
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

          {compliance.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Compliance Tracker</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Requirement</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Deadline</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                </tr></thead>
                <tbody>
                  {compliance.map((item: any, i: number) => {
                    const sd = statusDisplay[item.status] || statusDisplay.pending;
                    return (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-3 text-card-foreground">
                          {item.item}
                          {item.detail && <p className="text-[11px] text-muted-foreground mt-0.5">{item.detail}</p>}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{item.deadline}</td>
                        <td className="py-3 px-3"><span className={`text-xs font-medium ${sd.className}`}>{sd.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}

          {moroccoDigest && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">🇲🇦 Morocco Weekly Digest</h2>
              <p className="text-sm text-card-foreground leading-relaxed">{moroccoDigest}</p>
            </motion.div>
          )}

          {outlook && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-secondary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Week Ahead Outlook</h2>
              </div>
              <p className="text-sm text-card-foreground leading-relaxed">{outlook}</p>
            </motion.div>
          )}

          {comparisonData.length > 0 && comparison && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Week-over-Week Comparison</h2>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {Object.entries(comparison).map(([key, val]: [string, any]) => {
                  const labels: Record<string, string> = { disruptions: "Disruptions", regulations: "Regulations", criticalAlerts: "Critical Alerts", newsItems: "Total News" };
                  if (!labels[key]) return null;
                  const isUp = (val.change || 0) > 0;
                  return (
                    <div key={key} className="bg-muted/30 rounded-lg p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{labels[key]}</p>
                      <p className="text-2xl font-bold text-card-foreground">{val.current}</p>
                      <div className={`flex items-center justify-center gap-1 text-xs font-medium mt-1 ${isUp ? "text-destructive" : "text-success"}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? "+" : ""}{val.change || 0}%
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", fontSize: 12 }} />
                    <Bar dataKey="previous" name="Last Week" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="current" name="This Week" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeeklyReport;
