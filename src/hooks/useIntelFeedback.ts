import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type IntelVote = "useful" | "not_useful";

/**
 * Stable per-browser voter id. Signed-in users use their auth uid;
 * everyone else gets an anonymous UUID persisted in localStorage so
 * likes/dislikes work without requiring sign-in.
 */
const ANON_KEY = "hitek_anon_voter_id";
function getOrCreateAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function useVoterId() {
  const [vid, setVid] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setVid(data.user?.id ?? getOrCreateAnonId());
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setVid(s?.user?.id ?? getOrCreateAnonId());
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return vid;
}

/** All of the current user's votes, keyed by item_id. */
export function useMyIntelVotes() {
  const uid = useVoterId();
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
  const uid = useVoterId();
  return useMutation({
    mutationFn: async ({
      itemId,
      next,
    }: {
      itemId: string;
      next: IntelVote | null;
    }) => {
      if (!uid) throw new Error("Voter id not ready.");
      if (next === null) {
        const { error } = await supabase.rpc("clear_intel_vote", {
          _item_id: itemId,
          _voter: uid,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("cast_intel_vote", {
          _item_id: itemId,
          _voter: uid,
          _vote: next,
        });
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
  // Kept for backwards compatibility; voting no longer requires sign-in.
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSigned(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSigned(!!s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);
  return signed;
}