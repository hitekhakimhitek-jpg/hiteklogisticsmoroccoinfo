import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { texts, target } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const lang = target === "fr" ? "French" : "English";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Translate each string in the JSON array below to ${lang}.
Rules:
- Preserve meaning, tone, and freight/logistics terminology.
- Keep proper nouns (company names, ports, "Morocco", "Tanger Med", "ADII", "EU", etc.) as-is.
- Do NOT add or remove items. Output array length MUST equal input length.
- If a string is already in ${lang}, return it unchanged.
- Return ONLY a valid JSON array of strings. No prose, no code fences.

INPUT:
${JSON.stringify(texts)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    let content: string = data?.choices?.[0]?.message?.content ?? "[]";
    content = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    // Extract first JSON array if model added stray characters
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]");
    if (start !== -1 && end !== -1) content = content.slice(start, end + 1);

    let translations: string[] = [];
    try {
      translations = JSON.parse(content);
    } catch (e) {
      console.error("Parse error", e, content.slice(0, 200));
      translations = texts;
    }
    if (!Array.isArray(translations) || translations.length !== texts.length) {
      translations = texts;
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-text error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});