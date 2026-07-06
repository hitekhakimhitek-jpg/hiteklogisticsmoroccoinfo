import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_intelligence",
  title: "Search intelligence items",
  description:
    "Full-text search across Hitek Info logistics intelligence items (headlines, summaries, impacts). Returns the most recent matches.",
  inputSchema: {
    query: z.string().min(1).describe("Keyword(s) to search for."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
    department: z
      .enum(["operations", "finance", "compliance", "commercial", "hr"])
      .optional()
      .describe("Optional department filter."),
    severity: z
      .enum(["act_now", "this_week", "monitor", "fyi"])
      .optional()
      .describe("Optional severity filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit, department, severity }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    );
    let q = supabase
      .from("intelligence_items")
      .select(
        "id, headline, summary, impact, department, severity, source_name, source_url, publication_date, event_date, country",
      )
      .neq("status", "archived")
      .or(
        `headline.ilike.%${query}%,summary.ilike.%${query}%,impact.ilike.%${query}%`,
      )
      .order("event_date", { ascending: false, nullsFirst: false })
      .limit(limit ?? 10);
    if (department) q = q.eq("department", department);
    if (severity) q = q.eq("severity", severity);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});