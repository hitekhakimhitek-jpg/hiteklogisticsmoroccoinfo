import { useState, useEffect, useCallback } from "react";

export interface AppSettings {
  focusRegions: string[];
  priorityFilter: string[];
  archiveRetention: number;
  autoFetchNews: boolean;
  autoGenerateReports: boolean;
  newsSourcesEnabled: string[];
  notifyOnCritical: boolean;
}

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

const STORAGE_KEY = "freightpulse_settings";
const APPLIED_KEY = "freightpulse_applied_settings";

function loadFromStorage(key: string): AppSettings {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function useSettings() {
  // Pending = what the user sees in the UI and edits
  const [pending, setPending] = useState<AppSettings>(() => loadFromStorage(STORAGE_KEY));
  // Applied = what the dashboard actually uses
  const [applied, setApplied] = useState<AppSettings>(() => loadFromStorage(APPLIED_KEY));
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  }, [pending]);

  useEffect(() => {
    localStorage.setItem(APPLIED_KEY, JSON.stringify(applied));
  }, [applied]);

  const updatePending = (partial: Partial<AppSettings>) => {
    setPending((prev) => ({ ...prev, ...partial }));
  };

  const applySettings = useCallback(async () => {
    setIsUpdating(true);
    // Simulate gathering & analyzing (2.5s)
    await new Promise((r) => setTimeout(r, 2500));
    setApplied({ ...pending });
    setIsUpdating(false);
  }, [pending]);

  const resetSettings = () => {
    setPending(DEFAULT_SETTINGS);
    setApplied(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(APPLIED_KEY, JSON.stringify(DEFAULT_SETTINGS));
  };

  const isDirty = JSON.stringify(pending) !== JSON.stringify(applied);

  return { pending, applied, updatePending, applySettings, resetSettings, isUpdating, isDirty };
}
