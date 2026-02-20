import { AlertTriangle, Ship, ScrollText, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import type { DbNewsEntry } from "@/hooks/useFreightData";

interface Props {
  entries: DbNewsEntry[];
}

export function KPICards({ entries }: Props) {
  const criticalCount = entries.filter((e) => e.priority === "critical").length;
  const disruptionCount = entries.filter((e) => e.category === "weather" || e.category === "port").length;
  const regulationCount = entries.filter((e) => e.category === "regulation" || e.category === "compliance").length;
  // Simple index: ratio of critical to total
  const indexPct = entries.length > 0 ? Math.round((criticalCount / entries.length) * 100) : 0;

  const cards = [
    { label: "Critical Alerts", value: criticalCount, icon: AlertTriangle, accent: "text-destructive", bg: "bg-destructive/10", sub: "This period" },
    { label: "Active Disruptions", value: disruptionCount, icon: Ship, accent: "text-warning", bg: "bg-warning/10", sub: "Weather & port" },
    { label: "New Regulations", value: regulationCount, icon: ScrollText, accent: "text-secondary", bg: "bg-secondary/10", sub: "Compliance updates" },
    { label: "Alert Ratio", value: `${indexPct}%`, icon: indexPct > 20 ? TrendingUp : TrendingDown, accent: indexPct > 20 ? "text-destructive" : "text-success", bg: indexPct > 20 ? "bg-destructive/10" : "bg-success/10", sub: "Critical vs total" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          className="bg-card rounded-lg p-5 card-elevated border border-border"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.label}</span>
            <div className={`${card.bg} ${card.accent} p-2 rounded-lg`}>
              <card.icon className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-3xl font-bold ${card.accent}`}>{card.value}</div>
          <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
        </motion.div>
      ))}
    </div>
  );
}
