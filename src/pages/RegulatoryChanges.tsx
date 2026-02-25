import { useMemo } from "react";
import { useNewsEntries } from "@/hooks/useFreightData";
import { priorityConfig, categoryLabels, regionLabels, categoryColors } from "@/types/freight";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Scale, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";

const RegulatoryChanges = () => {
  const { data: allEntries, isLoading } = useNewsEntries({});

  const regulatoryEntries = useMemo(() => {
    if (!allEntries) return [];
    return allEntries
      .filter(
        (e) =>
          e.category === "regulation" ||
          e.category === "compliance"
      )
      .sort((a, b) => {
        // Newest first by published_date
        if (a.published_date !== b.published_date) {
          return b.published_date.localeCompare(a.published_date);
        }
        // Then by priority
        const order = { critical: 0, important: 1, informational: 2 };
        return order[a.priority] - order[b.priority];
      });
  }, [allEntries]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-destructive/10 p-2.5 rounded-lg">
          <Scale className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Regulatory & Law Changes</h1>
          <p className="text-sm text-muted-foreground">
            Only actual laws, decrees, circulars, and binding rule changes — newest first. Click any entry to read the official source.
          </p>
        </div>
      </div>

      {/* Alert banner */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">This page only shows actual law & rule changes.</span>{" "}
          New decrees, circulars, tariff updates, and binding regulatory changes that may require your company to take immediate action. General news is excluded.
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : regulatoryEntries.length === 0 ? (
        <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center">
          <Scale className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No regulatory or compliance entries found yet. Fetch news from the Dashboard.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {regulatoryEntries.map((entry, i) => {
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
                  {/* Top row: priority + headline + source link */}
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

                  {/* Summary */}
                  <p className="text-xs text-muted-foreground ml-[calc(theme(spacing.2)+theme(spacing.3)+2rem)]">
                    {entry.summary}
                  </p>

                  {/* Action required box */}
                  {entry.action_required && entry.suggested_action && (
                    <div className="ml-[calc(theme(spacing.2)+theme(spacing.3)+2rem)] bg-destructive/5 border border-destructive/20 rounded-md p-2.5">
                      <p className="text-[11px] font-semibold text-destructive mb-0.5">⚠ Action Required</p>
                      <p className="text-xs text-card-foreground">{entry.suggested_action}</p>
                    </div>
                  )}

                  {/* Impact assessment */}
                  {entry.impact_assessment && (
                    <p className="text-[11px] text-muted-foreground ml-[calc(theme(spacing.2)+theme(spacing.3)+2rem)] italic">
                      Impact: {entry.impact_assessment}
                    </p>
                  )}

                  {/* Meta row */}
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

export default RegulatoryChanges;
