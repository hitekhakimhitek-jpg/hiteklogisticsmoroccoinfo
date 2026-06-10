import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const DEPT_LABELS: Record<string, string> = {
  all: "Global",
  operations: "Operations",
  compliance: "Compliance",
  finance: "Finance",
  commercial: "Commercial",
  it: "IT",
};

function useLatestDigests() {
  return useQuery({
    queryKey: ["weekly_digests_latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_digests")
        .select("*")
        .order("year", { ascending: false })
        .order("week_number", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });
}

const WeeklyDigest = () => {
  const { data, isLoading } = useLatestDigests();
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
          No digest yet for this view. The first one will be generated next Monday — or click <strong>Regenerate now</strong>.
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
              <div className="prose prose-sm max-w-none text-card-foreground whitespace-pre-wrap leading-relaxed">
                {d.summary_md}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default WeeklyDigest;