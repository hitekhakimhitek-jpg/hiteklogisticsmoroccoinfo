import {
  IntelligenceItem,
  DEPARTMENT_LABELS_BY_LANG,
  SEVERITY_LABELS_BY_LANG,
  HORIZON_LABELS_BY_LANG,
} from "@/hooks/useIntelligenceItems";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, User, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow as formatDistanceToNowFn, format as formatDate } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { lang } = useLanguage();
  const SEV = SEVERITY_LABELS_BY_LANG[lang];
  const DEPT = DEPARTMENT_LABELS_BY_LANG[lang];
  const HORIZON = HORIZON_LABELS_BY_LANG[lang];

  const locale = lang === "fr" ? frLocale : undefined;
  const pubLabel = lang === "fr" ? "Publié" : "Published";
  const pubDate = item.publication_date
    ? formatDate(new Date(item.publication_date), "d LLLL yyyy", { locale })
    : null;

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
          {SEV[item.severity]}
        </Badge>
        <Badge variant="outline" className="font-medium">
          {DEPT[item.department]}
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="w-3 h-3 mr-1" />
          {HORIZON[item.time_to_impact]}
        </Badge>
        <span className="ml-auto text-muted-foreground">
          {formatDistanceToNowFn(new Date(item.created_at), {
            addSuffix: true,
            locale,
          })}
        </span>
      </div>

      {/* Publication date — prominent (only when known) */}
      {pubDate && (
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-foreground/80">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>{pubLabel}: {pubDate}</span>
          {item.effective_date && (
            <span className="ml-2 text-muted-foreground">
              · {lang === "fr" ? "Effectif" : "Effective"}: {formatDate(new Date(item.effective_date), "d LLLL yyyy", { locale })}
            </span>
          )}
        </div>
      )}

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
            <span className="font-semibold text-foreground">{lang === "fr" ? "Impact\u00A0: " : "Impact: "}</span>
            <span className="text-muted-foreground">{item.impact}</span>
          </div>
        )}
        <div className="text-sm">
          <span className="font-semibold text-foreground">{lang === "fr" ? "Action\u00A0: " : "Action: "}</span>
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