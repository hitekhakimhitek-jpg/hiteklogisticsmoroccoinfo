import { useState, useMemo, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useLastUpdated } from "@/hooks/useFreightData";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  useIntelligenceItems,
  useIntelCounts,
  DEPARTMENT_LABELS,
  type IntelDepartment,
  type IntelSeverity,
} from "@/hooks/useIntelligenceItems";
import { IntelCard } from "@/components/intel/IntelCard";
import { AddItemDialog } from "@/components/intel/AddItemDialog";

const DEPT_FILTERS: { value: IntelDepartment | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "operations", label: "Operations" },
  { value: "compliance", label: "Compliance" },
  { value: "finance", label: "Finance" },
  { value: "commercial", label: "Commercial" },
  { value: "it", label: "IT" },
];

const Dashboard = () => {
  const { lang, toggle: toggleLang } = useLanguage();
  const { data: lastUpdated } = useLastUpdated();
  const { data: counts } = useIntelCounts();

  const [department, setDepartment] = useState<IntelDepartment | "all">(() => {
    return (localStorage.getItem("hitek_default_dept") as IntelDepartment | "all") || "all";
  });
  const [severity, setSeverity] = useState<IntelSeverity | "all">("all");

  useEffect(() => {
    localStorage.setItem("hitek_default_dept", department);
  }, [department]);

  const { data: items, isLoading } = useIntelligenceItems({ department, severity });

  const hasData = !!items && items.length > 0;

  const sevCards = useMemo(
    () => [
      {
        key: "act_now" as const,
        label: "Act now",
        count: counts?.act_now ?? 0,
        cls: "border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-300",
        dot: "bg-red-500",
      },
      {
        key: "this_week" as const,
        label: "This week",
        count: counts?.this_week ?? 0,
        cls: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
        dot: "bg-amber-500",
      },
      {
        key: "awareness" as const,
        label: "Awareness",
        count: counts?.awareness ?? 0,
        cls: "border-slate-400/40 bg-slate-400/5 text-slate-600 dark:text-slate-300",
        dot: "bg-slate-400",
      },
    ],
    [counts]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Intelligence feed</h1>
          <p className="text-sm text-muted-foreground">
            What's red across the company right now.
          </p>
          <div className="mt-1">
            <FreshnessIndicator lastUpdated={lastUpdated} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddItemDialog />
          <button
            onClick={toggleLang}
            className="h-9 px-3 text-sm rounded-md border border-border bg-card text-card-foreground hover:bg-accent transition-colors font-medium"
          >
            {lang === "en" ? "Français" : "English"}
          </button>
        </div>
      </div>

      {/* Severity summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {sevCards.map((c) => (
          <button
            key={c.key}
            onClick={() => setSeverity((s) => (s === c.key ? "all" : c.key))}
            className={cn(
              "text-left rounded-lg border-2 p-4 transition-all hover:shadow-sm",
              c.cls,
              severity === c.key && "ring-2 ring-offset-2 ring-offset-background ring-current"
            )}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
              <span className={cn("w-2 h-2 rounded-full", c.dot)} />
              {c.label}
            </div>
            <div className="text-3xl font-bold mt-1">{c.count}</div>
          </button>
        ))}
      </div>

      {/* Department pills */}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        {DEPT_FILTERS.map((d) => {
          const active = department === d.value;
          const count =
            d.value === "all"
              ? Object.values(counts?.by_dept ?? {}).reduce((a, b) => a + b, 0)
              : counts?.by_dept?.[d.value] ?? 0;
          return (
            <button
              key={d.value}
              onClick={() => setDepartment(d.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-card-foreground border-border hover:bg-accent"
              )}
            >
              {d.label}
              <span
                className={cn(
                  "ml-1.5 text-xs opacity-70",
                  active ? "text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasData ? (
        <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">No intelligence items yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Intelligence items are generated automatically each day at 8 AM Morocco time. Use <strong>Add item</strong> to enter one manually with AI assist.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items!.map((item) => (
            <IntelCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-4">
        Sorted by severity, then most recent. Showing {items?.length ?? 0} items.
      </p>
    </div>
  );
};

export default Dashboard;
