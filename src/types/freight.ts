export type Category = "regulation" | "weather" | "port" | "trade" | "compliance" | "market" | "general";
export type Region = "morocco" | "europe" | "asia" | "americas" | "africa" | "middle_east" | "global";
export type Priority = "critical" | "important" | "informational";

export interface NewsEntry {
  id: string;
  headline: string;
  summary: string;
  fullContent?: string;
  sourceUrl?: string;
  sourceName: string;
  category: Category;
  region: Region;
  priority: Priority;
  impactAssessment: string;
  actionRequired: boolean;
  suggestedAction?: string;
  publishedDate: string;
  weekNumber?: number;
  month?: number;
  year?: number;
}

export interface WeeklyReport {
  id: string;
  weekNumber: number;
  year: number;
  executiveSummary: string;
  generatedAt: string;
  reportJson: Record<string, unknown>;
}

export interface MonthlySummary {
  id: string;
  month: number;
  year: number;
  executiveSummary: string;
  topEvents: unknown[];
  complianceTracker: unknown[];
  generatedAt: string;
}

export interface ComplianceItem {
  id: string;
  title: string;
  deadline: string;
  status: "addressed" | "pending" | "action_needed";
}

export const categoryLabels: Record<Category, string> = {
  regulation: "Regulation",
  weather: "Weather",
  port: "Port",
  trade: "Trade",
  compliance: "Compliance",
  market: "Market",
  general: "General",
};

export const regionLabels: Record<Region, string> = {
  morocco: "Morocco",
  europe: "Europe",
  asia: "Asia",
  americas: "Americas",
  africa: "Africa",
  middle_east: "Middle East",
  global: "Global",
};

export const priorityConfig: Record<Priority, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-destructive text-destructive-foreground" },
  important: { label: "Important", className: "bg-warning text-warning-foreground" },
  informational: { label: "Info", className: "bg-success text-success-foreground" },
};

export const categoryColors: Record<Category, string> = {
  regulation: "bg-secondary/10 text-secondary border-secondary/20",
  weather: "bg-warning/10 text-warning border-warning/20",
  port: "bg-accent/10 text-accent border-accent/20",
  trade: "bg-primary/10 text-primary border-primary/20",
  compliance: "bg-destructive/10 text-destructive border-destructive/20",
  market: "bg-success/10 text-success border-success/20",
  general: "bg-muted text-muted-foreground border-muted",
};

/**
 * User-friendly content tags shown on dashboard cards.
 * Maps internal category + priority into a clean, scannable label.
 */
export type ContentTag = "Regulatory" | "Customs" | "Port" | "Logistics" | "Market" | "Alert";

export function getContentTag(entry: { category: Category; priority: Priority; action_required?: boolean }): ContentTag {
  if (entry.priority === "critical" || entry.action_required) return "Alert";
  switch (entry.category) {
    case "regulation":
    case "compliance":
      return "Regulatory";
    case "port":
      return "Port";
    case "trade":
      return "Customs";
    case "weather":
      return "Logistics";
    case "market":
      return "Market";
    default:
      return "Logistics";
  }
}

export const tagStyles: Record<ContentTag, string> = {
  Alert: "bg-destructive/10 text-destructive border-destructive/30",
  Regulatory: "bg-secondary/10 text-secondary border-secondary/30",
  Port: "bg-accent/10 text-accent border-accent/30",
  Customs: "bg-primary/10 text-primary border-primary/30",
  Logistics: "bg-warning/10 text-warning border-warning/30",
  Market: "bg-success/10 text-success border-success/30",
};
