import { useState, useMemo, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useLastUpdated } from "@/hooks/useFreightData";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  useIntelligenceItems,
  useIntelCounts,
  DEPARTMENT_LABELS_BY_LANG,
  SEVERITY_LABELS_BY_LANG,
  type IntelDepartment,
  type IntelSeverity,
  type IntelligenceItem,
} from "@/hooks/useIntelligenceItems";
import { IntelCard } from "@/components/intel/IntelCard";
import { AddItemDialog } from "@/components/intel/AddItemDialog";
import { SEO } from "@/components/SEO";

// Strict canonical order — IT must always be last.
const DEPT_ORDER: IntelDepartment[] = ["operations", "compliance", "finance", "commercial", "it"];
const DEPT_VALUES: (IntelDepartment | "all")[] = ["all", ...DEPT_ORDER];

// Severity order — Critical first, then This Week, then To be aware of.
const SEV_ORDER: IntelSeverity[] = ["act_now", "this_week", "awareness"];

function effectiveDate(item: IntelligenceItem): Date {
  return new Date(item.publication_date ?? item.created_at);
}

const Dashboard = () => {
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();
  const { data: lastUpdated } = useLastUpdated();
  const { data: counts } = useIntelCounts();
  const SEV = SEVERITY_LABELS_BY_LANG[lang];
  const DEPT = DEPARTMENT_LABELS_BY_LANG[lang];
  const allLabel = lang === "fr" ? "Tous" : "All";

  const [department, setDepartment] = useState<IntelDepartment | "all">(() => {
    return (localStorage.getItem("hitek_default_dept") as IntelDepartment | "all") || "all";
  });
  const [severity, setSeverity] = useState<IntelSeverity | "all">("all");

  useEffect(() => {
    localStorage.setItem("hitek_default_dept", department);
  }, [department]);

  const { data: items, isLoading } = useIntelligenceItems({ department, severity });

  const hasData = !!items && items.length > 0;

  // Group: severity (Critical → This week → Awareness) → department (Ops → Compliance → Finance → Commercial → IT)
  const grouped = useMemo(() => {
    const result: Record<IntelSeverity, Record<IntelDepartment, IntelligenceItem[]>> = {
      act_now:   { operations: [], compliance: [], finance: [], commercial: [], it: [] },
      this_week: { operations: [], compliance: [], finance: [], commercial: [], it: [] },
      awareness: { operations: [], compliance: [], finance: [], commercial: [], it: [] },
    };
    for (const it of items ?? []) {
      if (!result[it.severity]) continue;
      result[it.severity][it.department].push(it);
    }
    for (const sev of SEV_ORDER) {
      for (const dept of DEPT_ORDER) {
        result[sev][dept].sort((a, b) => effectiveDate(b).getTime() - effectiveDate(a).getTime());
      }
    }
    return result;
  }, [items]);

  const visibleDepts: IntelDepartment[] =
    department === "all" ? DEPT_ORDER : [department as IntelDepartment];
  const visibleSeverities: IntelSeverity[] =
    severity === "all" ? SEV_ORDER : [severity as IntelSeverity];

  const sevCards = useMemo(
    () => [
      {
        key: "act_now" as const,
        label: SEV.act_now,
        count: counts?.act_now ?? 0,
        cls: "border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-300",
        dot: "bg-red-500",
      },
      {
        key: "this_week" as const,
        label: SEV.this_week,
        count: counts?.this_week ?? 0,
        cls: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
        dot: "bg-amber-500",
      },
      {
        key: "awareness" as const,
        label: SEV.awareness,
        count: counts?.awareness ?? 0,
        cls: "border-slate-400/40 bg-slate-400/5 text-slate-600 dark:text-slate-300",
        dot: "bg-slate-400",
      },
    ],
    [counts, SEV]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <SEO
        title="Intelligence Feed"
        description="Live freight and logistics intelligence for Morocco: critical, important, and awareness items across Operations, Compliance, Finance, Commercial, and IT."
      />
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {lang === "fr" ? "Flux de renseignement" : "Intelligence feed"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "fr"
              ? "Ce qui est important dans toute l'entreprise en ce moment."
              : "What's important across the company right now."}
          </p>
          <div className="mt-1">
            <FreshnessIndicator lastUpdated={lastUpdated} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && <AddItemDialog />}
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
        {DEPT_VALUES.map((v) => {
          const active = department === v;
          const count =
            v === "all"
              ? Object.values(counts?.by_dept ?? {}).reduce((a, b) => a + b, 0)
              : counts?.by_dept?.[v] ?? 0;
          const label = v === "all" ? allLabel : DEPT[v];
          return (
            <button
              key={v}
              onClick={() => setDepartment(v)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-card-foreground border-border hover:bg-accent"
              )}
            >
              {label}
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
          <h2 className="text-lg font-semibold">
            {lang === "fr" ? "Aucun élément de renseignement" : "No intelligence items yet"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {lang === "fr"
              ? "Les éléments de renseignement sont générés automatiquement chaque jour à 8 h heure du Maroc."
              : "Intelligence items are generated automatically each day at 8 AM Morocco time."}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {visibleSeverities.map((sev) => {
            const sevHasAny = visibleDepts.some((d) => grouped[sev][d].length > 0);
            if (!sevHasAny) return null;
            const sevMeta = sevCards.find((c) => c.key === sev)!;
            return (
              <section key={sev} className="space-y-4">
                <div className="flex items-baseline gap-3 border-b-2 border-border pb-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", sevMeta.dot)} />
                  <h2 className="text-2xl font-bold text-foreground">{SEV[sev]}</h2>
                  <span className="text-xs text-muted-foreground">
                    {visibleDepts.reduce((n, d) => n + grouped[sev][d].length, 0)}{" "}
                    {lang === "fr" ? "élément(s)" : "item(s)"}
                  </span>
                </div>
                {visibleDepts.map((dept) => {
                  const rows = grouped[sev][dept];
                  if (rows.length === 0) return null;
                  return (
                    <div key={dept} className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pt-1">
                        {DEPT[dept]}
                      </h3>
                      <div className="space-y-3">
                        {rows.map((item) => (
                          <IntelCard key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-4">
        {lang === "fr"
          ? `Trié par gravité, puis par récence. ${items?.length ?? 0} élément(s) affiché(s).`
          : `Sorted by severity, then most recent. Showing ${items?.length ?? 0} items.`}
      </p>
    </div>
  );
};

export default Dashboard;
