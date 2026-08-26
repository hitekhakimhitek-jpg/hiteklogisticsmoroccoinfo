import { cleanSummary, cleanTitle, nonArticleReason } from "./intel-article.ts";

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
  sourceUrl?: string | null;
  sourceSeverity?: string | null;
  technologyUsage?: Record<string, "used" | "not_used" | "unknown">;
  directHitekExposure?: boolean;
};

export type QualityAssessment = {
  department: IntelDepartment;
  departmentConfidence: number;
  severity: IntelSeverity;
  severityScore: number;
  relevanceScore: number;
  classificationReason: string;
  publishable: boolean;
  relevanceStatus: "accept" | "review" | "reject";
  sourceSeverity: string | null;
  decisionReasons: string[];
};

const GEO_PRIORITY = /morocco|maroc|tanger|tangier|casablanca|kenitra|spain|france|germany|benelux|italy|algeciras|valencia|barcelona|marseille|rotterdam|antwerp|mediterranean|gibraltar|suez|red sea|bab el-mandeb|hormuz|asia.{0,20}europe|north america/i;
const LOGISTICS = /freight forward|ocean freight|air freight|road freight|rail freight|cargo|shipping|container|port|terminal|customs|border crossing|warehouse|carrier|vessel|trade lane|supply chain|route|chokepoint/i;
const INDUSTRY = /automotive|aerospace|project cargo|manufacturing|industrial (?:plant|facility|investment)|factory (?:expansion|investment)|foreign direct investment|\bfdi\b/i;
const COMPLIANCE = /customs|douane|ics2|\bens\b|import requirement|export requirement|sanction|trade restriction|transport regulation|compliance deadline|directive|decree|tariff regulation/i;
const CYBER = /cyber|ransomware|malware|phish|vulnerab|\bcve[-\s]?\d*|zero-?day|data breach|credential theft|remote.code.execution|\brce\b|security flaw|actively exploited|patching|attack.{0,80}(?:systems?|infrastructure)|autonomous ai attacks?|adversar/i;
const ENTERPRISE_IT = /microsoft|windows|entra|zimbra|sharepoint|salesforce|google cloud|cloud security|azure|office 365|microsoft 365|wordpress|elementor|cargowise|\bsap\b|portnet|badr|firewall|server/i;
const MARITIME = /vessel|tanker|container ship|port|ocean carrier|red sea|suez|hormuz|bab el-mandeb|gulf of aden|piracy|pirates|hijack|shipping route|maritime|carrier suspension/i;
const OPERATIONS = new RegExp(`${MARITIME.source}|trucking|road freight|air cargo|airport cargo|rail freight|transport strike|port congestion|capacity disruption|route disruption|typhoon|hurricane|cyclone|storm surge|flood|earthquake|tsunami|extreme weather`, "i");
const COMMERCIAL = /new (?:investment|factory|industrial facility|automotive project|aerospace project)|manufacturing expansion|market opportunity|potential customer|capacity|freight rate|customer demand/i;
const FINANCE = /foreign exchange|exchange rate|\bfx\b|fuel price|bunker price|surcharge|inflation.{0,30}(?:freight|logistics)|insurance exposure|freight cost|duty cost/i;
const HARD_REJECT = /tourism|tourisme|museum|musée|hotel|cultural event|consumer technolog|ai philosophy|generic ai|podcast|award|appointment|sponsored|webinar|conference|lifestyle|release notes|freight distress report|jobs? cut|layoffs?|white papers?|special reports?|media kit/i;
const DIRECT_HITEK = /hitek|tanger med|tangier med|morocco.spain|spain.morocco|active (?:hitek )?shipments?|confirmed (?:hitek )?(?:system|deployment|exposure)|affects hitek/i;
const IMMEDIATE = /closed|closure|blocked|shutdown|halted|suspended routes?|carrier suspension|force majeure|effective immediately|within 24 hours|active disruption|currently disrupted|actual compromise/i;
const DEVELOPING = /upcoming strike|planned strike|worsening congestion|delay|diversion|backlog|actively exploited|mandatory|effective (?:on|from)|deadline|significant freight rate/i;
const SOURCE_ALARM = /\bcritical\b|urgent|severe|catastrophic|major|emergency|maximum severity|dangerous|warning|alert/i;

function technologyMatch(text: string, usage: QualityInput["technologyUsage"] = {}) {
  for (const [name, state] of Object.entries(usage)) {
    const aliases = name.toLowerCase().split(/[|,]/).map((v) => v.trim()).filter(Boolean);
    if (aliases.some((alias) => text.toLowerCase().includes(alias))) return { name, state };
  }
  return null;
}

export function assessIntelligenceQuality(input: QualityInput): QualityAssessment {
  const headline = cleanTitle(input.headline, input.sourceName);
  const summary = cleanSummary(input.summary || input.content);
  const text = `${headline} ${summary} ${(input.content || "").slice(0, 5000)} ${input.country || ""}`;
  const reasons: string[] = [];
  const articleFailure = input.sourceUrl ? nonArticleReason({ title: headline, url: input.sourceUrl, content: text }) : null;
  const tech = technologyMatch(text, input.technologyUsage);
  const isCyber = CYBER.test(text);
  const isMaritime = MARITIME.test(text);

  let department: IntelDepartment;
  let departmentConfidence = 0.9;
  if (isMaritime || OPERATIONS.test(text)) department = "operations";
  else if (isCyber || ENTERPRISE_IT.test(text)) department = "it";
  else if (COMPLIANCE.test(text)) department = "compliance";
  else if (INDUSTRY.test(text) || COMMERCIAL.test(text) || /tourism|tourisme|museum|musée/i.test(text)) department = "commercial";
  else if (FINANCE.test(text)) department = "finance";
  else if (INTEL_DEPARTMENTS.includes(input.department as IntelDepartment)) {
    department = input.department as IntelDepartment;
    departmentConfidence = 0.65;
  } else {
    department = "operations";
    departmentConfidence = 0.35;
  }
  if (isMaritime) reasons.push("maritime/route subject forces Operations");
  else if (isCyber) reasons.push("cybersecurity subject forces IT");
  else reasons.push(`${department} semantic evidence`);

  let relevanceScore = 5;
  if (LOGISTICS.test(text)) relevanceScore += 25;
  if (GEO_PRIORITY.test(text)) relevanceScore += 25;
  if (COMPLIANCE.test(text)) relevanceScore += 25;
  if (INDUSTRY.test(text)) relevanceScore += 25;
  if (isCyber && ENTERPRISE_IT.test(text)) relevanceScore += 25;
  else if (isCyber) relevanceScore += 18;
  if (tech) relevanceScore += 10;
  if (/actively exploited|exploitation in the wild/i.test(text) && ENTERPRISE_IT.test(text)) relevanceScore += 25;
  if (DIRECT_HITEK.test(text) || input.directHitekExposure) relevanceScore += 30;
  if (isMaritime && /red sea|suez|hormuz|bab el-mandeb|gulf of aden/i.test(text)) relevanceScore += 20;
  if (isMaritime) relevanceScore += 15;
  if (isMaritime && /attack|hit|hijack|piracy|pirates/i.test(text)) relevanceScore += 15;
  if (HARD_REJECT.test(text)) relevanceScore -= 55;
  if (/freight distress report|jobs? cut|layoffs?/i.test(text) && !GEO_PRIORITY.test(text) && !DIRECT_HITEK.test(text)) relevanceScore = 10;
  if (/release notes/i.test(text) && !DIRECT_HITEK.test(text)) relevanceScore = 5;
  if (tech?.state === "not_used") relevanceScore = Math.min(relevanceScore, 20);
  if (isCyber && !ENTERPRISE_IT.test(text) && !tech) relevanceScore = Math.max(relevanceScore, 35);
  relevanceScore = Math.max(0, Math.min(100, relevanceScore));

  let relevanceStatus: QualityAssessment["relevanceStatus"] = relevanceScore >= 55 ? "accept" : relevanceScore >= 35 ? "review" : "reject";
  if (articleFailure) { relevanceStatus = "reject"; reasons.push(articleFailure); }
  if (HARD_REJECT.test(text)) reasons.push("generic or excluded subject");
  if (tech) reasons.push(`${tech.name} usage is ${tech.state}`);

  let severityScore = 38;
  const direct = Boolean(input.directHitekExposure || DIRECT_HITEK.test(text));
  if (DEVELOPING.test(text)) severityScore = 60;
  if (IMMEDIATE.test(text) && (direct || GEO_PRIORITY.test(text))) severityScore = 72;
  if (IMMEDIATE.test(text) && direct) severityScore = 84;
  if (isMaritime && /hit|attack|hijack|piracy|pirates/i.test(text) && !/route (?:closed|blocked)|carriers? suspend|rerouting begins|shipments? affected/i.test(text)) severityScore = 58;
  if (department === "commercial") severityScore = Math.min(severityScore, 70);
  if (department === "it") {
    const activelyExploited = /actively exploited|exploitation in the wild|actual compromise/i.test(text);
    if (!isCyber || /opinion|trend|future|growing capability|autonomous ai|attack your own systems|clear and present danger/i.test(text)) severityScore = 42;
    if (tech?.state === "not_used") severityScore = 30;
    else if (tech?.state === "unknown" && activelyExploited) severityScore = 65;
    else if (tech?.state === "unknown") severityScore = Math.min(severityScore, 52);
    else if (tech?.state === "used" && activelyExploited && direct) severityScore = 85;
    else if (ENTERPRISE_IT.test(text) && activelyExploited) severityScore = 65;
    severityScore = tech?.state === "used" && activelyExploited && direct ? severityScore : Math.min(severityScore, 79);
  }
  if (relevanceStatus === "reject") severityScore = Math.min(severityScore, 34);
  severityScore = Math.max(0, Math.min(100, severityScore));
  const severity: IntelSeverity = severityScore >= 80 ? "act_now" : severityScore >= 55 ? "this_week" : "awareness";
  if (SOURCE_ALARM.test(headline)) reasons.push("publisher severity language ignored");
  reasons.push(direct ? "direct Hitek exposure evidence" : "no confirmed direct Hitek exposure");

  const sourceSeverity = input.sourceSeverity || (SOURCE_ALARM.exec(headline)?.[0]?.toLowerCase() ?? null);
  const publishable = relevanceStatus === "accept" && departmentConfidence >= 0.7 && Boolean(headline && summary);

  return {
    department,
    departmentConfidence,
    severity,
    severityScore,
    relevanceScore,
    classificationReason: reasons.join("; "),
    publishable,
    relevanceStatus,
    sourceSeverity,
    decisionReasons: reasons,
  };
}

export function departmentAction(department: IntelDepartment, severity: IntelSeverity, subject: string): string {
  if (severity === "awareness") return "Monitor only — no immediate Hitek action required.";
  switch (department) {
    case "operations": return `Check exposed bookings and routes, confirm carrier alternatives, and notify affected operations owners.`;
    case "compliance": return `Validate the new requirement against current files and update the relevant customs or compliance checklist.`;
    case "finance": return `Quantify the cost exposure, review customer pass-through terms, and alert Finance to material variance.`;
    case "commercial": return `Brief account owners on capacity or pricing implications before the next customer quotation.`;
    case "it": return `Confirm exposure with IT, apply the vendor guidance, and notify users only if service continuity is affected.`;
  }
}

export function buildHitekImpactAction(input: { headline?: string | null; summary?: string | null; assessment: QualityAssessment }): { impact: string; action: string } {
  const text = `${input.headline || ""} ${input.summary || ""}`;
  const { department, severity } = input.assessment;
  if (department === "it") {
    if (/elementor/i.test(text)) return {
      impact: "A remote-code-execution vulnerability affects certain Elementor Pro installations. It is relevant to Hitek only if an affected company website is running the vulnerable plugin and version.",
      action: "IT should verify whether any Hitek website uses Elementor Pro and check its version. If affected, patch immediately; otherwise no further action is required.",
    };
    if (/zimbra/i.test(text)) return {
      impact: "An actively exploited Zimbra vulnerability may expose email systems running an affected version. Hitek exposure depends on whether Zimbra is deployed and which version is in use.",
      action: "IT should verify whether Hitek uses Zimbra, check the deployed version, and apply the vendor patch immediately if affected.",
    };
    if (/autonomous ai|attack your own systems|ai attacks?/i.test(text)) return {
      impact: "AI-driven attack tools are becoming more capable and may increase the sophistication and frequency of attacks against corporate infrastructure. This is a strategic cybersecurity trend, not evidence of an immediate compromise of Hitek systems.",
      action: "IT should monitor the development and review whether current penetration testing, endpoint protection, and security monitoring remain sufficient. No immediate operational action is required.",
    };
    return {
      impact: "The issue may affect Hitek only if the referenced product, service, or vulnerable version is present in its technology environment; no direct compromise is currently confirmed.",
      action: severity === "awareness" ? "IT should monitor the advisory and verify applicability during routine security review. No immediate operational action is required." : "IT should verify whether Hitek uses the affected product or version and patch or mitigate it if required.",
    };
  }
  if (department === "operations") return {
    impact: /red sea|suez|gulf of aden|bab el-mandeb/i.test(text)
      ? "Security conditions on the Red Sea corridor may affect Asia–Europe and Asia–Morocco services if carriers suspend routes or divert around the Cape of Good Hope, increasing transit times and surcharges."
      : "The event may affect shipment timing or capacity on the identified route; the practical impact depends on active Hitek bookings and carrier operating decisions.",
    action: severity === "awareness" ? "Monitor carrier and infrastructure advisories; no immediate Hitek action is required." : "Operations should check active shipments using the affected route and monitor carrier advisories for delays, suspensions, or rerouting.",
  };
  if (department === "compliance") return { impact: "The requirement may change how affected shipments are documented or cleared, depending on its scope and effective date.", action: "Compliance should review the requirement and identify affected shipments before the effective date." };
  if (department === "commercial") return { impact: "The development may create a future freight opportunity or change customer demand relevant to Hitek's target sectors and trade lanes.", action: "Commercial should add the company or project to its watchlist and assess likely freight requirements." };
  return { impact: "The development may change freight, fuel, surcharge, currency, duty, or insurance costs relevant to Hitek pricing and margin assumptions.", action: "Finance should review the expected cost exposure and update pricing assumptions if the change is material." };
}

export function deterministicSummary(headline: string, sourceSummary?: string | null): string {
  const cleaned = String(sourceSummary || "").replace(/\s+/g, " ").trim();
  if (cleaned.length >= 80) return cleaned.slice(0, 600);
  return `${headline.replace(/[.\s]+$/, "")}. The signal is being tracked for potential effects on freight movements, compliance, cost, or customer commitments.`;
}