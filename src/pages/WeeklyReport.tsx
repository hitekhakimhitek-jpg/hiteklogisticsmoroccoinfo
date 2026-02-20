import { useState } from "react";
import { FileBarChart, Download, Mail, ChevronDown, AlertTriangle, ShieldCheck, TrendingUp, CloudRain, Newspaper, Flag } from "lucide-react";
import { mockWeeklyReports } from "@/data/reportData";
import { priorityConfig, categoryLabels, regionLabels, categoryColors } from "@/types/freight";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import type { NewsEntry } from "@/types/freight";

const sectionConfig = [
  { key: "critical", title: "Critical Alerts", subtitle: "Sanctions, blocked lanes, strikes, major disruptions", icon: AlertTriangle, accent: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  { key: "regulatory", title: "Regulatory & Compliance", subtitle: "New laws, customs changes, tariffs, certifications", icon: ShieldCheck, accent: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/20" },
  { key: "trade", title: "Trade & Market Updates", subtitle: "Rate changes, carrier updates, new routes, capacity shifts", icon: TrendingUp, accent: "text-success", bg: "bg-success/10", border: "border-success/20" },
  { key: "disruptions", title: "Disruptions & Weather", subtitle: "Port congestion, weather warnings, lane closures", icon: CloudRain, accent: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
  { key: "general", title: "General Industry News", subtitle: "Mergers, tech, sustainability, conferences, trends", icon: Newspaper, accent: "text-muted-foreground", bg: "bg-muted", border: "border-muted" },
  { key: "morocco", title: "Morocco Spotlight", subtitle: "Tanger Med, OTC/customs, local port changes, trade agreements", icon: Flag, accent: "text-success", bg: "bg-success/10", border: "border-success/20" },
];

function ReportEntry({ entry }: { entry: NewsEntry }) {
  const pConfig = priorityConfig[entry.priority];
  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-2">
      <div className="flex items-start gap-2">
        <Badge className={`${pConfig.className} text-[10px] px-2 py-0.5 shrink-0`}>{pConfig.label}</Badge>
        <h4 className="text-sm font-semibold text-card-foreground">{entry.headline}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{entry.summary}</p>
      <div className="bg-muted/50 rounded-md p-3 space-y-1">
        <p className="text-xs font-medium text-foreground">📌 What this means for your operations:</p>
        <p className="text-xs text-muted-foreground">{entry.impactAssessment}</p>
      </div>
      {entry.actionRequired && entry.suggestedAction && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 space-y-1">
          <p className="text-xs font-semibold text-destructive">⚠ Action Required</p>
          <p className="text-xs text-card-foreground">{entry.suggestedAction}</p>
        </div>
      )}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
        <span className={`px-2 py-0.5 rounded-full border ${categoryColors[entry.category]}`}>{categoryLabels[entry.category]}</span>
        <span className="px-2 py-0.5 rounded-full bg-muted">{regionLabels[entry.region]}</span>
        <span className="ml-auto">Source: {entry.sourceName}</span>
      </div>
    </div>
  );
}

const WeeklyReport = () => {
  const [selectedWeek, setSelectedWeek] = useState(0);
  const report = mockWeeklyReports[selectedWeek];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 p-2 rounded-lg">
            <FileBarChart className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Weekly Intelligence Report</h1>
            <p className="text-sm text-muted-foreground">Week {report.weekNumber}, {report.year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-input bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              {mockWeeklyReports.map((r, i) => (
                <option key={i} value={i}>{r.dateRange}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors font-medium">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-input bg-card text-card-foreground hover:bg-muted transition-colors">
            <Mail className="w-4 h-4" /> Email
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <motion.div
        key={selectedWeek}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-card rounded-lg border border-border card-elevated p-5"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</h2>
        <p className="text-sm text-card-foreground leading-relaxed">{report.executiveSummary}</p>
      </motion.div>

      {/* Sections */}
      <motion.div
        key={`sections-${selectedWeek}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="space-y-4"
      >
        {sectionConfig.map((section, si) => {
          const entries = report.sections[section.key as keyof typeof report.sections] || [];
          return (
            <div key={section.key} className="space-y-3">
              <div className={`flex items-center gap-3 p-3 rounded-lg ${section.bg} border ${section.border}`}>
                <section.icon className={`w-5 h-5 ${section.accent}`} />
                <div>
                  <h3 className={`text-sm font-bold ${section.accent}`}>{section.title}</h3>
                  <p className="text-[11px] text-muted-foreground">{section.subtitle}</p>
                </div>
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  {entries.length} {entries.length === 1 ? "item" : "items"}
                </span>
              </div>
              {entries.length > 0 ? (
                <div className="space-y-2 pl-2">
                  {entries.map((entry) => (
                    <ReportEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pl-2 italic">No items this week.</p>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default WeeklyReport;
