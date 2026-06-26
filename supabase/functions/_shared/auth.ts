import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function unauthorized(msg = "Unauthorized", status = 401, headers: HeadersInit) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/**
 * Require either:
 *  - a Bearer token equal to SUPABASE_SERVICE_ROLE_KEY (used by pg_cron / server-to-server calls), OR
 *  - a valid Supabase user JWT whose email belongs to the @hitek.ma admin domain.
 *
 * Returns null when the request is authorized, or a 401/403 Response otherwise.
 */
export async function requireHitekAdmin(
  req: Request,
  headers: HeadersInit = corsHeaders,
): Promise<Response | null> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE) {
    return unauthorized("Auth not configured", 500, headers);
  }
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return unauthorized("Missing bearer token", 401, headers);

  // Server-to-server / cron path.
  if (token === SERVICE_ROLE) return null;
  if (CRON_SECRET && token === CRON_SECRET) return null;

  // Validate user JWT and check email domain.
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await client.auth.getUser(token);
    const email = data?.user?.email?.toLowerCase() || "";
    if (error || !email) return unauthorized("Invalid session", 401, headers);
    if (!email.endsWith("@hitek.ma")) {
      return unauthorized("Forbidden", 403, headers);
    }
    return null;
  } catch (_e) {
    return unauthorized("Invalid session", 401, headers);
  }
}

/**
 * Lighter check: require a valid Supabase user JWT (any authenticated user),
 * or the service-role key. Used by user-facing utility functions like translation.
 */
export async function requireAuthenticated(
  req: Request,
  headers: HeadersInit = corsHeaders,
): Promise<Response | null> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE) {
    return unauthorized("Auth not configured", 500, headers);
  }
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return unauthorized("Missing bearer token", 401, headers);
  if (token === SERVICE_ROLE) return null;
  if (CRON_SECRET && token === CRON_SECRET) return null;
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return unauthorized("Invalid session", 401, headers);
    return null;
  } catch (_e) {
    return unauthorized("Invalid session", 401, headers);
  }
}

/**
 * Block private / loopback / link-local hostnames to prevent the function from
 * being directed at internal services (Firecrawl-side SSRF guard).
 */
export function isSafeExternalUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "metadata.google.internal") return false;
  // IPv4 private ranges
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  // IPv6 loopback / link-local
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return false;
  }
  return true;
}