import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the article IDs to classify (passed in body, or classify all unclassified)
    const body = await req.json().catch(() => ({}));
    const articleIds: string[] | undefined = body.article_ids;

    let query = supabase
      .from("news_entries")
      .select("id, headline, summary, full_content, source_name, source_url, category, region, priority, impact_assessment, suggested_action, action_required")
      .is("classification_metadata", null)
      .order("published_date", { ascending: false })
      .limit(50);

    if (articleIds && articleIds.length > 0) {
      query = supabase
        .from("news_entries")
        .select("id, headline, summary, full_content, source_name, source_url, category, region, priority, impact_assessment, suggested_action, action_required")
        .in("id", articleIds);
    }

    const { data: articles, error: fetchError } = await query;
    if (fetchError) throw new Error(`Failed to fetch articles: ${fetchError.message}`);
    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, classified: 0, message: "No articles to classify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Classifying ${articles.length} articles for Finance/IT relevance...`);

    // Process in batches of 15 to avoid token limits
    const BATCH_SIZE = 15;
    let totalClassified = 0;

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);

      const articleDescriptions = batch.map((a, idx) =>
        `[${idx}] ID: ${a.id}
HEADLINE: ${a.headline}
SOURCE: ${a.source_name}
CATEGORY: ${a.category}
SUMMARY: ${a.summary}
IMPACT: ${a.impact_assessment || "N/A"}
CONTENT PREVIEW: ${(a.full_content || "").substring(0, 300) || "N/A"}`
      ).join("\n\n---\n\n");

      const prompt = `You are a classification expert for a freight forwarding / logistics company based in Morocco. Your job is to score each article's relevance to two specific department views: FINANCE and IT.

CONTEXT: This company handles import/export, customs clearance, maritime/air freight, and logistics in Morocco. The Finance department manages taxes, duties, exchange rates, budgets, banking, customs fees, and fiscal compliance. The IT department manages cybersecurity, cloud infrastructure, enterprise systems (ERP, WMS, TMS), and technology operations.

## FINANCE SECTION RULES (score 0-100)

INCLUDE (score 70-100):
- Moroccan fiscal policy: tax laws (TVA, IS, IR), customs duties, loi de finances, ADII tariff changes
- Central bank policy: Bank Al-Maghrib interest rates, dirham exchange rate policy, monetary circulars
- Government fiscal decrees: Bulletin Officiel fiscal content, DGI circulars
- International trade finance: Letters of credit rules, payment term regulations, trade finance standards
- Customs duty changes affecting import/export costs
- Major macroeconomic events with direct impact on Morocco trade costs (e.g., EU trade agreement changes, currency volatility)
- Banking regulations affecting corporate treasury or trade payments
- Fintech/payment systems with real impact on B2B trade payments

EXCLUDE (score 0-30):
- General business news that merely mentions money or costs
- Consumer financial products or retail banking
- Cryptocurrency hype or speculation without institutional finance relevance
- Stock market commentary about tech companies
- Startup funding rounds
- Generic economic forecasts without specific Morocco/trade impact
- Political news unless it directly changes fiscal/trade policy
- Shipping rate fluctuations (operational, not finance-department concern)
- Port congestion or logistics delays (operational)

BORDERLINE (score 30-69):
- Articles that touch on finance topics but are primarily about something else
- General market reports that don't specifically affect Morocco trade finance

## IT SECTION RULES (score 0-100)

INCLUDE (score 70-100):
- Cybersecurity: CVEs, ransomware campaigns, data breaches affecting enterprise/logistics
- Enterprise IT: ERP, WMS, TMS, port community system updates
- Cloud infrastructure: AWS/Azure/Google Cloud security bulletins, outages, major updates
- Microsoft enterprise: Windows Server patches, Active Directory, M365 security
- Network security: firewall, VPN, DNS, DDoS advisories
- AI for enterprise: governance frameworks, deployment security, productivity tools with IT implications
- CISA/NIST advisories, ISO 27001, SOC 2 changes
- DevOps/infrastructure: Kubernetes, Docker, CI/CD security
- Major software vulnerabilities affecting enterprise environments
- IT compliance: GDPR enforcement, data protection regulations

EXCLUDE (score 0-30):
- Consumer gadget reviews or launches
- Gaming news
- Social media platform drama
- Celebrity tech opinions
- General "AI will change everything" hype articles
- Consumer app updates (unless enterprise-relevant)
- Startup gossip or funding without IT infrastructure relevance
- Entertainment technology
- Product marketing disguised as news
- Shipping/logistics operational news (belongs in main dashboard)

BORDERLINE (score 30-69):
- AI research papers without clear enterprise deployment impact
- Tech company earnings (unless they signal platform changes)
- General tech policy discussions without specific IT operational impact

## VALIDATION RULES

Before assigning a score >= 70:
1. Would a Finance director / IT manager specifically seek out this article?
2. Does it require action or awareness from that specific department?
3. Is the article PRIMARILY about this department's domain, not tangentially?
4. Could it be better classified under the main freight/logistics dashboard instead?

If the answer to #1 or #2 is NO, the score must be below 70.
If the answer to #4 is YES, reduce the score by 20 points.

## OUTPUT FORMAT

Return a JSON array with one object per article:
{
  "index": <number matching [index] above>,
  "finance_score": <0-100>,
  "it_score": <0-100>,
  "finance_reason": "<1 sentence why this score>",
  "it_reason": "<1 sentence why this score>",
  "primary_fit": "finance" | "it" | "general" | "logistics"
}

Articles:

${articleDescriptions}

Return ONLY a valid JSON array. No markdown fences, no explanation.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`AI classification error for batch ${i}:`, aiResponse.status, errText);
        continue;
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let classifications;
      try {
        classifications = JSON.parse(content);
      } catch {
        // Try to salvage truncated JSON
        try {
          const lastObj = content.lastIndexOf("}");
          if (lastObj > 0) {
            classifications = JSON.parse(content.substring(0, lastObj + 1) + "]");
          } else {
            throw new Error("No salvageable JSON");
          }
        } catch {
          console.error(`Failed to parse classification batch ${i}:`, content.substring(0, 300));
          continue;
        }
      }

      if (!Array.isArray(classifications)) continue;

      // Update each article with its scores
      for (const cls of classifications) {
        const article = batch[cls.index];
        if (!article) continue;

        const financeScore = Math.max(0, Math.min(100, Math.round(cls.finance_score || 0)));
        const itScore = Math.max(0, Math.min(100, Math.round(cls.it_score || 0)));

        const { error: updateError } = await supabase
          .from("news_entries")
          .update({
            finance_score: financeScore,
            it_score: itScore,
            classification_metadata: {
              finance_reason: cls.finance_reason || null,
              it_reason: cls.it_reason || null,
              primary_fit: cls.primary_fit || "general",
              classified_at: new Date().toISOString(),
            },
          })
          .eq("id", article.id);

        if (updateError) {
          console.error(`Failed to update article ${article.id}:`, updateError.message);
        } else {
          totalClassified++;
        }
      }
    }

    console.log(`Successfully classified ${totalClassified} articles`);

    return new Response(
      JSON.stringify({ success: true, classified: totalClassified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("classify-sections error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
