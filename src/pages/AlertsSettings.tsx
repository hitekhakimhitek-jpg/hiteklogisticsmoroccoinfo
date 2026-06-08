import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

type Settings = {
  id?: string;
  critical_webhook_url: string | null;
  recipients_operations: string | null;
  recipients_compliance: string | null;
  recipients_finance: string | null;
  recipients_commercial: string | null;
  recipients_it: string | null;
  weekly_digest_enabled: boolean;
};

const empty: Settings = {
  critical_webhook_url: "",
  recipients_operations: "",
  recipients_compliance: "",
  recipients_finance: "",
  recipients_commercial: "",
  recipients_it: "",
  weekly_digest_enabled: true,
};

const AlertsSettings = () => {
  const [settings, setSettings] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("alert_settings").select("*").limit(1).single();
      if (data) setSettings({ ...empty, ...data });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        critical_webhook_url: settings.critical_webhook_url || null,
        recipients_operations: settings.recipients_operations || null,
        recipients_compliance: settings.recipients_compliance || null,
        recipients_finance: settings.recipients_finance || null,
        recipients_commercial: settings.recipients_commercial || null,
        recipients_it: settings.recipients_it || null,
        weekly_digest_enabled: settings.weekly_digest_enabled,
      };
      let res;
      if (settings.id) {
        res = await supabase.from("alert_settings").update(payload).eq("id", settings.id);
      } else {
        res = await supabase.from("alert_settings").insert(payload);
      }
      if (res.error) throw res.error;
      toast.success("Alert settings saved.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold inline-flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" /> Alerts & recipients
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure who gets notified when critical (Act now) intelligence appears. Webhook is Slack-compatible.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div>
          <Label htmlFor="webhook">Critical alert webhook URL (Slack / Teams / custom)</Label>
          <Input
            id="webhook"
            value={settings.critical_webhook_url ?? ""}
            onChange={(e) =>
              setSettings((s) => ({ ...s, critical_webhook_url: e.target.value }))
            }
            placeholder="https://hooks.slack.com/services/..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            When a new Act-now item is created, a message is posted here automatically.
          </p>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <h2 className="font-semibold">Department recipients</h2>
          {(
            [
              ["recipients_operations", "Operations"],
              ["recipients_compliance", "Compliance"],
              ["recipients_finance", "Finance"],
              ["recipients_commercial", "Commercial"],
              ["recipients_it", "IT"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="font-normal text-muted-foreground">{label}</Label>
              <Input
                value={(settings as any)[key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value } as Settings))}
                placeholder="e.g. ops-lead@hitek.ma"
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Labels shown in alert messages and on items. Email sending requires email infrastructure (set up separately).
          </p>
        </div>

        <div className="border-t border-border pt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.weekly_digest_enabled}
              onChange={(e) =>
                setSettings((s) => ({ ...s, weekly_digest_enabled: e.target.checked }))
              }
            />
            Generate weekly digest every Monday at 8 AM
          </label>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AlertsSettings;