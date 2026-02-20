import { useState } from "react";
import { priorityConfig, categoryLabels, regionLabels, categoryColors } from "@/types/freight";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { DbNewsEntry } from "@/hooks/useFreightData";

interface Props {
  entries: DbNewsEntry[];
}

export function TopStories({ entries }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => {
    const order = { critical: 0, important: 1, informational: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Top Stories</h2>
      <div className="space-y-2">
        {sorted.slice(0, 15).map((entry, i) => {
          const isExpanded = expandedId === entry.id;
          const pConfig = priorityConfig[entry.priority];
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className="bg-card rounded-lg border border-border card-elevated overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                <Badge className={`${pConfig.className} shrink-0 text-[10px] px-2 py-0.5 mt-0.5`}>
                  {pConfig.label}
                </Badge>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-card-foreground leading-tight">{entry.headline}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.summary}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${categoryColors[entry.category]}`}>
                      {categoryLabels[entry.category]}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {regionLabels[entry.region]}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{entry.published_date}</span>
                  </div>
                </div>
                <div className="shrink-0 text-muted-foreground">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                      {entry.impact_assessment && (
                        <div className="pt-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Impact Assessment</h4>
                          <p className="text-sm text-card-foreground">{entry.impact_assessment}</p>
                        </div>
                      )}
                      {entry.action_required && entry.suggested_action && (
                        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
                          <h4 className="text-xs font-semibold text-destructive mb-1">⚠ Action Required</h4>
                          <p className="text-sm text-card-foreground">{entry.suggested_action}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Source: {entry.source_name}</span>
                        {entry.source_url && (
                          <a href={entry.source_url} className="text-secondary hover:underline inline-flex items-center gap-1">
                            Visit <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
