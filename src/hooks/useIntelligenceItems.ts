import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateDeep } from "@/lib/translateEntries";

export type IntelDepartment = "operations" | "compliance" | "finance" | "commercial" | "it";
export type IntelSeverity = "act_now" | "this_week" | "awareness";
export type IntelStatus = "new" | "acknowledged" | "actioned" | "archived";
export type IntelHorizon = "today" | "this_week" | "this_month" | "horizon";

export type IntelligenceItem = {
  id: string;
  headline: string;
  summary: string;
  impact: string;
  action_required: string;
  department: IntelDepartment;
  severity: IntelSeverity;
  time_to_impact: IntelHorizon;
  time_to_impact_date: string | null;
  affected_tags: string[];
  source_name: string;
  source_url: string | null;
  owner: string | null;
  status: IntelStatus;
  is_ai_draft: boolean;
  source_entry_id: string | null;
  language: string;
  created_at: string;
  updated_at: string;
  last_reviewed_at: string | null;
};

export type IntelFilters = {
  department?: IntelDepartment | "all";
  severity?: IntelSeverity | "all";
  status?: IntelStatus | "all";
  reviewQueue?: boolean;
  search?: string;
  limit?: number;
};

const SEVERITY_ORDER: Record<IntelSeverity, number> = {
  act_now: 0,
  this_week: 1,
  awareness: 2,
};

export function useIntelligenceItems(filters: IntelFilters = {}) {
  const { lang } = useLanguage();
  return useQuery({
    queryKey: ["intel_items", filters, lang],
    queryFn: async () => {
      let q = supabase.from("intelligence_items").select("*");
      // Auto-archive: only show items from the last 14 days
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("created_at", twoWeeksAgo);
      if (filters.department && filters.department !== "all") {
        q = q.eq("department", filters.department);
      }
      if (filters.severity && filters.severity !== "all") {
        q = q.eq("severity", filters.severity);
      }
      if (filters.status && filters.status !== "all") {
        q = q.eq("status", filters.status);
      } else if (!filters.reviewQueue) {
        q = q.neq("status", "archived");
      }
      if (filters.reviewQueue) {
        q = q.eq("is_ai_draft", true).eq("status", "new");
      }
      if (filters.search) {
        q = q.or(
          `headline.ilike.%${filters.search}%,summary.ilike.%${filters.search}%,impact.ilike.%${filters.search}%`
        );
      }
      q = q.order("created_at", { ascending: false }).limit(filters.limit || 200);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as IntelligenceItem[];
      // Sort by severity then recency client-side
      const sorted = [...rows].sort((a, b) => {
        const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (s !== 0) return s;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      if (lang === "fr" && sorted.length > 0) {
        try {
          // Translate only the user-facing text fields, preserve everything else.
          const payload = sorted.map((r) => ({
            id: r.id,
            headline: r.headline,
            summary: r.summary,
            impact: r.impact,
            action_required: r.action_required,
          }));
          const translated = await translateDeep(payload, "fr");
          const byId = new Map(translated.map((t: any) => [t.id, t]));
          return sorted.map((r) => {
            const t = byId.get(r.id) as any;
            return t
              ? {
                  ...r,
                  headline: t.headline ?? r.headline,
                  summary: t.summary ?? r.summary,
                  impact: t.impact ?? r.impact,
                  action_required: t.action_required ?? r.action_required,
                }
              : r;
          });
        } catch (e) {
          console.error("intel translate failed", e);
          return sorted;
        }
      }
      return sorted;
    },
    refetchInterval: 60_000,
  });
}

export function useIntelCounts() {
  return useQuery({
    queryKey: ["intel_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intelligence_items")
        .select("severity,department,status,is_ai_draft");
      if (error) throw error;
      const counts = {
        act_now: 0,
        this_week: 0,
        awareness: 0,
        by_dept: {} as Record<string, number>,
        review_pending: 0,
      };
      for (const r of data || []) {
        if ((r as any).status === "archived") continue;
        const sev = (r as any).severity as IntelSeverity;
        if (sev in counts) (counts as any)[sev]++;
        const d = (r as any).department as string;
        counts.by_dept[d] = (counts.by_dept[d] || 0) + 1;
        if ((r as any).is_ai_draft && (r as any).status === "new") counts.review_pending++;
      }
      return counts;
    },
    refetchInterval: 60_000,
  });
}

export function useUpdateIntelStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IntelStatus }) => {
      const patch: Record<string, unknown> = { status, last_reviewed_at: new Date().toISOString() };
      if (status === "acknowledged" || status === "actioned") patch.is_ai_draft = false;
      const { error } = await supabase.from("intelligence_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel_items"] });
      qc.invalidateQueries({ queryKey: ["intel_counts"] });
    },
  });
}

export function useCreateIntel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<IntelligenceItem>) => {
      const { data, error } = await supabase
        .from("intelligence_items")
        .insert({
          headline: item.headline || "Untitled",
          summary: item.summary || "",
          impact: item.impact || "",
          action_required: item.action_required || "Monitor only.",
          department: (item.department as IntelDepartment) || "operations",
          severity: (item.severity as IntelSeverity) || "awareness",
          time_to_impact: (item.time_to_impact as IntelHorizon) || "horizon",
          affected_tags: item.affected_tags || [],
          source_name: item.source_name || "Manual",
          source_url: item.source_url || null,
          owner: item.owner || null,
          is_ai_draft: !!item.is_ai_draft,
          status: "new",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as IntelligenceItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel_items"] });
      qc.invalidateQueries({ queryKey: ["intel_counts"] });
    },
  });
}

export async function aiAssist(input: {
  headline?: string;
  summary?: string;
  text?: string;
  source_url?: string;
  source_name?: string;
}) {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-intel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ mode: "assist", ...input }),
    }
  );
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw new Error(e.error || "AI assist failed");
  }
  const data = await resp.json();
  return data.draft as Partial<IntelligenceItem>;
}

export async function triggerEnrichBatch(limit = 30) {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-intel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ limit }),
    }
  );
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw new Error(e.error || "Enrichment failed");
  }
  return resp.json() as Promise<{ success: boolean; created: number; failed: number; considered: number }>;
}

export const DEPARTMENT_LABELS: Record<IntelDepartment, string> = {
  operations: "Operations",
  compliance: "Compliance",
  finance: "Finance",
  commercial: "Commercial",
  it: "IT",
};

export const SEVERITY_LABELS: Record<IntelSeverity, string> = {
  act_now: "Act now",
  this_week: "This week",
  awareness: "Awareness",
};

export const HORIZON_LABELS: Record<IntelHorizon, string> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
  horizon: "Horizon",
};