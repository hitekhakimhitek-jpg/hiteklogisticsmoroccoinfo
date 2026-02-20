import { priorityConfig, categoryLabels } from "@/types/freight";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Flag, ShieldCheck, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
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
                  <p className="text-[10px] text-muted-foreground mt-0.5">{entry.published_date} · {categoryLabels[entry.category]}</p>
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
    .filter((e) => e.action_required)
    .slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.35 }}
      className="bg-card rounded-lg border border-border card-elevated p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-4 h-4 text-secondary" />
        <h3 className="text-sm font-semibold text-card-foreground">Compliance Watchlist</h3>
      </div>
      {complianceEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No compliance actions required.</p>
      ) : (
        <div className="space-y-3">
          {complianceEntries.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="text-xs font-medium text-card-foreground leading-tight">{item.headline}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.suggested_action || item.summary}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
