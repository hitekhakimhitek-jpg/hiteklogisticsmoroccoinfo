import { AlertTriangle, Ship, ScrollText, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { kpiData } from "@/data/mockData";
import { motion } from "framer-motion";

const cards = [
  {
    label: "Critical Alerts",
    value: kpiData.criticalAlerts,
    icon: AlertTriangle,
    accent: "text-destructive",
    bg: "bg-destructive/10",
  },
  {
    label: "Active Disruptions",
    value: kpiData.activeDisruptions,
    icon: Ship,
    accent: "text-warning",
    bg: "bg-warning/10",
  },
  {
    label: "New Regulations",
    value: kpiData.newRegulations,
    icon: ScrollText,
    accent: "text-secondary",
    bg: "bg-secondary/10",
  },
  {
    label: "Freight Index",
    value: `${kpiData.freightIndex.direction === "up" ? "+" : "-"}${kpiData.freightIndex.value}%`,
    icon: kpiData.freightIndex.direction === "up" ? TrendingUp : TrendingDown,
    accent: kpiData.freightIndex.direction === "up" ? "text-destructive" : "text-success",
    bg: kpiData.freightIndex.direction === "up" ? "bg-destructive/10" : "bg-success/10",
    isIndex: true,
  },
];

export function KPICards() {
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
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
            <div className={`${card.bg} ${card.accent} p-2 rounded-lg`}>
              <card.icon className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-3xl font-bold ${card.accent}`}>
            {card.value}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {card.isIndex ? "Week-over-week change" : "This week"}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
