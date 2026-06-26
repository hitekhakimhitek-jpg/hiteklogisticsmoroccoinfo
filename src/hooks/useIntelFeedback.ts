import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type IntelVote = "useful" | "not_useful";

function useCurrentUserId() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUid(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUid(s?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return uid;
}

/** All of the current user's votes, keyed by item_id. */
export function useMyIntelVotes() {
  const uid = useCurrentUserId();
  return useQuery({
    enabled: !!uid,
    queryKey: ["intel_feedback_mine", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intel_feedback")
        .select("item_id, vote")
        .eq("voter", uid!);
      if (error) throw error;
      const map: Record<string, IntelVote> = {};
      for (const r of data || []) map[(r as any).item_id] = (r as any).vote as IntelVote;
      return { uid, map };
    },
  });
}

/** Per-item aggregate counts (useful for displaying totals). */
export function useIntelVoteCounts() {
  return useQuery({
    queryKey: ["intel_feedback_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intel_feedback")
        .select("item_id, vote");
      if (error) throw error;
      const counts: Record<string, { useful: number; not_useful: number }> = {};
      for (const r of data || []) {
        const id = (r as any).item_id as string;
        const v = (r as any).vote as IntelVote;
        if (!counts[id]) counts[id] = { useful: 0, not_useful: 0 };
        counts[id][v]++;
      }
      return counts;
    },
    refetchInterval: 60_000,
  });
}

export function useCastIntelVote() {
  const qc = useQueryClient();
  const uid = useCurrentUserId();
  return useMutation({
    mutationFn: async ({
      itemId,
      next,
    }: {
      itemId: string;
      next: IntelVote | null;
    }) => {
      if (!uid) throw new Error("Sign in to vote.");
      if (next === null) {
        const { error } = await supabase
          .from("intel_feedback")
          .delete()
          .eq("item_id", itemId)
          .eq("voter", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("intel_feedback")
          .upsert(
            { item_id: itemId, voter: uid, vote: next },
            { onConflict: "item_id,voter" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel_feedback_mine"] });
      qc.invalidateQueries({ queryKey: ["intel_feedback_counts"] });
      // Predicted relevance refreshed by trigger — refetch items.
      qc.invalidateQueries({ queryKey: ["intel_items"] });
    },
  });
}

export function useIsSignedIn() {
  const uid = useCurrentUserId();
  return !!uid;
}