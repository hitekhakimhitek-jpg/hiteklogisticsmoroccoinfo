import { priorityConfig, categoryLabels } from "@/types/freight";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Flag, ShieldCheck, AlertCircle, ExternalLink, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { DbNewsEntry } from "@/hooks/useFreightData";

interface Props {
  entries: DbNewsEntry[];
}

export function MoroccoFocus({ entries }: Props) {
  const moroccoNews = entries.filter((e) => e.region === "morocco").slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.35 }}
      className="bg-card rounded-lg border border-border card-elevated p-5">
      <div className="flex items-center gap-2 mb-4">
        <Flag className="w-4 h-4 text-success" />
        <h3 className="text-sm font-semibold text-card-foreground">Morocco Focus</h3>
      </div>
      {moroccoNews.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No Morocco-specific entries yet.</p>
      ) : (
        <div className="space-y-3">
          {moroccoNews.map((entry) => {
            const pConfig = priorityConfig[entry.priority];
            return (
              <div key={entry.id} className="flex items-start gap-2">
                <Badge className={`${pConfig.className} text-[9px] px-1.5 py-0 mt-1 shrink-0`}>{pConfig.label[0]}</Badge>
                <div>
                  <p className="text-xs font-medium text-card-foreground leading-tight">{entry.headline}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[10px] text-muted-foreground">{entry.published_date} · {categoryLabels[entry.category]}</p>
                    {entry.source_url && (
                      <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline inline-flex items-center gap-0.5 text-[10px]" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export function ComplianceWatchlist({ entries }: Props) {
  const complianceEntries = entries
    .filter((e) => e.category === "compliance" || e.category === "regulation")
    .sort((a, b) => {
      // Action required first, then by priority, then by date
      if (a.action_required !== b.action_required) return a.action_required ? -1 : 1;
      const order = { critical: 0, important: 1, informational: 2 };
      if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
      return b.published_date.localeCompare(a.published_date);
    })
    .slice(0, 6);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.35 }}
      className="bg-card rounded-lg border border-border card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-secondary" />
          <h3 className="text-sm font-semibold text-card-foreground">Regulatory & Compliance</h3>
        </div>
        <Link to="/regulatory" className="text-[10px] text-secondary hover:underline inline-flex items-center gap-1 font-medium">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {complianceEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No compliance or regulatory entries yet.</p>
      ) : (
        <div className="space-y-3">
          {complianceEntries.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              {item.action_required ? (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
              )}
              <div className="flex-1 min-w-0">
                {item.source_url ? (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-medium text-card-foreground leading-tight hover:text-secondary hover:underline transition-colors inline-flex items-start gap-1">
                    <span className="line-clamp-2">{item.headline}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 mt-0.5 text-secondary" />
                  </a>
                ) : (
                  <p className="text-xs font-medium text-card-foreground leading-tight line-clamp-2">{item.headline}</p>
                )}
                {item.action_required && item.suggested_action && (
                  <p className="text-[10px] text-destructive mt-0.5 line-clamp-2">⚠ {item.suggested_action}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.published_date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
