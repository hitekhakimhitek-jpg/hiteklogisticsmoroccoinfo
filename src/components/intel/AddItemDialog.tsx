import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { SEVERITY_LABELS, type IntelSeverity } from "@/hooks/useIntelligenceItems";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

export function AddItemDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [severity, setSeverity] = useState<IntelSeverity>("awareness");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();
  const { lang } = useLanguage();

  const t = (en: string, fr: string) => (lang === "fr" ? fr : en);

  const reset = () => {
    setUrl("");
    setSeverity("awareness");
  };

  const handleSave = async () => {
    const link = url.trim();
    if (!/^https?:\/\//i.test(link)) {
      toast.error(t("Enter a valid URL (https://…)", "Entrez une URL valide (https://…)"));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-intel", {
        body: { mode: "scrape_create", url: link, severity },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(t("Source added — AI generated the summary.", "Source ajoutée — l'IA a généré le résumé."));
      await qc.invalidateQueries({ queryKey: ["intelligence_items"] });
      await qc.invalidateQueries({ queryKey: ["intel_counts"] });
      setOpen(false);
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9">
          <Plus className="w-4 h-4 mr-1" /> {t("Add source", "Ajouter une source")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary" />
            {t("Add a source", "Ajouter une source")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t(
              "Paste the article URL and pick a severity. The AI will scrape the page and write the headline, summary, impact and action.",
              "Collez l'URL de l'article et choisissez une gravité. L'IA va analyser la page et rédiger le titre, le résumé, l'impact et l'action."
            )}
          </p>
          <div>
            <Label htmlFor="src-url">{t("Source URL", "URL source")}</Label>
            <Input
              id="src-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              autoFocus
            />
          </div>
          <div>
            <Label>{t("Severity", "Gravité")}</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as IntelSeverity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["act_now", "this_week", "awareness"] as IntelSeverity[]).map((k) => (
                  <SelectItem key={k} value={k}>{SEVERITY_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            {t("Cancel", "Annuler")}
          </Button>
          <Button onClick={handleSave} disabled={submitting || !url.trim()}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {submitting
              ? t("Scraping & drafting…", "Analyse en cours…")
              : t("Scrape & save", "Analyser et sauvegarder")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}