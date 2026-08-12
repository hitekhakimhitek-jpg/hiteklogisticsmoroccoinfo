// Source registry. Code is the source of truth; every run upserts the registry
// into the `sources` table so the admin Source Coverage view always reflects
// exactly what the collectors are configured to monitor.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SourceMeta {
  name: string;
  homepage?: string;
  feed_url?: string;
  source_type: "news" | "weather" | "hazard" | "authority" | "carrier" | "risk" | "it";
  tier: 1 | 2 | 3 | 4;
  poll_interval_minutes: number;
  category?: string;
  country?: string;
  language?: string;
  fetch_method?: string;
}

/** Weather / hazard authorities — checked far more often than news. */
export const HAZARD_SOURCE_META: SourceMeta[] = [
  { name: "JTWC", source_type: "weather", tier: 1, poll_interval_minutes: 15, homepage: "https://www.metoc.navy.mil/jtwc/jtwc.html", fetch_method: "feed" },
  { name: "NOAA National Hurricane Center", source_type: "weather", tier: 1, poll_interval_minutes: 15, homepage: "https://www.nhc.noaa.gov/", fetch_method: "feed" },
  { name: "NOAA NWS Alerts", source_type: "weather", tier: 1, poll_interval_minutes: 15, homepage: "https://alerts.weather.gov/", fetch_method: "json" },
  { name: "WMO Severe Weather Information Centre", source_type: "weather", tier: 1, poll_interval_minutes: 15, homepage: "https://severeweather.wmo.int/", fetch_method: "feed" },
  { name: "JMA / RSMC Tokyo", source_type: "weather", tier: 1, poll_interval_minutes: 15, homepage: "https://www.jma.go.jp/", language: "ja", fetch_method: "feed" },
  { name: "China NMC", source_type: "weather", tier: 1, poll_interval_minutes: 15, homepage: "https://www.nmc.cn/", country: "China", language: "zh", fetch_method: "json" },
  { name: "PAGASA", source_type: "weather", tier: 1, poll_interval_minutes: 20, homepage: "https://www.pagasa.dost.gov.ph/", country: "Philippines", fetch_method: "html" },
  { name: "Hong Kong Observatory", source_type: "weather", tier: 1, poll_interval_minutes: 20, homepage: "https://www.hko.gov.hk/", fetch_method: "feed" },
  { name: "Taiwan CWA", source_type: "weather", tier: 1, poll_interval_minutes: 20, homepage: "https://www.cwa.gov.tw/", language: "zh", fetch_method: "feed" },
  { name: "India Meteorological Department", source_type: "weather", tier: 1, poll_interval_minutes: 30, homepage: "https://mausam.imd.gov.in/", fetch_method: "feed" },
  { name: "Australian Bureau of Meteorology", source_type: "weather", tier: 1, poll_interval_minutes: 30, homepage: "https://www.bom.gov.au/", fetch_method: "feed" },
  { name: "Meteo-France Vigilance", source_type: "weather", tier: 1, poll_interval_minutes: 30, homepage: "https://vigilance.meteofrance.fr/", language: "fr", fetch_method: "html" },
  { name: "GDACS", source_type: "hazard", tier: 1, poll_interval_minutes: 15, homepage: "https://www.gdacs.org/", fetch_method: "feed" },
  { name: "USGS Earthquakes", source_type: "hazard", tier: 1, poll_interval_minutes: 15, homepage: "https://earthquake.usgs.gov/", fetch_method: "json" },
  { name: "Copernicus EMS Rapid Mapping", source_type: "hazard", tier: 1, poll_interval_minutes: 60, homepage: "https://emergency.copernicus.eu/", fetch_method: "json" },
];

const t1 = (name: string, homepage: string, type: SourceMeta["source_type"] = "news", mins = 30, extra: Partial<SourceMeta> = {}): SourceMeta =>
  ({ name, homepage, source_type: type, tier: 1, poll_interval_minutes: mins, ...extra });
const t2 = (name: string, homepage: string, type: SourceMeta["source_type"] = "news", mins = 60, extra: Partial<SourceMeta> = {}): SourceMeta =>
  ({ name, homepage, source_type: type, tier: 2, poll_interval_minutes: mins, ...extra });
const t3 = (name: string, homepage: string, type: SourceMeta["source_type"] = "news", mins = 180, extra: Partial<SourceMeta> = {}): SourceMeta =>
  ({ name, homepage, source_type: type, tier: 3, poll_interval_minutes: mins, ...extra });

/** News / authority / carrier / industry sources handled by fetch-news. */
export const NEWS_SOURCE_META: SourceMeta[] = [
  // Tier 1 — official authorities, carriers and canal/port operators
  t1("IMO", "https://www.imo.org", "authority", 120),
  t1("IATA", "https://www.iata.org", "authority", 120),
  t1("WTO", "https://www.wto.org", "authority", 180),
  t1("WCO", "https://www.wcoomd.org", "authority", 180),
  t1("FIATA", "https://www.fiata.org", "authority", 180),
  t1("ICC (Incoterms)", "https://iccwbo.org", "authority", 360),
  t1("UNECE", "https://unece.org", "authority", 360),
  t1("European Commission", "https://ec.europa.eu", "authority", 60),
  t1("ADII Morocco (Customs)", "https://www.douane.gov.ma", "authority", 60, { country: "Morocco", language: "fr" }),
  t1("ADiL (Customs Clearance)", "https://www.adil.gov.ma", "authority", 180, { country: "Morocco", language: "fr" }),
  t1("PortNet Morocco", "https://www.portnet.ma", "authority", 60, { country: "Morocco", language: "fr" }),
  t1("Tanger Med", "https://www.tangermed.ma", "authority", 30, { country: "Morocco", language: "fr" }),
  t1("Tanger Med Port Authority", "https://www.tmpa.ma", "authority", 30, { country: "Morocco", language: "fr" }),
  t1("DGI Maroc (Impôts)", "https://www.tax.gov.ma", "authority", 360, { country: "Morocco", language: "fr" }),
  t1("Bank Al-Maghrib", "https://www.bkam.ma", "authority", 360, { country: "Morocco", language: "fr" }),
  t1("SGG (Bulletin Officiel)", "https://www.sgg.gov.ma", "authority", 360, { country: "Morocco", language: "fr" }),
  t1("Maersk", "https://www.maersk.com", "carrier", 30),
  t1("MSC", "https://www.msc.com", "carrier", 30),
  t1("CMA CGM", "https://www.cma-cgm.com", "carrier", 30),
  t1("Hapag-Lloyd", "https://www.hapag-lloyd.com", "carrier", 30),
  t1("SEKO Logistics", "https://www.sekologistics.com", "carrier", 60),
  t1("Kuehne+Nagel", "https://home.kuehne-nagel.com", "carrier", 60),
  t1("Hillebrand Gori", "https://www.hillebrandgori.com", "carrier", 120),
  t1("CISA", "https://www.cisa.gov", "authority", 60, { category: "it" }),
  // Tier 2 — high quality news agencies / risk platforms
  t2("The Loadstar", "https://theloadstar.com"),
  t2("JOC", "https://www.joc.com"),
  t2("Lloyd's List", "https://lloydslist.com"),
  t2("FreightWaves", "https://www.freightwaves.com"),
  t2("gCaptain", "https://gcaptain.com"),
  t2("Splash247", "https://splash247.com"),
  t2("The Maritime Executive", "https://maritime-executive.com"),
  t2("Seatrade Maritime", "https://www.seatrade-maritime.com"),
  t2("Hellenic Shipping News", "https://www.hellenicshippingnews.com"),
  t2("project44", "https://www.project44.com", "risk"),
  t2("Everstream Analytics", "https://www.everstream.ai", "risk"),
  t2("Resilinc", "https://www.resilinc.com", "risk"),
  t2("Médias24", "https://medias24.com", "news", 60, { country: "Morocco", language: "fr" }),
  t2("L'Economiste", "https://www.leconomiste.com", "news", 60, { country: "Morocco", language: "fr" }),
  t2("Le Matin", "https://lematin.ma", "news", 60, { country: "Morocco", language: "fr" }),
  t2("Hespress", "https://fr.hespress.com", "news", 60, { country: "Morocco", language: "fr" }),
  t2("La Vie Éco", "https://www.lavieeco.com", "news", 180, { country: "Morocco", language: "fr" }),
  t2("Finances News Hebdo", "https://fnh.ma", "news", 180, { country: "Morocco", language: "fr" }),
  // Tier 3 — industry publications and research
  t3("ICIS", "https://www.icis.com"),
  t3("Supply Chain Brain", "https://www.supplychainbrain.com"),
  t3("Logistics Management", "https://www.logisticsmgmt.com"),
  t3("Baird Maritime", "https://www.bairdmaritime.com"),
  t3("MarineLink", "https://www.marinelink.com"),
  t3("Voice of the Independent", "https://voiceoftheindependent.com"),
  t3("UNCTAD", "https://unctad.org", "authority", 360),
  t3("World Bank", "https://www.worldbank.org", "authority", 360),
  t3("World Bank LPI", "https://lpi.worldbank.org", "authority", 1440),
  t3("ITC Trade Map", "https://www.trademap.org", "authority", 1440),
  t3("ITC", "https://www.intracen.org", "authority", 1440),
  // IT / cyber
  t3("BleepingComputer", "https://www.bleepingcomputer.com", "it", 120),
  t3("The Register", "https://www.theregister.com", "it", 180),
  t3("TechTarget", "https://www.techtarget.com", "it", 360),
  t3("Microsoft Security", "https://msrc.microsoft.com", "it", 360),
  t3("Google Cloud", "https://cloud.google.com", "it", 360),
  t3("AWS Security", "https://aws.amazon.com/security", "it", 360),
  t3("Ars Technica", "https://arstechnica.com", "it", 360),
  t3("OpenAI", "https://openai.com", "it", 360),
  t3("Anthropic", "https://www.anthropic.com", "it", 360),
  t3("MIT Technology Review", "https://www.technologyreview.com", "it", 360),
  t3("VentureBeat", "https://venturebeat.com", "it", 360),
  t3("Hugging Face Blog", "https://huggingface.co/blog", "it", 720),
  t3("Computer Weekly", "https://www.computerweekly.com", "it", 360),
  t3("IT Security Guru", "https://www.itsecurityguru.org", "it", 360),
  t3("SD Times", "https://sdtimes.com", "it", 720),
  t3("ACM TechNews", "https://technews.acm.org", "it", 720),
];

export const ALL_SOURCE_META = [...HAZARD_SOURCE_META, ...NEWS_SOURCE_META];

export async function syncSourceRegistry(db: SupabaseClient, metas: SourceMeta[]): Promise<void> {
  const rows = metas.map((m) => ({
    name: m.name,
    homepage: m.homepage ?? null,
    feed_url: m.feed_url ?? null,
    source_type: m.source_type,
    tier: m.tier,
    fetch_method: m.fetch_method ?? "auto",
    poll_interval_minutes: m.poll_interval_minutes,
    category: m.category ?? null,
    country: m.country ?? null,
    language: m.language ?? "en",
    enabled: true,
  }));
  for (let i = 0; i < rows.length; i += 50) {
    await db.from("sources").upsert(rows.slice(i, i + 50), { onConflict: "name" });
  }
}

/** True when this source is due for a check given its own polling interval. */
export function isDue(lastAttemptAt: string | null | undefined, intervalMinutes: number): boolean {
  if (!lastAttemptAt) return true;
  return Date.now() - new Date(lastAttemptAt).getTime() >= intervalMinutes * 60_000;
}
