import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CustomSource = { id: string; name: string; homepage: string | null };

export function useCustomSources(enabled: boolean) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["custom_sources"],
    enabled,
    queryFn: async (): Promise<CustomSource[]> => {
      const { data, error } = await supabase
        .from("sources")
        .select("id,name,homepage")
        .eq("source_type", "custom")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async ({ name, homepage }: { name: string; homepage: string }) => {
      const { error } = await supabase.from("sources").insert({
        name,
        homepage,
        source_type: "custom",
        fetch_method: "firecrawl",
        tier: 3,
        language: "en",
        enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_sources"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_sources"] }),
  });

  return { sources: list.data ?? [], isLoading: list.isLoading, add, remove };
}
