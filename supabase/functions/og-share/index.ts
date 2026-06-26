// Public share endpoint that returns a crawler-friendly HTML page with rich
// OpenGraph / Twitter meta tags so WhatsApp, LinkedIn, Slack, etc. show a
// branded preview (logo + headline + summary) instead of a raw link.
// Real browsers are redirected to the SPA item page.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ORIGIN = "https://hiteklogisticsmoroccoinfo.lovable.app";
const FALLBACK_OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e4f4febe-2844-41d6-871c-6e39aa7cdf47/id-preview-cab0e8e0--6b088dc0-9512-4f8a-9b45-e48f76f8ff1f.lovable.app-1771602249402.png";

function esc(s: string | null | undefined): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: item } = await supabase
    .from("intelligence_items")
    .select("id, headline, summary, source_name, og_image_url, why_it_matters_to_hitek")
    .eq("id", id)
    .maybeSingle();

  const title = item?.headline || "Hitek Freight Intelligence";
  const description =
    item?.why_it_matters_to_hitek ||
    item?.summary ||
    "Freight forwarding intelligence for Morocco and global logistics.";
  const image = item?.og_image_url || FALLBACK_OG_IMAGE;
  const canonical = `${APP_ORIGIN}/item/${id}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · Hitek</title>
<meta name="description" content="${esc(description).slice(0, 300)}" />
<link rel="canonical" href="${canonical}" />

<meta property="og:type" content="article" />
<meta property="og:site_name" content="Hitek Freight Intelligence" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description).slice(0, 300)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${canonical}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description).slice(0, 300)}" />
<meta name="twitter:image" content="${esc(image)}" />

<meta http-equiv="refresh" content="0; url=${canonical}" />
<script>window.location.replace(${JSON.stringify(canonical)});</script>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#0f172a}
  a{color:#1e40af}
  .src{color:#64748b;font-size:14px;margin-top:24px}
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
<p><a href="${canonical}">Open on Hitek Info Dashboard →</a></p>
${item?.source_name ? `<p class="src">Source: ${esc(item.source_name)}</p>` : ""}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});