import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireAuthenticated } from "../_shared/auth.ts";

// Hard limits to prevent AI-gateway credit drain.
const MAX_TEXTS = 100;
const MAX_TEXT_LEN = 5_000;
const MAX_TOTAL_CHARS = 50_000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const authErr = await requireAuthenticated(req);
  if (authErr) return authErr;
  try {
    const { texts, target } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (texts.length > MAX_TEXTS) {
      return new Response(
        JSON.stringify({ error: `Too many texts (max ${MAX_TEXTS})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let total = 0;
    for (const t of texts) {
      if (typeof t !== "string") {
        return new Response(JSON.stringify({ error: "texts must be strings" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (t.length > MAX_TEXT_LEN) {
        return new Response(
          JSON.stringify({ error: `Single text exceeds ${MAX_TEXT_LEN} chars` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      total += t.length;
    }
    if (total > MAX_TOTAL_CHARS) {
      return new Response(
        JSON.stringify({ error: `Combined text exceeds ${MAX_TOTAL_CHARS} chars` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (target !== "fr" && target !== "en") {
      return new Response(JSON.stringify({ error: "target must be 'fr' or 'en'" }), {
        status: 400,
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

    const prompt = `You are a professional translator. Translate EVERY string in the JSON array below into ${lang}.
Rules:
- Translate ALL strings, even short ones. Do not echo English back.
- Preserve meaning, tone, and freight/logistics terminology.
- Keep proper nouns (company names, ports, "Morocco", "Tanger Med", "ADII", "EU", "Maersk", "DHL", "Amazon", "WTO", "ICC", currencies, route codes) as-is.
- Convert idioms naturally — do not transliterate.
- If a string is ALREADY fully in ${lang}, return it unchanged. Otherwise it MUST be translated.
- Output array length MUST equal input length. Same order.
- Return ONLY a valid JSON array of strings. No prose, no code fences, no keys.

INPUT (translate to ${lang}):
${JSON.stringify(texts)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You translate JSON arrays of strings into ${lang}. You MUST translate every English (or non-${lang}) string. Output only a JSON array of the same length, same order.`,
          },
          { role: "user", content: prompt },
        ],
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