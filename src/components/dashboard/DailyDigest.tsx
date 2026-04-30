import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { getContentTag, tagStyles } from "@/types/freight";
import type { DbNewsEntry } from "@/hooks/useFreightData";

interface Props {
  entries: DbNewsEntry[];
}

export function DailyDigest({ entries }: Props) {
  // Pick the most important items for today's executive view.
  // Always surface critical items (including regulatory) — even if more than 3.
  const order = { critical: 0, important: 1, informational: 2 } as const;
  // Regulatory/compliance items are the most consequential for a freight forwarder,
  // so rank them above other categories at the same priority level.
  const isRegulatory = (e: DbNewsEntry) =>
    e.category === "regulation" || e.category === "compliance";
  const sorted = [...entries].sort((a, b) => {
    if (a.action_required !== b.action_required) return a.action_required ? -1 : 1;
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
    if (isRegulatory(a) !== isRegulatory(b)) return isRegulatory(a) ? -1 : 1;
    return b.published_date.localeCompare(a.published_date);
  });

  const criticals = sorted.filter((e) => e.priority === "critical");
  const topItems = criticals.length >= 3
    ? criticals
    : [...criticals, ...sorted.filter((e) => e.priority !== "critical")].slice(0, 3);

  if (topItems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-br from-secondary/5 via-card to-card rounded-lg border border-secondary/20 card-elevated p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-secondary/10 p-1.5 rounded-md">
          <Sparkles className="w-4 h-4 text-secondary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">Top News</h2>
          <p className="text-[11px] text-muted-foreground">The updates that matter most today</p>
        </div>
      </div>
      <ol className="space-y-2.5">
        {topItems.map((entry, i) => {
          const tag = getContentTag(entry);
          return (
            <li key={entry.id} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-secondary/10 text-secondary text-[10px] font-semibold inline-flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground leading-snug">
                  {entry.headline}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${tagStyles[tag]}`}>
                    {tag}
                  </span>
                  {entry.impact_assessment && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {entry.impact_assessment}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}