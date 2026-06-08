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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import {
  aiAssist,
  useCreateIntel,
  DEPARTMENT_LABELS,
  SEVERITY_LABELS,
  HORIZON_LABELS,
  type IntelDepartment,
  type IntelSeverity,
  type IntelHorizon,
} from "@/hooks/useIntelligenceItems";
import { toast } from "@/components/ui/sonner";

export function AddItemDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({
    headline: "",
    summary: "",
    impact: "",
    action_required: "",
    department: "operations" as IntelDepartment,
    severity: "awareness" as IntelSeverity,
    time_to_impact: "horizon" as IntelHorizon,
    affected_tags: "",
    source_name: "Manual",
    source_url: "",
    owner: "",
  });
  const createIntel = useCreateIntel();

  const runAssist = async () => {
    if (!draft.headline && !draft.source_url && !draft.summary) {
      toast.error("Paste a headline, URL, or summary first.");
      return;
    }
    setLoading(true);
    try {
      const result = await aiAssist({
        headline: draft.headline,
        summary: draft.summary,
        text: draft.summary,
        source_url: draft.source_url,
        source_name: draft.source_name,
      });
      setDraft((d) => ({
        ...d,
        headline: result.headline || d.headline,
        summary: result.summary || d.summary,
        impact: result.impact || "",
        action_required: result.action_required || "Monitor only.",
        department: (result.department as IntelDepartment) || d.department,
        severity: (result.severity as IntelSeverity) || d.severity,
        time_to_impact: (result.time_to_impact as IntelHorizon) || d.time_to_impact,
        affected_tags: (result.affected_tags || []).join(", "),
        owner: (result.owner as string) || d.owner,
      }));
      toast.success("AI fields filled — review and save.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await createIntel.mutateAsync({
        ...draft,
        affected_tags: draft.affected_tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source_url: draft.source_url || null,
        owner: draft.owner || null,
      });
      toast.success("Intelligence item created.");
      setOpen(false);
      setDraft({
        headline: "",
        summary: "",
        impact: "",
        action_required: "",
        department: "operations",
        severity: "awareness",
        time_to_impact: "horizon",
        affected_tags: "",
        source_name: "Manual",
        source_url: "",
        owner: "",
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9">
          <Plus className="w-4 h-4 mr-1" /> Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New intelligence item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label htmlFor="src-url">Source URL (optional — for AI assist)</Label>
              <Input
                id="src-url"
                value={draft.source_url}
                onChange={(e) => setDraft((d) => ({ ...d, source_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <Button onClick={runAssist} disabled={loading} variant="secondary">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              AI assist
            </Button>
          </div>
          <div>
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={draft.headline}
              onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="summary">Summary / pasted text</Label>
            <Textarea
              id="summary"
              rows={3}
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="impact">Impact</Label>
            <Textarea
              id="impact"
              rows={2}
              value={draft.impact}
              onChange={(e) => setDraft((d) => ({ ...d, impact: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="action">Action required</Label>
            <Textarea
              id="action"
              rows={2}
              value={draft.action_required}
              onChange={(e) => setDraft((d) => ({ ...d, action_required: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Department</Label>
              <Select
                value={draft.department}
                onValueChange={(v) => setDraft((d) => ({ ...d, department: v as IntelDepartment }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEPARTMENT_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select
                value={draft.severity}
                onValueChange={(v) => setDraft((d) => ({ ...d, severity: v as IntelSeverity }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time to impact</Label>
              <Select
                value={draft.time_to_impact}
                onValueChange={(v) => setDraft((d) => ({ ...d, time_to_impact: v as IntelHorizon }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(HORIZON_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tags">Affected tags (comma-separated)</Label>
              <Input
                id="tags"
                value={draft.affected_tags}
                onChange={(e) => setDraft((d) => ({ ...d, affected_tags: e.target.value }))}
                placeholder="Tanger Med, Road"
              />
            </div>
            <div>
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={draft.owner}
                onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
                placeholder="e.g. Operations lead"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="src-name">Source name</Label>
              <Input
                id="src-name"
                value={draft.source_name}
                onChange={(e) => setDraft((d) => ({ ...d, source_name: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={createIntel.isPending}>
            {createIntel.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Save item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}