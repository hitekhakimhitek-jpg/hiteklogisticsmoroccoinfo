import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scrape source URLs with Firecrawl and extract the publication date from
// page metadata or article body. Updates intelligence_items.publication_date
// + verification_status. Designed to be idempotent and chunkable.

function pickDateFromMeta(meta: any): string | null {
  if (!meta) return null;
  const candidates = [
    meta.publishedTime,
    meta.publishDate,
    meta.published_time,
    meta.article?.published_time,
    meta["article:published_time"],
    meta.datePublished,
    meta.date,
    meta.pubdate,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 4) {
      const d = new Date(c);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

async function extractDateWithAI(LOVABLE_API_KEY: string, markdown: string, url: string): Promise<string | null> {
  if (!markdown) return null;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: 'Extract the original publication date of this article. Return ONLY JSON: {"date":"YYYY-MM-DD"} or {"date":null}. Do not guess; if the article does not show a clear publication date, return null.' },
        { role: "user", content: `URL: ${url}\n\nFirst 4000 chars of article:\n${markdown.slice(0, 4000)}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 60,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  try {
    const parsed = JSON.parse((data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g, ""));
    if (parsed?.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return parsed.date;
  } catch { /* ignore */ }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 25, 50);

    // Pick items that need date verification AND have a source URL.
    const { data: items, error } = await supabase
      .from("intelligence_items")
      .select("id, source_url, publication_date, verification_status")
      .not("source_url", "is", null)
      .neq("status", "archived")
      .or("publication_date.is.null,verification_status.eq.date_not_verified,verification_status.eq.needs_review")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    let verified = 0;
    let stillUnverified = 0;
    let broken = 0;

    for (const item of items || []) {
      const url = item.source_url as string;
      try {
        const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
        });
        if (!fcResp.ok) {
          broken++;
          await supabase.from("intelligence_items").update({ verification_status: "broken_link" }).eq("id", item.id);
          continue;
        }
        const fcData = await fcResp.json();
        const doc = fcData?.data ?? fcData;
        const meta = doc?.metadata || {};
        const markdown: string = doc?.markdown || "";

        let date = pickDateFromMeta(meta);
        if (!date) date = await extractDateWithAI(LOVABLE_API_KEY, markdown, url);

        if (date) {
          verified++;
          await supabase
            .from("intelligence_items")
            .update({ publication_date: date, verification_status: "verified" })
            .eq("id", item.id);
        } else {
          stillUnverified++;
          await supabase
            .from("intelligence_items")
            .update({ verification_status: "date_not_verified" })
            .eq("id", item.id);
        }
      } catch (e) {
        broken++;
        console.error("verify-dates error:", (e as Error).message);
      }
    }

    // Auto-archive anything older than 14 days while we're here.
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { count: archived } = await supabase
      .from("intelligence_items")
      .update({ status: "archived" }, { count: "exact" })
      .lt("created_at", cutoff)
      .neq("status", "archived");

    return new Response(
      JSON.stringify({ success: true, considered: items?.length || 0, verified, stillUnverified, broken, archived: archived ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});