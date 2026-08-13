import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateRecords } from "@/lib/translateEntries";
import { REGIONS, REGION_LABELS_FR, regionOf, type Region } from "@/data/regions";
import { CalendarDays, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ISO3 } from "@/data/iso3to2";
import { Button } from "@/components/ui/button";

type Row = {
  country_code: string;
  country_name: string | null;
  holiday_date: string;
  name_en: string;
  local_name: string;
  affects_operations: boolean;
};

const DAYS_AHEAD = 45;

const COUNTRY_BY_A2 = new Map(
  Object.values(ISO3).map((country) => [country.a2, country]),
);

type HolidayCalendarProps = {
  onCountryClick?: (countryCode: string) => void;
};

export function HolidayCalendar({ onCountryClick }: HolidayCalendarProps) {
  const { lang } = useLanguage();
  const [region, setRegion] = useState<Region | "all">("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const until = new Date(Date.now() + DAYS_AHEAD * 86400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("country_holidays")
        .select("country_code, country_name, holiday_date, name_en, local_name, affects_operations")
        .gte("holiday_date", today)
        .lte("holiday_date", until)
        .order("holiday_date", { ascending: true })
        .limit(1000);
      if (error) console.error("holiday calendar load failed", error);
      let list = (data || []) as Row[];
      if (lang === "fr" && list.length > 0) {
        try {
          list = await translateRecords(list, ["name_en"], "fr");
        } catch (e) {
          console.error("holiday translate failed", e);
        }
      }
      if (!cancelled) {
        setRows(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  const filtered = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter((r) => {
      if (region !== "all" && regionOf(r.country_code) !== region) return false;
      const key = `${r.country_code}|${r.holiday_date}|${r.name_en}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rows, region]);

  const label = (r: Region | "all") =>
    r === "all"
      ? lang === "fr" ? "Toutes les régions" : "All regions"
      : lang === "fr" ? REGION_LABELS_FR[r] : r;

  const countryLabel = (row: Row) => {
    const country = COUNTRY_BY_A2.get(row.country_code.toUpperCase());
    if (country) return lang === "fr" ? country.fr : country.name;
    return row.country_name || row.country_code;
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          {lang === "fr" ? "Jours fériés à venir" : "Upcoming public holidays"}
        </h2>
        <span className="text-xs text-muted-foreground">
          {lang === "fr"
            ? `Prochains ${DAYS_AHEAD} jours · ${filtered.length} jours fériés`
            : `Next ${DAYS_AHEAD} days · ${filtered.length} holidays`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...REGIONS] as (Region | "all")[]).map((r) => (
          <Button
            key={r}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRegion(r)}
            className={cn(
              "h-8 rounded-full text-xs transition-colors",
              region === r
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {label(r)}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {lang === "fr" ? "Chargement…" : "Loading…"}
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {lang === "fr"
            ? "Aucun jour férié à venir pour cette région."
            : "No upcoming holidays for this region."}
        </p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Date</th>
                <th className="text-left font-medium px-3 py-2">{lang === "fr" ? "Pays" : "Country"}</th>
                <th className="text-left font-medium px-3 py-2">{lang === "fr" ? "Jour férié" : "Holiday"}</th>
                <th className="text-right font-medium px-3 py-2">{lang === "fr" ? "Opérations" : "Operations"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={`${r.country_code}-${r.holiday_date}-${r.name_en}`} className="hover:bg-muted/40">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {format(new Date(r.holiday_date), "EEE d MMM", lang === "fr" ? { locale: frLocale } : undefined)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto justify-start p-0 text-left font-medium"
                      onClick={() => onCountryClick?.(r.country_code)}
                    >
                      {countryLabel(r)}
                    </Button>
                  </td>
                  <td className="px-3 py-2">{r.name_en}</td>
                  <td className="px-3 py-2 text-right">
                    {r.affects_operations && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                        {lang === "fr" ? "Fermé" : "Closed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
