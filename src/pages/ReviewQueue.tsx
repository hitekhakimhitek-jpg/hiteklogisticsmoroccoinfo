import { Loader2, Sparkles } from "lucide-react";
import { useIntelligenceItems } from "@/hooks/useIntelligenceItems";
import { IntelCard } from "@/components/intel/IntelCard";

const ReviewQueue = () => {
  const { data: items, isLoading } = useIntelligenceItems({ reviewQueue: true });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground inline-flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Review queue
        </h1>
        <p className="text-sm text-muted-foreground">
          AI-drafted intelligence items awaiting human review. Acknowledge to clear the draft badge, or archive to drop it.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !items || items.length === 0 ? (
        <div className="bg-card rounded-lg border border-border card-elevated p-12 text-center">
          <p className="text-muted-foreground">Nothing to review — you're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <IntelCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewQueue;