import { WeeklyReport as WeeklyReportType } from "@/types/freight";
import { mockNewsEntries } from "./mockData";

export const mockWeeklyReports = [
  {
    weekNumber: 8,
    year: 2026,
    dateRange: "Feb 17 – Feb 23, 2026",
    executiveSummary:
      "A high-impact week for Morocco-based freight operations. Three critical alerts flagged including Casablanca port strike action, Tanger Med expansion disruptions, and EU CBAM Phase 2 activation. Mediterranean storm system expected to delay crossings Feb 22–25. Five new regulatory updates require attention, with two compliance deadlines approaching in March.",
    sections: {
      critical: mockNewsEntries.filter((e) => e.priority === "critical"),
      regulatory: mockNewsEntries.filter(
        (e) => e.category === "regulation" || e.category === "compliance"
      ),
      trade: mockNewsEntries.filter(
        (e) => e.category === "trade" || e.category === "market"
      ),
      disruptions: mockNewsEntries.filter(
        (e) => e.category === "weather" || e.category === "port"
      ),
      general: mockNewsEntries.filter((e) => e.category === "general"),
      morocco: mockNewsEntries.filter((e) => e.region === "morocco"),
    },
  },
  {
    weekNumber: 7,
    year: 2026,
    dateRange: "Feb 10 – Feb 16, 2026",
    executiveSummary:
      "A relatively stable week with moderate activity. Key highlights include ongoing Suez Canal fee negotiations, new IMO sulfur cap enforcement updates, and preliminary Morocco-UK trade agreement discussions entering advanced stages. No major disruptions reported on primary Morocco trade corridors.",
    sections: {
      critical: [],
      regulatory: mockNewsEntries.filter((e) => e.category === "regulation").slice(0, 1),
      trade: mockNewsEntries.filter((e) => e.category === "trade").slice(0, 2),
      disruptions: [],
      general: [],
      morocco: mockNewsEntries.filter((e) => e.region === "morocco").slice(0, 2),
    },
  },
  {
    weekNumber: 6,
    year: 2026,
    dateRange: "Feb 3 – Feb 9, 2026",
    executiveSummary:
      "Increased regulatory activity dominated this week with two new EU trade compliance requirements published. Global container rates stabilized after three consecutive weeks of increases. Tanger Med reported record throughput volumes for January.",
    sections: {
      critical: mockNewsEntries.filter((e) => e.priority === "critical").slice(0, 1),
      regulatory: mockNewsEntries.filter((e) => e.category === "regulation").slice(0, 2),
      trade: mockNewsEntries.filter((e) => e.category === "market").slice(0, 1),
      disruptions: mockNewsEntries.filter((e) => e.category === "weather").slice(0, 1),
      general: [],
      morocco: mockNewsEntries.filter((e) => e.region === "morocco").slice(0, 3),
    },
  },
];

export const mockMonthlySummary = {
  month: 2,
  year: 2026,
  monthLabel: "February 2026",
  executiveSummary:
    "February 2026 was a pivotal month for Morocco-focused freight operations. The activation of EU CBAM Phase 2 marked the most significant regulatory shift, requiring immediate compliance action for all EU-bound shipments. Casablanca port labor tensions escalated with a 48-hour warning strike, while Tanger Med announced a major 15% capacity expansion. Global freight rates continued their upward trajectory with an 8.3% WoW increase on the container index. Three critical weather events impacted Mediterranean shipping lanes. Morocco-UK trade agreement negotiations advanced to final stages, signaling potential tariff reductions by Q3.",
  topEvents: [
    { rank: 1, headline: "EU CBAM Phase 2 activation", impact: "Critical", category: "Regulation" },
    { rank: 2, headline: "Casablanca port 48-hour warning strike", impact: "Critical", category: "Port" },
    { rank: 3, headline: "Tanger Med 15% capacity expansion announced", impact: "Critical", category: "Port" },
    { rank: 4, headline: "Global Container Freight Index +8.3% WoW", impact: "High", category: "Market" },
    { rank: 5, headline: "Mediterranean storm system disruptions", impact: "High", category: "Weather" },
    { rank: 6, headline: "Morocco-UK FTA enters final negotiation", impact: "High", category: "Trade" },
    { rank: 7, headline: "IATA lithium battery regulation update", impact: "Medium", category: "Compliance" },
    { rank: 8, headline: "PortNet 3.0 customs system rollout", impact: "Medium", category: "Compliance" },
    { rank: 9, headline: "Maersk-MSC Morocco-West Africa express service", impact: "Medium", category: "Trade" },
    { rank: 10, headline: "Suez Canal transit fee increase (April)", impact: "Low", category: "Market" },
  ],
  complianceTracker: [
    { item: "EU CBAM Phase 2 certificates", deadline: "Mar 1, 2026", status: "pending" as const },
    { item: "IATA DGR 67 lithium battery compliance", deadline: "Mar 1, 2026", status: "pending" as const },
    { item: "PortNet 3.0 integration (ADII)", deadline: "Apr 15, 2026", status: "pending" as const },
    { item: "IMO 2026 sulfur cap verification", deadline: "Jan 1, 2026", status: "addressed" as const },
    { item: "Morocco origin certification update", deadline: "Jun 1, 2026", status: "action_needed" as const },
  ],
  moroccoDigest:
    "Morocco saw heightened activity in February with Tanger Med's expansion announcement, Casablanca labor tensions, and the PortNet 3.0 customs modernization rollout. The Morocco-UK FTA advanced to final negotiations, potentially opening new trade corridors. Port throughput at Tanger Med hit record January volumes, reinforcing Morocco's position as a key Mediterranean transit hub.",
  monthComparison: {
    disruptions: { current: 5, previous: 3, change: 67 },
    regulations: { current: 7, previous: 4, change: 75 },
    criticalAlerts: { current: 3, previous: 1, change: 200 },
    newsItems: { current: 42, previous: 35, change: 20 },
  },
};
