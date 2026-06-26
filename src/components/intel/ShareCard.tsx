import { forwardRef } from "react";
import { IntelligenceItem, SEVERITY_LABELS_BY_LANG } from "@/hooks/useIntelligenceItems";
import { useLanguage } from "@/contexts/LanguageContext";
import { format as formatDate } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import logoImg from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const SEV_BAR: Record<string, string> = {
  act_now: "bg-red-500",
  this_week: "bg-amber-500",
  awareness: "bg-slate-400",
};

const SEV_TEXT: Record<string, string> = {
  act_now: "text-red-600",
  this_week: "text-amber-600",
  awareness: "text-slate-600",
};

/**
 * Single-item shareable card. Rendered at a fixed 1200×630 (OG-style) so the
 * exported PNG is crisp on WhatsApp / email / LinkedIn. Reads from the same
 * intelligence_items record, so it always matches Dashboard / Map / Digest.
 */
export const ShareCard = forwardRef<HTMLDivElement, { item: IntelligenceItem }>(
  function ShareCard({ item }, ref) {
    const { lang } = useLanguage();
    const locale = lang === "fr" ? frLocale : undefined;
    const SEV = SEVERITY_LABELS_BY_LANG[lang];

    const dateStr = item.event_date || item.publication_date;
    const dateLabel = dateStr
      ? formatDate(new Date(dateStr), "d LLLL yyyy", { locale })
      : null;

    const transport = (item.transport_modes || []).join(" · ");
    const locationBits = [item.country, item.port_affected, item.airport_affected, item.lane_affected]
      .filter(Boolean)
      .join(" · ");

    return (
      <div
        ref={ref}
        style={{ width: 1200, height: 630, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
        className="bg-white text-slate-900 flex overflow-hidden relative"
      >
        {/* Severity bar */}
        <div className={cn("w-3 h-full", SEV_BAR[item.severity])} />

        <div className="flex-1 p-12 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="Hitek" className="h-12 w-12 rounded" crossOrigin="anonymous" />
              <div className="leading-tight">
                <div className="text-xl font-bold text-slate-900">Hitek</div>
                <div className="text-xs text-slate-500">Freight Intelligence</div>
              </div>
            </div>
            <div className="text-right">
              <div className={cn("text-sm font-bold uppercase tracking-wide", SEV_TEXT[item.severity])}>
                {SEV[item.severity]}
              </div>
              {dateLabel && (
                <div className="text-xs text-slate-500 mt-1">{dateLabel}</div>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="mt-8 text-[36px] font-bold leading-tight text-slate-900 line-clamp-3">
            {item.headline}
          </h1>

          {/* Meta strip */}
          {(locationBits || transport) && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {locationBits && <span>📍 {locationBits}</span>}
              {transport && <span>🚢 {transport}</span>}
              {item.carrier_affected && <span>· {item.carrier_affected}</span>}
            </div>
          )}

          {/* Why it matters */}
          {(item.why_it_matters_to_hitek || item.impact) && (
            <div className="mt-6">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {lang === "fr" ? "Pourquoi c'est important" : "Why it matters to Hitek"}
              </div>
              <p className="text-[17px] leading-snug text-slate-800 line-clamp-3">
                {item.why_it_matters_to_hitek || item.impact}
              </p>
            </div>
          )}

          {/* Suggested action */}
          {(item.suggested_action || item.action_required) && (
            <div className="mt-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {lang === "fr" ? "Action suggérée" : "Suggested action"}
              </div>
              <p className="text-[17px] leading-snug text-slate-800 line-clamp-2">
                {item.suggested_action || item.action_required}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-6 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
            <span className="font-medium text-slate-700">{item.source_name}</span>
            <span>info.hitek.ma</span>
          </div>
        </div>
      </div>
    );
  }
);