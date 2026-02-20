import { useState } from "react";
import { CalendarDays, ChevronDown, TrendingUp, TrendingDown, ArrowUpRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { mockMonthlySummary } from "@/data/reportData";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const months = [
  { label: "February 2026", value: 0 },
  { label: "January 2026", value: 1 },
  { label: "December 2025", value: 2 },
];

const impactColors: Record<string, string> = {
  Critical: "bg-destructive text-destructive-foreground",
  High: "bg-warning text-warning-foreground",
  Medium: "bg-secondary text-secondary-foreground",
  Low: "bg-muted text-muted-foreground",
};

const statusConfig = {
  addressed: { icon: CheckCircle2, className: "text-success", label: "✅ Addressed" },
  pending: { icon: Clock, className: "text-warning", label: "⏳ Pending" },
  action_needed: { icon: AlertCircle, className: "text-destructive", label: "🔴 Action Needed" },
};

const MonthlySummary = () => {
  const [selectedMonth, setSelectedMonth] = useState(0);
  const data = mockMonthlySummary;

  const comparisonData = [
    { name: "Disruptions", current: data.monthComparison.disruptions.current, previous: data.monthComparison.disruptions.previous },
    { name: "Regulations", current: data.monthComparison.regulations.current, previous: data.monthComparison.regulations.previous },
    { name: "Critical Alerts", current: data.monthComparison.criticalAlerts.current, previous: data.monthComparison.criticalAlerts.previous },
    { name: "Total News", current: data.monthComparison.newsItems.current, previous: data.monthComparison.newsItems.previous },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 p-2 rounded-lg">
            <CalendarDays className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monthly Summary</h1>
            <p className="text-sm text-muted-foreground">{data.monthLabel}</p>
          </div>
        </div>
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-input bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Executive Summary */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="bg-card rounded-lg border border-border card-elevated p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</h2>
        <p className="text-sm text-card-foreground leading-relaxed">{data.executiveSummary}</p>
      </motion.div>

      {/* Top 10 Events */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}
        className="bg-card rounded-lg border border-border card-elevated p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Top 10 Events of the Month</h2>
        <div className="space-y-2">
          {data.topEvents.map((event) => (
            <div key={event.rank} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <span className="text-lg font-bold text-muted-foreground w-8 text-center shrink-0">
                {event.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{event.headline}</p>
              </div>
              <Badge className={`${impactColors[event.impact]} text-[10px] px-2 py-0.5 shrink-0`}>
                {event.impact}
              </Badge>
              <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">{event.category}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Compliance Tracker */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}
        className="bg-card rounded-lg border border-border card-elevated p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Compliance Tracker</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Requirement</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Deadline</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.complianceTracker.map((item, i) => {
                const sConfig = statusConfig[item.status];
                return (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-3 px-3 text-card-foreground">{item.item}</td>
                    <td className="py-3 px-3 text-muted-foreground">{item.deadline}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-medium ${sConfig.className}`}>{sConfig.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Morocco Monthly Digest */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}
        className="bg-card rounded-lg border border-border card-elevated p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">🇲🇦 Morocco Monthly Digest</h2>
        <p className="text-sm text-card-foreground leading-relaxed">{data.moroccoDigest}</p>
      </motion.div>

      {/* Month-over-Month Comparison */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.3 }}
        className="bg-card rounded-lg border border-border card-elevated p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Month-over-Month Comparison</h2>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {Object.entries(data.monthComparison).map(([key, val]) => {
            const labels: Record<string, string> = { disruptions: "Disruptions", regulations: "Regulations", criticalAlerts: "Critical Alerts", newsItems: "Total News" };
            const isUp = val.change > 0;
            return (
              <div key={key} className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{labels[key]}</p>
                <p className="text-2xl font-bold text-card-foreground">{val.current}</p>
                <div className={`flex items-center justify-center gap-1 text-xs font-medium mt-1 ${isUp ? "text-destructive" : "text-success"}`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isUp ? "+" : ""}{val.change}% vs last month
                </div>
              </div>
            );
          })}
        </div>

        {/* Bar Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="previous" name="Last Month" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="current" name="This Month" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
};

export default MonthlySummary;
