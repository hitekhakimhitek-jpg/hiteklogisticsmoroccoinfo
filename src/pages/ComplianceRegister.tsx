import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ExternalLink, Trash2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DEPARTMENT_LABELS, type IntelDepartment } from "@/hooks/useIntelligenceItems";

type ComplianceStatus =
  | "monitoring"
  | "in_progress"
  | "compliant"
  | "non_compliant"
  | "not_applicable";

type ComplianceRow = {
  id: string;
  title: string;
  regulation_ref: string | null;
  jurisdiction: string | null;
  department: IntelDepartment | null;
  effective_date: string | null;
  deadline: string | null;
  status: ComplianceStatus;
  owner_label: string | null;
  evidence_url: string | null;
  source_url: string | null;
  notes: string | null;
  updated_at: string;
};

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  monitoring: "Monitoring",
  in_progress: "In progress",
  compliant: "Compliant",
  non_compliant: "Non-compliant",
  not_applicable: "N/A",
};

const STATUS_TONE: Record<ComplianceStatus, string> = {
  monitoring: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/20 text-warning border border-warning/40",
  compliant: "bg-success/20 text-success border border-success/40",
  non_compliant: "bg-destructive/20 text-destructive border border-destructive/40",
  not_applicable: "bg-muted text-muted-foreground",
};

const EMPTY: Partial<ComplianceRow> = {
  title: "",
  regulation_ref: "",
  jurisdiction: "Morocco",
  department: "compliance",
  status: "monitoring",
  owner_label: "",
  notes: "",
  source_url: "",
  evidence_url: "",
  effective_date: null,
  deadline: null,
};

export default function ComplianceRegister() {
  const [rows, setRows] = useState<ComplianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<ComplianceRow>>(EMPTY);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("compliance_register")
      .select("*")
      .order("deadline", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data || []) as ComplianceRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter(
    (r) => statusFilter === "all" || r.status === statusFilter
  );

  const save = async () => {
    if (!draft.title?.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      title: draft.title,
      regulation_ref: draft.regulation_ref || null,
      jurisdiction: draft.jurisdiction || null,
      department: (draft.department as IntelDepartment) || null,
      effective_date: draft.effective_date || null,
      deadline: draft.deadline || null,
      status: (draft.status as ComplianceStatus) || "monitoring",
      owner_label: draft.owner_label || null,
      evidence_url: draft.evidence_url || null,
      source_url: draft.source_url || null,
      notes: draft.notes || null,
    };
    const { error } = await supabase.from("compliance_register").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compliance item added");
    setOpen(false);
    setDraft(EMPTY);
    load();
  };

  const updateStatus = async (id: string, status: ComplianceStatus) => {
    const { error } = await supabase
      .from("compliance_register")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this compliance item?")) return;
    const { error } = await supabase.from("compliance_register").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-primary" />
            Compliance Register
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regulations and binding obligations the company tracks, with status and owner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ComplianceStatus | "all")}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABEL) as ComplianceStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-1" /> Add item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add compliance item</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Title"
                  value={draft.title || ""}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Regulation reference (e.g. Loi 86-21)"
                    value={draft.regulation_ref || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, regulation_ref: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Jurisdiction"
                    value={draft.jurisdiction || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, jurisdiction: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={draft.department || "compliance"}
                    onValueChange={(v) =>
                      setDraft({ ...draft, department: v as IntelDepartment })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DEPARTMENT_LABELS) as IntelDepartment[]).map((d) => (
                        <SelectItem key={d} value={d}>
                          {DEPARTMENT_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.status || "monitoring"}
                    onValueChange={(v) =>
                      setDraft({ ...draft, status: v as ComplianceStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as ComplianceStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Effective date</label>
                    <Input
                      type="date"
                      value={draft.effective_date || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, effective_date: e.target.value || null })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Deadline</label>
                    <Input
                      type="date"
                      value={draft.deadline || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, deadline: e.target.value || null })
                      }
                    />
                  </div>
                </div>
                <Input
                  placeholder="Owner (e.g. Compliance lead)"
                  value={draft.owner_label || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, owner_label: e.target.value })
                  }
                />
                <Input
                  placeholder="Source URL"
                  value={draft.source_url || ""}
                  onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
                />
                <Input
                  placeholder="Evidence URL (internal doc, SOP, etc.)"
                  value={draft.evidence_url || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, evidence_url: e.target.value })
                  }
                />
                <Textarea
                  placeholder="Notes"
                  value={draft.notes || ""}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={save}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No items. Add your first compliance obligation.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium max-w-sm">
                    <div className="truncate">{r.title}</div>
                    {r.jurisdiction && (
                      <div className="text-xs text-muted-foreground">{r.jurisdiction}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.regulation_ref || "—"}</TableCell>
                  <TableCell>
                    {r.department ? (
                      <Badge variant="outline">
                        {DEPARTMENT_LABELS[r.department]}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.deadline ? format(new Date(r.deadline), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.owner_label || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        updateStatus(r.id, v as ComplianceStatus)
                      }
                    >
                      <SelectTrigger
                        className={`h-8 w-36 ${STATUS_TONE[r.status]}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as ComplianceStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="flex items-center gap-1 justify-end">
                    {r.source_url && (
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-muted rounded"
                        title="Source"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => remove(r.id)}
                      className="p-1.5 hover:bg-destructive/10 text-destructive rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}