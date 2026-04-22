import { useState } from "react";
import type { AppSettings } from "@/hooks/useSettings";

const APPLIED_KEY = "freightpulse_applied_settings";

const DEFAULT_SETTINGS: AppSettings = {
  focusRegions: ["morocco", "europe", "global"],
  priorityFilter: ["critical", "important", "informational"],
  archiveRetention: 90,
  autoFetchNews: true,
  autoGenerateReports: true,
  newsSourcesEnabled: [
    "Lloyd's List", "FreightWaves", "The Loadstar", "JOC",
    "Hellenic Shipping News", "Splash247", "gCaptain", "Seatrade Maritime",
    "ADII Morocco (Customs)", "ADiL (Customs Clearance)", "PortNet Morocco", "Tanger Med", "Tanger Med Port Authority",
    "L'Economiste", "La Vie Éco", "Médias24", "Finances News Hebdo", "Le Matin",
    "IMO", "IATA", "WTO", "WCO", "FIATA", "ICC (Incoterms)", "UNECE", "European Commission",
    "DGI Maroc (Impôts)", "Bank Al-Maghrib", "SGG (Bulletin Officiel)",
    "BleepingComputer", "CISA", "The Register", "TechTarget",
    "Microsoft Security", "Google Cloud", "AWS Security",
    "Ars Technica", "OpenAI", "Anthropic",
    "MIT Technology Review", "VentureBeat", "Hugging Face Blog", "Computer Weekly",
    "IT Security Guru", "SD Times", "ACM TechNews",
    "UNCTAD", "World Bank", "World Bank LPI", "ITC Trade Map", "ITC",
    "Voice of the Independent",
  ],
  notifyOnCritical: true,
};

export function useAppliedSettings(): AppSettings {
  const [settings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(APPLIED_KEY);
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_SETTINGS;
  });
  return settings;
}

/** Filter a list of news entries by the applied settings.
 *  - Region filtering now happens on the dashboard via the inline region selector,
 *    so we no longer enforce focusRegions here.
 *  - source_name filtering is also skipped on the client side because scraped articles
 *    often expose raw domains that don't match human-readable labels; that filter
 *    happens at fetch time inside the edge function. */
export function filterBySettings<T extends { region: string; priority: string }>(
  entries: T[],
  settings: AppSettings
): T[] {
  return entries.filter((e) => settings.priorityFilter.includes(e.priority));
}
