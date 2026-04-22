import { TrendingUp, AlertTriangle, FileText } from "lucide-react";
import { useMemo } from "react";
import type { DbNewsEntry } from "@/hooks/useFreightData";

interface Props {
  entries: DbNewsEntry[];
}

export function ChangeSummaryBanner({ entries }: Props) {
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const newToday = entries.filter((e) => e.published_date === todayStr);
    const yesterdayCount = entries.filter((e) => e.published_date === yesterdayStr).length;
    const criticalToday = newToday.filter((e) => e.priority === "critical").length;
    const actionToday = newToday.filter((e) => e.action_required).length;

    return {
      newToday: newToday.length,
      yesterdayCount,
      criticalToday,
      actionToday,
    };
  }, [entries]);

  if (stats.newToday === 0 && stats.yesterdayCount === 0) return null;

  const delta = stats.newToday - stats.yesterdayCount;
  const deltaText =
    delta > 0
      ? `+${delta} vs yesterday`
      : delta < 0
      ? `${delta} vs yesterday`
      : "same as yesterday";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-lg bg-secondary/5 border border-secondary/20 text-xs">
      <div className="flex items-center gap-1.5 text-card-foreground">
        <FileText className="w-3.5 h-3.5 text-secondary" />
        <span className="font-medium">{stats.newToday} new today</span>
        <span className="text-muted-foreground">({deltaText})</span>
      </div>
      {stats.criticalToday > 0 && (
        <div className="flex items-center gap-1.5 text-destructive">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="font-medium">{stats.criticalToday} critical</span>
        </div>
      )}
      {stats.actionToday > 0 && (
        <div className="flex items-center gap-1.5 text-warning">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="font-medium">{stats.actionToday} require action</span>
        </div>
      )}
    </div>
  );
}