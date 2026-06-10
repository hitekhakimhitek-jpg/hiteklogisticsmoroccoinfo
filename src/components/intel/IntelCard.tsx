import {
  IntelligenceItem,
  DEPARTMENT_LABELS,
  SEVERITY_LABELS,
  HORIZON_LABELS,
} from "@/hooks/useIntelligenceItems";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const SEVERITY_STYLES = {
  act_now: {
    dot: "bg-red-500",
    border: "border-l-red-500",
    badge: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
  },
  this_week: {
    dot: "bg-amber-500",
    border: "border-l-amber-500",
    badge: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  },
  awareness: {
    dot: "bg-slate-400",
    border: "border-l-slate-400",
    badge: "bg-slate-400/10 text-slate-600 border-slate-400/30 dark:text-slate-300",
  },
} as const;

export function IntelCard({ item }: { item: IntelligenceItem }) {
  const sev = SEVERITY_STYLES[item.severity];

  return (
    <article
      className={cn(
        "bg-card rounded-lg border border-border border-l-4 card-elevated p-4 sm:p-5 space-y-3",
        sev.border,
        item.status === "archived" && "opacity-50"
      )}
    >
      {/* Top row: badges */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className={cn("inline-block w-2 h-2 rounded-full", sev.dot)} aria-hidden />
        <Badge variant="outline" className={cn("font-semibold", sev.badge)}>
          {SEVERITY_LABELS[item.severity]}
        </Badge>
        <Badge variant="outline" className="font-medium">
          {DEPARTMENT_LABELS[item.department]}
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="w-3 h-3 mr-1" />
          {HORIZON_LABELS[item.time_to_impact]}
        </Badge>
        <span className="ml-auto text-muted-foreground">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Headline */}
      {item.source_url ? (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-base sm:text-lg font-semibold text-card-foreground hover:text-primary leading-snug"
        >
          {item.headline}
          <ExternalLink className="w-3.5 h-3.5 ml-1 inline opacity-60" />
        </a>
      ) : (
        <h3 className="text-base sm:text-lg font-semibold text-card-foreground leading-snug">
          {item.headline}
        </h3>
      )}

      {item.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{item.summary}</p>
      )}

      {/* Impact + Action — the core value */}
      <div className="space-y-2 pt-1">
        {item.impact && (
          <div className="text-sm">
            <span className="font-semibold text-foreground">Impact: </span>
            <span className="text-muted-foreground">{item.impact}</span>
          </div>
        )}
        <div className="text-sm">
          <span className="font-semibold text-foreground">Action: </span>
          <span className="text-muted-foreground">{item.action_required}</span>
        </div>
      </div>

      {/* Tags */}
      {item.affected_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.affected_tags.map((t) => (
            <span
              key={t}
              className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Footer: source + owner + actions */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
        <span className="font-medium">{item.source_name}</span>
        {item.owner && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              {item.owner}
            </span>
          </>
        )}
      </div>
    </article>
  );
}