import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_weekly_digest",
  title: "Get weekly digest",
  description:
    "Fetch the Hitek Info weekly digest summaries (global, operational, financial) for a given ISO year & week. Defaults to the current week.",
  inputSchema: {
    year: z.number().int().min(2020).max(2100).optional(),
    week: z.number().int().min(1).max(53).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ year, week }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    let q = supabase.from("weekly_digests").select("*");
    if (year) q = q.eq("year", year);
    if (week) q = q.eq("week_number", week);
    const { data, error } = await q
      .order("year", { ascending: false })
      .order("week_number", { ascending: false })
      .limit(10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { digests: data ?? [] },
    };
  },
});