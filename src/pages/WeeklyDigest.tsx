import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText } from "lucide-react";
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold inline-flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" /> Weekly digest
        </h1>
        <p className="text-sm text-muted-foreground">
          Auto-generated every Monday at 8 AM Morocco time. Per-department summaries of the week's intelligence.
        </p>
      </div>

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
          No digest yet for this view. The first one will be generated next Monday at 8 AM Morocco time.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((d: any) => (
            <article key={d.id} className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold">
                  Week {d.week_number}, {d.year} — {d.department ? DEPT_LABELS[d.department] : "Global"}
                </h2>
                <div className="text-xs text-muted-foreground flex gap-3">
                  <span>{d.item_count} items</span>
                  {d.act_now_count > 0 && (
                    <span className="text-red-600 font-medium">{d.act_now_count} Act now</span>
                  )}
                  {d.this_week_count > 0 && (
                    <span className="text-amber-600 font-medium">{d.this_week_count} This week</span>
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
  // Normalize: split by lines, group `* ...` bullets into individual entries.
  const lines = markdown.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
    <div className="space-y-6 text-card-foreground">
      {entries.map((e, i) => (
        <div key={i} className="space-y-1.5">
          {e.title && (
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              {e.title}
            </h3>
          )}
          {e.body && (
            <div className="text-sm sm:text-[15px] leading-relaxed text-muted-foreground prose prose-sm max-w-none prose-strong:text-foreground">
              <ReactMarkdown>{e.body}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}