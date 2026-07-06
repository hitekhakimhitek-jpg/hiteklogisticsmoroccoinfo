import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_recent_intelligence",
  title: "List recent intelligence",
  description:
    "List the most recent Morocco freight & logistics intelligence items from Hitek Info, optionally filtered by department, severity, or days back.",
  inputSchema: {
    days: z.number().int().min(1).max(90).optional().describe("How many days back to look (default 7)."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
    department: z
      .enum(["operations", "finance", "compliance", "commercial", "hr"])
      .optional(),
    severity: z.enum(["act_now", "this_week", "monitor", "fyi"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, limit, department, severity }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days ?? 7));
    let q = supabase
      .from("intelligence_items")
      .select(
        "id, headline, summary, department, severity, source_name, source_url, publication_date, event_date, country",
      )
      .neq("status", "archived")
      .gte("created_at", since.toISOString())
      .order("event_date", { ascending: false, nullsFirst: false })
      .limit(limit ?? 20);
    if (department) q = q.eq("department", department);
    if (severity) q = q.eq("severity", severity);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});