import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEPT_LABEL: Record<string, string> = {
  operations: "Operations",
  compliance: "Compliance",
  finance: "Finance",
  commercial: "Commercial",
  it: "IT",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find unalerted Act-now items
    const { data: items, error } = await supabase
      .from("intelligence_items")
      .select("*")
      .eq("severity", "act_now")
      .is("alerted_at", null)
      .neq("status", "archived")
      .limit(20);
    if (error) throw new Error(error.message);
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase.from("alert_settings").select("*").limit(1).single();
    const webhookUrl: string | null = settings?.critical_webhook_url || null;

    let sent = 0;
    for (const it of items) {
      const dept = DEPT_LABEL[it.department] || it.department;
      const recipient =
        (settings as any)?.[`recipients_${it.department}`] || "department lead";

      if (webhookUrl) {
        const payload = {
          text: `🚨 *ACT NOW — ${dept}*: ${it.headline}\n*Impact:* ${it.impact}\n*Action:* ${it.action_required}\n*Owner:* ${it.owner || recipient}\n${it.source_url ? `<${it.source_url}|Source>` : it.source_name}`,
        };
        try {
          const r = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!r.ok) console.error("webhook failed:", r.status, await r.text());
        } catch (e) {
          console.error("webhook error:", (e as Error).message);
        }
      }

      await supabase
        .from("intelligence_items")
        .update({ alerted_at: new Date().toISOString() })
        .eq("id", it.id);
      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent, webhook_configured: !!webhookUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-critical-alert error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});