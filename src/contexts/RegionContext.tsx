import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type RegionKey =
  | "morocco"
  | "europe"
  | "asia"
  | "americas"
  | "africa"
  | "middle_east"
  | "north_america"
  | "south_america"
  | "oceania"
  | "global";

export const REGION_OPTIONS: { value: RegionKey; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "morocco", label: "Morocco" },
  { value: "europe", label: "Europe" },
  { value: "africa", label: "Africa" },
  { value: "middle_east", label: "Middle East" },
  { value: "asia", label: "Asia" },
  { value: "north_america", label: "North America" },
  { value: "south_america", label: "South America" },
  { value: "oceania", label: "Oceania" },
];

const STORAGE_KEY = "freightpulse_active_region";

const CORE_LOGISTICS_SOURCES = [
  "Lloyd's List",
  "FreightWaves",
  "The Loadstar",
  "JOC",
  "Hellenic Shipping News",
  "Splash247",
  "gCaptain",
  "Seatrade Maritime",
  "IMO",
  "IATA",
  "WTO",
  "WCO",
  "FIATA",
  "ICC (Incoterms)",
  "UNECE",
  "European Commission",
  "UNCTAD",
  "World Bank",
  "World Bank LPI",
  "ITC Trade Map",
  "ITC",
];

const MOROCCO_SOURCES = [
  "ADII Morocco (Customs)",
  "ADiL (Customs Clearance)",
  "PortNet Morocco",
  "Tanger Med",
  "Tanger Med Port Authority",
  "L'Economiste",
  "La Vie Éco",
  "Médias24",
  "Finances News Hebdo",
  "Le Matin",
  "DGI Maroc (Impôts)",
  "Bank Al-Maghrib",
  "SGG (Bulletin Officiel)",
  "Voice of the Independent",
];

const IT_SOURCES = [
  "BleepingComputer",
  "CISA",
  "The Register",
  "TechTarget",
  "Microsoft Security",
  "Google Cloud",
  "AWS Security",
  "Ars Technica",
  "OpenAI",
  "Anthropic",
  "MIT Technology Review",
  "VentureBeat",
  "Hugging Face Blog",
  "Computer Weekly",
  "IT Security Guru",
  "SD Times",
  "ACM TechNews",
];

const REGION_SOURCE_MAP: Record<RegionKey, string[]> = {
  morocco: [...new Set([...CORE_LOGISTICS_SOURCES, ...MOROCCO_SOURCES, ...IT_SOURCES])],
  europe: [...new Set([
    ...CORE_LOGISTICS_SOURCES,
    "European Commission",
    "UNECE",
    "Lloyd's List",
    "The Loadstar",
    "Hellenic Shipping News",
    ...IT_SOURCES,
  ])],
  asia: [...new Set([
    ...CORE_LOGISTICS_SOURCES,
    "IMO",
    "WTO",
    "UNCTAD",
    "World Bank",
    ...IT_SOURCES,
  ])],
  americas: [...new Set([
    ...CORE_LOGISTICS_SOURCES,
    "FreightWaves",
    "JOC",
    "World Bank",
    "ITC",
    ...IT_SOURCES,
  ])],
  north_america: [...new Set([
    ...CORE_LOGISTICS_SOURCES,
    "FreightWaves",
    "JOC",
    ...IT_SOURCES,
  ])],
  south_america: [...new Set([
    ...CORE_LOGISTICS_SOURCES,
    "World Bank",
    "ITC",
    ...IT_SOURCES,
  ])],
  oceania: [...new Set([
    ...CORE_LOGISTICS_SOURCES,
    ...IT_SOURCES,
  ])],
  africa: [...new Set([
    ...CORE_LOGISTICS_SOURCES,
    "UNCTAD",
    "World Bank",
    "PortNet Morocco",
    "Tanger Med",
    ...IT_SOURCES,
  ])],
  middle_east: [...new Set([
    ...CORE_LOGISTICS_SOURCES,
    "IMO",
    "WTO",
    "UNCTAD",
    "gCaptain",
    "Splash247",
    ...IT_SOURCES,
  ])],
  global: [...new Set([...CORE_LOGISTICS_SOURCES, ...IT_SOURCES, "Voice of the Independent"])],
};

type RegionContextValue = {
  region: RegionKey;
  setRegion: (region: RegionKey) => void;
  activeSources: string[];
};

const RegionContext = createContext<RegionContextValue | null>(null);

export function getSourcesForRegion(region: RegionKey): string[] {
  return REGION_SOURCE_MAP[region] ?? REGION_SOURCE_MAP.global;
}

export function getRegionLabel(region: RegionKey): string {
  return REGION_OPTIONS.find((option) => option.value === region)?.label ?? "Global";
}

export function isEntryRelevantToRegion(entryRegion: string, activeRegion: RegionKey): boolean {
  // Legacy fallback used when display_regions isn't available on an entry.
  // Prefer isEntryVisibleInRegion(entry, region) which uses display_regions.
  if (activeRegion === "global") {
    // Global filter shows everything except Morocco-only items.
    return entryRegion !== "morocco";
  }
  return entryRegion === activeRegion;
}

/**
 * Primary visibility check. Uses display_regions when present (set by the
 * classifier), and falls back to legacy single-region matching otherwise.
 */
export function isEntryVisibleInRegion(
  entry: { region: string; display_regions?: string[] | null },
  activeRegion: RegionKey,
): boolean {
  const dr = entry.display_regions && entry.display_regions.length > 0
    ? entry.display_regions
    : null;
  if (dr) return dr.includes(activeRegion);
  return isEntryRelevantToRegion(entry.region, activeRegion);
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegion] = useState<RegionKey>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as RegionKey | null;
    const valid = stored && REGION_OPTIONS.some((o) => o.value === stored);
    return valid ? (stored as RegionKey) : "global";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, region);
  }, [region]);

  const value = useMemo(
    () => ({
      region,
      setRegion,
      activeSources: getSourcesForRegion(region),
    }),
    [region]
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegionContext() {
  const context = useContext(RegionContext);
  if (!context) {
    throw new Error("useRegionContext must be used within RegionProvider");
  }
  return context;
}