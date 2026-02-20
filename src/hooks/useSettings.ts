import { useState, useEffect } from "react";

export interface AppSettings {
  focusRegions: string[];
  priorityFilter: string[];
  archiveRetention: number; // days
  autoFetchNews: boolean;
  autoGenerateReports: boolean;
  newsSourcesEnabled: string[];
  companyName: string;
  notifyOnCritical: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  focusRegions: ["morocco", "europe", "global"],
  priorityFilter: ["critical", "important", "informational"],
  archiveRetention: 90,
  autoFetchNews: true,
  autoGenerateReports: true,
  newsSourcesEnabled: ["Lloyd's List", "FreightWaves", "ADII Morocco", "The Loadstar", "JOC", "European Commission", "IATA", "IMO", "Drewry", "Morocco World News"],
  companyName: "FreightPulse",
  notifyOnCritical: true,
};

const STORAGE_KEY = "freightpulse_settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return { settings, updateSettings, resetSettings };
}
