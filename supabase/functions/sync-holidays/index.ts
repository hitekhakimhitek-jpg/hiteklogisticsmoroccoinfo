import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuthenticated } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Public holiday API — no key required.
const NAGER = "https://date.nager.at/api/v3/PublicHolidays";

// Holiday types that typically halt port / customs operations.
const OPERATIONAL_TYPES = new Set(["Public", "Bank"]);

type NagerHoliday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  types?: string[];
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchYear(code: string, year: number): Promise<NagerHoliday[]> {
  const res = await fetch(`${NAGER}/${year}/${code}`);
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

async function refreshCountry(supabase: ReturnType<typeof createClient>, code: string) {
  const year = new Date().getUTCFullYear();
  const holidays = [...(await fetchYear(code, year)), ...(await fetchYear(code, year + 1))];
  if (holidays.length === 0) return 0;
  const rows = holidays.map((h) => ({
    country_code: code,
    holiday_date: h.date,
    local_name: h.localName || h.name,
    name_en: h.name || h.localName,
    global: h.global ?? true,
    affects_operations: (h.types ?? ["Public"]).some((t) => OPERATIONAL_TYPES.has(t)),
  }));
  const { error } = await supabase
    .from("country_holidays")
    .upsert(rows, { onConflict: "country_code,holiday_date,name_en" });
  if (error) {
    console.error(`[holidays] upsert failed for ${code}:`, error.message);
    return 0;
  }
  return rows.length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Read path is public (signed-out visitors browse the map with the anon key).
  const authError = await requireAuthenticated(req, corsHeaders, { allowAnonKey: true });
  if (authError) return authError;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const raw = typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "";

    if (!raw) {
      return new Response(JSON.stringify({ error: "countryCode (ISO alpha-2) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[A-Z]{2}$/.test(raw)) {
      return new Response(JSON.stringify({ error: "countryCode must be 2 letters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const from = todayISO();
    const to = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);

    const read = async () =>
      await supabase
        .from("country_holidays")
        .select("country_code, holiday_date, local_name, name_en, global, affects_operations")
        .eq("country_code", raw)
        .gte("holiday_date", from)
        .lte("holiday_date", to)
        .order("holiday_date", { ascending: true });

    let { data, error } = await read();
    if (error) throw error;

    // Cache miss → pull from the public holiday API, then read again.
    if (!data || data.length === 0) {
      await refreshCountry(supabase, raw);
      const again = await read();
      data = again.data ?? [];
    }

    return new Response(JSON.stringify({ countryCode: raw, holidays: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sync-holidays] failed:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});