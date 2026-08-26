export const INTEL_DEPARTMENTS = ["operations", "compliance", "finance", "commercial", "it"] as const;
export const INTEL_SEVERITIES = ["act_now", "this_week", "awareness"] as const;

export type IntelDepartment = typeof INTEL_DEPARTMENTS[number];
export type IntelSeverity = typeof INTEL_SEVERITIES[number];

type QualityInput = {
  headline?: string | null;
  summary?: string | null;
  content?: string | null;
  sourceName?: string | null;
  country?: string | null;
  department?: string | null;
  severity?: string | null;
  actionRequired?: boolean | null;
};

export type QualityAssessment = {
  department: IntelDepartment;
  departmentConfidence: number;
  severity: IntelSeverity;
  severityScore: number;
  relevanceScore: number;
  classificationReason: string;
  publishable: boolean;
};

const GEO_PRIORITY = /morocco|maroc|tanger med|tangier|casablanca|agadir|kenitra|spain|france|algeciras|valencia|barcelona|marseille|europe|mediterranean|west africa|mauritania|senegal|ivory coast|côte d'ivoire/i;
const FREIGHT_CORE = /freight|cargo|shipping|ship|container|port|terminal|customs|douane|border|trade lane|logistics|supply chain|warehouse|truck|road|rail|airport|airline|carrier|vessel|canal|strait|surcharge|tariff|sanction|export|import/i;
const DIRECT_DISRUPTION = /confirmed|closed|closure|shutdown|halted|suspended|blockade|strike|force majeure|attack|collision|grounded|embargo|effective immediately|mandatory|deadline/i;
const DEVELOPING_RISK = /warning|watch|forecast|possible|may|could|risk|congestion|delay|diversion|backlog|disruption|restriction/i;
const LOW_SIGNAL = /opinion|interview|podcast|award|appointment|sponsored|webinar|conference|anniversary|profile|lifestyle/i;

const DEPARTMENT_RULES: Array<{ department: IntelDepartment; pattern: RegExp }> = [
  { department: "compliance", pattern: /customs|douane|regulation|directive|law|decree|compliance|document requirement|sanction|export control|embargo|dangerous goods|iata dgr|imo rule/i },
  { department: "finance", pattern: /surcharge|fuel price|baf\b|caf\b|duty|tariff|tax|vat|currency|exchange rate|interest rate|payment|banking|insurance premium/i },
  { department: "it", pattern: /cyber|ransomware|malware|vulnerab|\bcve\b|software|cloud|microsoft|onedrive|sharepoint|outlook|cargowise|\bsap\b|portnet|badr|data breach|system outage/i },
  { department: "commercial", pattern: /freight rate|capacity|demand|volume|contract rate|spot rate|market outlook|customer demand|pricing|sales opportunity/i },
  { department: "operations", pattern: /port|terminal|vessel|carrier|airport|flight|road|truck|rail|border|weather|storm|cyclone|typhoon|flood|strike|congestion|closure|delay|diversion|route|canal|strait/i },
];

const CORE_SOFTWARE = /microsoft\s*teams|onedrive|sharepoint|outlook|exchange online|microsoft\s*365|office\s*365|\bm365\b|cargowise|\bsap\b|portnet|badr/i;
const SOFTWARE_STOPPAGE = /outage|down|offline|unavailable|service disruption|forced migration|breaking change|end of support/i;
const SECURITY_NEWS = /hack|breach|ransomware|malware|phish|vulnerab|\bcve\b|exploit|flaw|zero-?day|patch|leak/i;

export function assessIntelligenceQuality(input: QualityInput): QualityAssessment {
  const text = `${input.headline || ""} ${input.summary || ""} ${(input.content || "").slice(0, 3000)} ${input.country || ""}`;
  const requestedDepartment = INTEL_DEPARTMENTS.includes(input.department as IntelDepartment)
    ? input.department as IntelDepartment
    : null;
  const matched = DEPARTMENT_RULES.find((rule) => rule.pattern.test(text));
  const department = matched?.department ?? requestedDepartment ?? "operations";
  const departmentConfidence = matched ? 0.88 : requestedDepartment ? 0.72 : 0.45;

  let relevanceScore = FREIGHT_CORE.test(text) ? 55 : 15;
  if (GEO_PRIORITY.test(text)) relevanceScore += 22;
  if (DIRECT_DISRUPTION.test(text)) relevanceScore += 16;
  else if (DEVELOPING_RISK.test(text)) relevanceScore += 8;
  if (LOW_SIGNAL.test(text)) relevanceScore -= 30;
  if ((input.summary || input.content || "").trim().length >= 220) relevanceScore += 7;
  relevanceScore = Math.max(0, Math.min(100, relevanceScore));

  let severityScore = 22;
  if (DEVELOPING_RISK.test(text)) severityScore = 52;
  if (DIRECT_DISRUPTION.test(text) && FREIGHT_CORE.test(text)) severityScore = 78;
  if (input.actionRequired === true) severityScore = Math.max(severityScore, 58);
  if (!GEO_PRIORITY.test(text) && !/global|worldwide|suez|red sea|hormuz|panama canal/i.test(text)) severityScore -= 8;

  let severity: IntelSeverity = severityScore >= 75 ? "act_now" : severityScore >= 45 ? "this_week" : "awareness";
  if (department === "commercial") severity = severity === "act_now" ? "this_week" : severity;
  if (department === "it") {
    const coreStoppage = CORE_SOFTWARE.test(text) && SOFTWARE_STOPPAGE.test(text) && !SECURITY_NEWS.test(text);
    if (!coreStoppage && severity === "act_now") severity = "this_week";
    severityScore = coreStoppage ? severityScore : Math.min(severityScore, 69);
  }
  if (relevanceScore < 60) severity = "awareness";

  const reason = [
    matched ? `${department} keywords matched` : "department inferred with limited evidence",
    GEO_PRIORITY.test(text) ? "priority Hitek corridor/geography" : "non-priority geography",
    DIRECT_DISRUPTION.test(text) ? "confirmed operational trigger" : DEVELOPING_RISK.test(text) ? "developing risk" : "background signal",
  ].join("; ");

  return {
    department,
    departmentConfidence,
    severity,
    severityScore: Math.max(0, Math.min(100, severityScore)),
    relevanceScore,
    classificationReason: reason,
    publishable: relevanceScore >= 60 && departmentConfidence >= 0.7,
  };
}

export function departmentAction(department: IntelDepartment, severity: IntelSeverity, subject: string): string {
  if (severity === "awareness") return `Monitor ${subject} and reassess if operating conditions change.`;
  switch (department) {
    case "operations": return `Check exposed bookings and routes, confirm carrier alternatives, and notify affected operations owners.`;
    case "compliance": return `Validate the new requirement against current files and update the relevant customs or compliance checklist.`;
    case "finance": return `Quantify the cost exposure, review customer pass-through terms, and alert Finance to material variance.`;
    case "commercial": return `Brief account owners on capacity or pricing implications before the next customer quotation.`;
    case "it": return `Confirm exposure with IT, apply the vendor guidance, and notify users only if service continuity is affected.`;
  }
}

export function deterministicSummary(headline: string, sourceSummary?: string | null): string {
  const cleaned = String(sourceSummary || "").replace(/\s+/g, " ").trim();
  if (cleaned.length >= 80) return cleaned.slice(0, 600);
  return `${headline.replace(/[.\s]+$/, "")}. The signal is being tracked for potential effects on freight movements, compliance, cost, or customer commitments.`;
}