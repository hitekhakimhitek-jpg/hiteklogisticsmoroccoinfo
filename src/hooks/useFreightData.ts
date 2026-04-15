import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type DbNewsEntry = {
  id: string;
  headline: string;
  summary: string;
  full_content: string | null;
  source_url: string | null;
  source_name: string;
  category: "regulation" | "weather" | "port" | "trade" | "compliance" | "market" | "general";
  region: "morocco" | "europe" | "asia" | "americas" | "africa" | "middle_east" | "global";
  priority: "critical" | "important" | "informational";
  impact_assessment: string | null;
  action_required: boolean;
  suggested_action: string | null;
  published_date: string;
  fetched_date: string;
  week_number: number;
  month: number;
  year: number;
};

export function useNewsEntries(filters?: {
  category?: string;
  region?: string;
  priority?: string;
  search?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["news_entries", filters],
    queryFn: async () => {
      let query = supabase
        .from("news_entries")
        .select("*")
        .order("published_date", { ascending: false })
        .order("priority", { ascending: true });

      if (filters?.category) query = query.eq("category", filters.category as any);
      if (filters?.region) query = query.eq("region", filters.region as any);
      if (filters?.priority) query = query.eq("priority", filters.priority as any);
      if (filters?.search) {
        query = query.or(`headline.ilike.%${filters.search}%,summary.ilike.%${filters.search}%`);
      }
      if (filters?.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DbNewsEntry[];
    },
  });
}

export function useWeeklyReports() {
  return useQuery({
    queryKey: ["weekly_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_reports")
        .select("*")
        .order("year", { ascending: false })
        .order("week_number", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useMonthlySummaries() {
  return useQuery({
    queryKey: ["monthly_summaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_summaries")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
  });
}

export async function triggerFetchNews(enabledSources?: string[]) {
  const body: Record<string, unknown> = {};
  if (enabledSources && enabledSources.length > 0) {
    body.sources = enabledSources;
  }
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-news`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    }
  );
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || "Failed to fetch news");
  }
  return resp.json();
}

export async function triggerGenerateReport(type: "weekly" | "monthly") {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ type }),
    }
  );
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || "Failed to generate report");
  }
  return resp.json();
}
