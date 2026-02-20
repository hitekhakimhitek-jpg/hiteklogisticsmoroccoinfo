import { useState } from "react";
import { CalendarDays, TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { useMonthlySummaries, triggerGenerateReport } from "@/hooks/useFreightData";
import { Badge } from "@/components/ui/badge";
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

const MonthlySummary = () => {
  const { data: summaries, isLoading } = useMonthlySummaries();
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const summary = summaries?.[0];

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await triggerGenerateReport("monthly");
      toast.success("Monthly summary generated!");
      queryClient.invalidateQueries({ queryKey: ["monthly_summaries"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const topEvents = (summary?.top_events as any[]) || [];
  const compliance = (summary?.compliance_tracker as any[]) || [];
  const comparison = summary?.month_comparison as any;

  const comparisonData = comparison
    ? [
        { name: "Disruptions", current: comparison.disruptions?.current || 0, previous: comparison.disruptions?.previous || 0 },
        { name: "Regulations", current: comparison.regulations?.current || 0, previous: comparison.regulations?.previous || 0 },
        { name: "Critical", current: comparison.criticalAlerts?.current || 0, previous: comparison.criticalAlerts?.previous || 0 },
        { name: "Total", current: comparison.newsItems?.current || 0, previous: comparison.newsItems?.previous || 0 },
      ]
    : [];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 p-2 rounded-lg"><CalendarDays className="w-5 h-5 text-secondary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monthly Summary</h1>
            <p className="text-sm text-muted-foreground">{summary ? `${new Date(0, (summary.month as number) - 1).toLocaleString("en", { month: "long" })} ${summary.year}` : "No summary yet"}</p>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={isGenerating}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50 font-medium">
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isGenerating ? "Generating..." : "Generate Summary"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !summary ? (
        <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center">
          <p className="text-muted-foreground">No monthly summary yet. Fetch news first, then generate a summary.</p>
        </div>
      ) : (
        <>
          {/* Executive Summary */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border border-border card-elevated p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</h2>
            <p className="text-sm text-card-foreground leading-relaxed">{summary.executive_summary}</p>
          </motion.div>

          {/* Top Events */}
          {topEvents.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Top Events of the Month</h2>
              <div className="space-y-2">
                {topEvents.map((event: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-lg font-bold text-muted-foreground w-8 text-center shrink-0">{event.rank || i + 1}</span>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-card-foreground">{event.headline}</p></div>
                    <Badge className={`${impactColors[event.impact] || "bg-muted text-muted-foreground"} text-[10px] px-2 py-0.5 shrink-0`}>{event.impact}</Badge>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Compliance Tracker */}
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
                        <td className="py-3 px-3 text-card-foreground">{item.item}</td>
                        <td className="py-3 px-3 text-muted-foreground">{item.deadline}</td>
                        <td className="py-3 px-3"><span className={`text-xs font-medium ${sd.className}`}>{sd.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}

          {/* Morocco Digest */}
          {summary.morocco_digest && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">🇲🇦 Morocco Monthly Digest</h2>
              <p className="text-sm text-card-foreground leading-relaxed">{summary.morocco_digest}</p>
            </motion.div>
          )}

          {/* Comparison Chart */}
          {comparisonData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-lg border border-border card-elevated p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Month-over-Month Comparison</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
                    <Bar dataKey="previous" name="Last Month" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="current" name="This Month" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
};

export default MonthlySummary;
