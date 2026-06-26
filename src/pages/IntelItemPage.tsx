import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IntelligenceItem } from "@/hooks/useIntelligenceItems";
import { IntelCard } from "@/components/intel/IntelCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function IntelItemPage() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useLanguage();

  const { data, isLoading, error } = useQuery({
    queryKey: ["intel_item", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intelligence_items")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as IntelligenceItem | null;
    },
    enabled: !!id,
  });

  return (
    <div className="container max-w-3xl py-6 space-y-4">
      <Link to="/">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {lang === "fr" ? "Retour" : "Back"}
        </Button>
      </Link>
      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error && <div className="text-destructive">Error loading item.</div>}
      {!isLoading && !data && (
        <div className="text-muted-foreground">
          {lang === "fr" ? "Élément introuvable." : "Item not found."}
        </div>
      )}
      {data && <IntelCard item={data} />}
    </div>
  );
}