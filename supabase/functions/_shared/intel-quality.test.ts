import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assessIntelligenceQuality, buildHitekImpactAction } from "./intel-quality.ts";
import { nonArticleReason } from "./intel-article.ts";

const cases = [
  ["If you're not using AI to attack your own systems, your adversaries will", "it", "awareness", "review"],
  ["Critical Elementor Pro bug exposes WordPress sites to RCE attacks", "it", "awareness", "review"],
  ["Freight Distress Report: More than 7000 jobs cut in new wave of closures", "operations", "awareness", "reject"],
  ["Autonomous AI attacks pose clear and present danger to critical infrastructure", "it", "awareness", "review"],
  ["Bahri-owned tanker hit in Red Sea", "operations", "this_week", "accept"],
  ["CISA orders urgent patching of actively exploited Zimbra flaw", "it", "this_week", "accept"],
  ["Pirates hijack tanker in Gulf of Aden", "operations", "this_week", "accept"],
  ["Google Cloud Load Balancing release notes", "it", "awareness", "reject"],
  ["Musées: les nouveaux ambassadeurs du tourisme culturel", "commercial", "awareness", "reject"],
] as const;

for (const [headline, department, severity, status] of cases) {
  Deno.test(headline, () => {
    const result = assessIntelligenceQuality({ headline, summary: headline, technologyUsage: { zimbra: "unknown", wordpress: "unknown", "elementor pro": "unknown" } });
    assertEquals(result.department, department);
    assertEquals(result.severity, severity);
    assertEquals(result.relevanceStatus, status);
    const copy = buildHitekImpactAction({ headline, summary: headline, assessment: result });
    if (department === "it") assertEquals(/shipment|customer notification/i.test(copy.action), false);
  });
}

Deno.test("Elementor marked used and actively exploited can become critical only with direct evidence", () => {
  const result = assessIntelligenceQuality({
    headline: "Actively exploited Elementor Pro RCE affects Hitek production website",
    summary: "Confirmed Hitek deployment uses the affected Elementor Pro version and requires action within 24 hours.",
    technologyUsage: { "elementor pro": "used", wordpress: "used" },
    directHitekExposure: true,
  });
  assertEquals(result.department, "it");
  assertEquals(result.severity, "act_now");
});

Deno.test("JOC white papers is rejected as a non-article", () => {
  assertMatch(nonArticleReason({ title: "White Papers | Journal of Commerce", url: "https://www.joc.com/resources/white-papers", content: "Resources" }) || "", /non_article/);
});