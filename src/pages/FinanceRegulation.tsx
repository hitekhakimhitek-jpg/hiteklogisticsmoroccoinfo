import { useMemo } from "react";
import { useNewsEntries } from "@/hooks/useFreightData";
import { priorityConfig, categoryLabels, regionLabels, categoryColors } from "@/types/freight";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Landmark, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";

const FinanceRegulation = () => {
  const { data: allEntries, isLoading } = useNewsEntries({});

  const FINANCE_KEYWORDS = [
    "fiscal", "tax", "tarif", "duty", "customs duty", "douane", "tva", "vat",
    "exchange rate", "currency", "mad ", "dirham", "finance", "banking",
    "budget", "surcharge", "invoice", "payment", "impôt", "redevance",
    "droit de douane", "loi de finances", "taxe", "prélèvement",
    "contribution", "amende", "pénalité", "trésor", "fisc",
  ];

  const financeEntries = useMemo(() => {
    if (!allEntries) return [];
    return allEntries
      .filter((e) => {
        const text = `${e.headline} ${e.summary} ${e.impact_assessment ?? ""} ${e.suggested_action ?? ""}`.toLowerCase();
        return FINANCE_KEYWORDS.some((kw) => text.includes(kw));
      })
      .sort((a, b) => {
        if (a.action_required !== b.action_required) return a.action_required ? -1 : 1;
        if (a.published_date !== b.published_date) return b.published_date.localeCompare(a.published_date);
        const order = { critical: 0, important: 1, informational: 2 };
        return order[a.priority] - order[b.priority];
      });
  }, [allEntries]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2.5 rounded-lg">
          <Landmark className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance & Fiscal Regulation</h1>
          <p className="text-sm text-muted-foreground">
            Regulatory, compliance, and fiscal policy updates relevant to your finance department — taxes, duties, exchange rates, customs fees, and budget laws.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Finance-focused view.</span>{" "}
          Showing market, regulation, and compliance entries related to fiscal policy, customs duties, exchange rates, and financial compliance. If no relevant entries are found, nothing is displayed.
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : financeEntries.length === 0 ? (
        <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center">
          <Landmark className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nothing noteworthy happened this week. We'll update you as soon as something relevant comes up.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {financeEntries.map((entry, i) => {
            const pConfig = priorityConfig[entry.priority];
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.25 }}
                className="bg-card rounded-lg border border-border card-elevated overflow-hidden"
              >
                <div className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Badge className={`${pConfig.className} shrink-0 text-[10px] px-2 py-0.5 mt-0.5`}>
                      {pConfig.label}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      {entry.source_url ? (
                        <a
                          href={entry.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-card-foreground leading-tight hover:text-secondary hover:underline transition-colors inline-flex items-start gap-1.5"
                        >
                          {entry.headline}
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-secondary" />
                        </a>
                      ) : (
                        <h3 className="text-sm font-semibold text-card-foreground leading-tight">
                          {entry.headline}
                        </h3>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground ml-[calc(theme(spacing.2)+theme(spacing.3)+2rem)]">
                    {entry.summary}
                  </p>

                  {entry.action_required && entry.suggested_action && (
                    <div className="ml-[calc(theme(spacing.2)+theme(spacing.3)+2rem)] bg-destructive/5 border border-destructive/20 rounded-md p-2.5">
                      <p className="text-[11px] font-semibold text-destructive mb-0.5">⚠ Action Required</p>
                      <p className="text-xs text-card-foreground">{entry.suggested_action}</p>
                    </div>
                  )}

                  {entry.impact_assessment && (
                    <p className="text-[11px] text-muted-foreground ml-[calc(theme(spacing.2)+theme(spacing.3)+2rem)] italic">
                      Impact: {entry.impact_assessment}
                    </p>
                  )}

                  <div className="flex items-center gap-2 ml-[calc(theme(spacing.2)+theme(spacing.3)+2rem)] flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${categoryColors[entry.category]}`}>
                      {categoryLabels[entry.category]}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {regionLabels[entry.region]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {entry.source_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto font-medium">
                      {entry.published_date}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FinanceRegulation;
