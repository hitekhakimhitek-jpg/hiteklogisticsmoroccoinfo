import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateDeep } from "@/lib/translateEntries";

const DEPT_LABELS: Record<string, string> = {
  all: "Global",
  operations: "Operations",
  compliance: "Compliance",
  finance: "Finance",
  commercial: "Commercial",
  it: "IT",
};

function useLatestDigests(lang: "en" | "fr") {
  return useQuery({
    queryKey: ["weekly_digests_latest", lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_digests")
        .select("*")
        .order("year", { ascending: false })
        .order("week_number", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = data || [];
      if (lang === "fr" && rows.length > 0) {
        try {
          const payload = rows.map((r: any) => ({ id: r.id, summary_md: r.summary_md }));
          const translated = await translateDeep(payload, "fr");
          const byId = new Map(translated.map((t: any) => [t.id, t]));
          return rows.map((r: any) => {
            const t = byId.get(r.id) as any;
            return t ? { ...r, summary_md: t.summary_md ?? r.summary_md } : r;
          });
        } catch (e) {
          console.error("digest translate failed", e);
        }
      }
      return rows;
    },
    refetchInterval: 60_000,
  });
}

const WeeklyDigest = () => {
  const { lang } = useLanguage();
  const { data, isLoading } = useLatestDigests(lang);
  const [dept, setDept] = useState<string>("all");

  // Latest week first
  const latest = data?.[0];
  const filtered = data?.filter((d: any) =>
    dept === "all" ? d.department === null : d.department === dept
  );

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <header className="border-b border-border pb-6">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> {lang === "fr" ? "Synthèse hebdomadaire" : "Weekly digest"}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {lang === "fr"
            ? "L'essentiel de la semaine, par département"
            : "This week's intelligence, by department"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          {lang === "fr"
            ? "Généré automatiquement chaque lundi à 8 h, heure du Maroc. Résumés par département des 14 derniers jours."
            : "Auto-generated every Monday at 8 AM Morocco time. Per-department summaries from the last 14 days."}
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(DEPT_LABELS).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setDept(k)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              dept === k
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-card-foreground border-border hover:bg-accent"
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
          {lang === "fr"
            ? "Pas encore de synthèse pour cette vue. La prochaine sera générée lundi à 8 h, heure du Maroc."
            : "No digest yet for this view. The next one will be generated Monday at 8 AM Morocco time."}
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((d: any) => (
            <article
              key={d.id}
              className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-5"
            >
              <div className="flex items-start justify-between flex-wrap gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">
                    {lang === "fr" ? `Semaine ${d.week_number} · ${d.year}` : `Week ${d.week_number} · ${d.year}`}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {d.department ? DEPT_LABELS[d.department] : (lang === "fr" ? "Global" : "Global")}
                  </h2>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-3 items-center">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> {d.item_count} {lang === "fr" ? "éléments" : "items"}
                  </span>
                  {d.act_now_count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 font-semibold">
                      {d.act_now_count} {lang === "fr" ? "Critique" : "Critical"}
                    </span>
                  )}
                  {d.this_week_count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">
                      {d.this_week_count} {lang === "fr" ? "Important" : "Important"}
                    </span>
                  )}
                </div>
              </div>
              <DigestBody markdown={d.summary_md || ""} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default WeeklyDigest;

/**
 * Render digest markdown as cleanly-spaced sections with bold headlines.
 * The model produces lines like `* **Headline:** body text...`.
 * We strip the bullet stars and surface the headline as a larger bold title
 * with generous spacing between entries.
 */
function DigestBody({ markdown }: { markdown: string }) {
  // Strip the legacy "_Summary unavailable (402)_" placeholder so users never see the raw error string.
  const cleaned = markdown
    .replace(/^_Summary unavailable \(\d+\)_\s*/i, "")
    .trim();
  // Normalize: split by lines, group `* ...` bullets into individual entries.
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries: { title: string | null; body: string }[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^[*\-]\s+/, ""); // strip leading bullet marker
    // Match `**Title:** body` (or `**Title**: body`)
    const m = line.match(/^\*\*(.+?)\*\*\s*[:：]?\s*(.*)$/);
    if (m) {
      entries.push({ title: m[1].trim().replace(/[:：]$/, ""), body: m[2].trim() });
    } else {
      entries.push({ title: null, body: line });
    }
  }
  if (entries.length === 0) return null;
  return (
    <div className="space-y-7 text-card-foreground">
      {entries.map((e, i) => (
        <div key={i} className="space-y-2">
          {e.title && (
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
              {e.title}
            </h3>
          )}
          {e.body && (
            <div className="text-[15px] sm:text-base leading-relaxed text-muted-foreground prose prose-sm max-w-none prose-strong:text-foreground">
              <ReactMarkdown>{e.body}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}