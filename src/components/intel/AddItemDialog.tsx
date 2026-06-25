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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Sparkles } from "lucide-react";
import {
  SEVERITY_LABELS,
  DEPARTMENT_LABELS,
  type IntelSeverity,
  type IntelDepartment,
} from "@/hooks/useIntelligenceItems";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

export function AddItemDialog() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"auto" | "manual">("auto");
  // Auto mode
  const [url, setUrl] = useState("");
  const [severity, setSeverity] = useState<IntelSeverity>("awareness");
  // Manual mode
  const [mHeadline, setMHeadline] = useState("");
  const [mSummary, setMSummary] = useState("");
  const [mImpact, setMImpact] = useState("");
  const [mAction, setMAction] = useState("");
  const [mDept, setMDept] = useState<IntelDepartment>("operations");
  const [mSev, setMSev] = useState<IntelSeverity>("awareness");
  const [mSourceName, setMSourceName] = useState("");
  const [mSourceUrl, setMSourceUrl] = useState("");
  const [mPubDate, setMPubDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();
  const { lang } = useLanguage();

  const t = (en: string, fr: string) => (lang === "fr" ? fr : en);

  const reset = () => {
    setUrl("");
    setSeverity("awareness");
    setMHeadline(""); setMSummary(""); setMImpact(""); setMAction("");
    setMDept("operations"); setMSev("awareness");
    setMSourceName(""); setMSourceUrl(""); setMPubDate("");
    setTab("auto");
  };

  const handleAutoSave = async () => {
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

  const handleManualSave = async () => {
    if (!mHeadline.trim() || !mAction.trim()) {
      toast.error(t("Headline and Action are required.", "Le titre et l'action sont requis."));
      return;
    }
    setSubmitting(true);
    try {
      const sourceName = mSourceName.trim() || (() => {
        try { return new URL(mSourceUrl).hostname.replace(/^www\./, ""); } catch { return "Manual"; }
      })();
      const { error } = await supabase.from("intelligence_items").insert({
        headline: mHeadline.trim(),
        summary: mSummary.trim() || null,
        impact: mImpact.trim() || null,
        action_required: mAction.trim(),
        department: mDept,
        severity: mSev,
        time_to_impact: "this_week",
        affected_tags: [],
        source_name: sourceName,
        source_url: mSourceUrl.trim() || null,
        owner: null,
        status: "new",
        is_ai_draft: false,
        publication_date: mPubDate || null,
        verification_status: "verified",
      });
      if (error) throw error;
      toast.success(t("Manual entry added.", "Entrée manuelle ajoutée."));
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary" />
            {t("Add a source", "Ajouter une source")}
          </DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "auto" | "manual")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="auto">{t("Automatic (URL)", "Automatique (URL)")}</TabsTrigger>
            <TabsTrigger value="manual">{t("Manual entry", "Entrée manuelle")}</TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">
              {t(
                "Paste the article URL and pick a severity. The AI will scrape the page and write the headline, summary, impact and action.",
                "Collez l'URL de l'article et choisissez une gravité. L'IA va analyser la page et rédiger le titre, le résumé, l'impact et l'action."
              )}
            </p>
            <div>
              <Label htmlFor="src-url">{t("Source URL", "URL source")}</Label>
              <Input id="src-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." autoFocus />
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
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                {t("Cancel", "Annuler")}
              </Button>
              <Button onClick={handleAutoSave} disabled={submitting || !url.trim()}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {submitting ? t("Scraping & drafting…", "Analyse en cours…") : t("Scrape & save", "Analyser et sauvegarder")}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              {t(
                "Fill in every field yourself. Use this when scraping fails or the source isn't online.",
                "Remplissez chaque champ vous-même. Utile si le scraping échoue ou si la source n'est pas en ligne."
              )}
            </p>
            <div>
              <Label htmlFor="m-headline">{t("Headline *", "Titre *")}</Label>
              <Input id="m-headline" value={mHeadline} onChange={(e) => setMHeadline(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-summary">{t("Summary", "Résumé")}</Label>
              <Textarea id="m-summary" rows={2} value={mSummary} onChange={(e) => setMSummary(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-impact">{t("Impact", "Impact")}</Label>
              <Textarea id="m-impact" rows={2} value={mImpact} onChange={(e) => setMImpact(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-action">{t("Action required *", "Action requise *")}</Label>
              <Textarea id="m-action" rows={2} value={mAction} onChange={(e) => setMAction(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Department", "Département")}</Label>
                <Select value={mDept} onValueChange={(v) => setMDept(v as IntelDepartment)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DEPARTMENT_LABELS) as IntelDepartment[]).map((k) => (
                      <SelectItem key={k} value={k}>{DEPARTMENT_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Severity", "Gravité")}</Label>
                <Select value={mSev} onValueChange={(v) => setMSev(v as IntelSeverity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["act_now", "this_week", "awareness"] as IntelSeverity[]).map((k) => (
                      <SelectItem key={k} value={k}>{SEVERITY_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="m-srcname">{t("Source name", "Nom de la source")}</Label>
                <Input id="m-srcname" value={mSourceName} onChange={(e) => setMSourceName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="m-pub">{t("Publication date", "Date de publication")}</Label>
                <Input id="m-pub" type="date" value={mPubDate} onChange={(e) => setMPubDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="m-srcurl">{t("Source URL", "URL source")}</Label>
              <Input id="m-srcurl" value={mSourceUrl} onChange={(e) => setMSourceUrl(e.target.value)} placeholder="https://..." />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                {t("Cancel", "Annuler")}
              </Button>
              <Button onClick={handleManualSave} disabled={submitting || !mHeadline.trim() || !mAction.trim()}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {t("Save", "Sauvegarder")}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}