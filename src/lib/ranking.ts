import type { DbNewsEntry } from "@/hooks/useFreightData";

/**
 * Content-type priority for freight forwarders.
 * Lower number = shown first.
 */
const CONTENT_TYPE_RANK: Record<string, number> = {
  regulatory_change: 0,
  customs_update: 1,
  compliance: 1,
  sanctions_trade_restriction: 1,
  strike_protest_manifestation: 2,
  port_disruption: 2,
  carrier_air_sea_road: 3,
  freight_market_update: 4,
  finance_regulation: 5,
  infrastructure: 6,
  technology_it_news: 7,
  general_news: 8,
};

function contentTypeRank(e: DbNewsEntry): number {
  if (e.content_type && e.content_type in CONTENT_TYPE_RANK) {
    return CONTENT_TYPE_RANK[e.content_type];
  }
  // Fallback from legacy category
  switch (e.category) {
    case "regulation": return 0;
    case "compliance": return 1;
    case "trade":      return 1;
    case "port":       return 2;
    case "weather":    return 2;
    case "market":     return 4;
    default:           return 8;
  }
}

const PRIORITY_RANK = { critical: 0, important: 1, informational: 2 } as const;

/**
 * Canonical ranking used across dashboard surfaces.
 * Order:
 *  1. action_required first
 *  2. content_type rank (regulatory > disruptions > market > IT > general)
 *  3. priority (critical > important > informational)
 *  4. impact_score desc
 *  5. published_date desc
 */
export function rankEntries(entries: DbNewsEntry[]): DbNewsEntry[] {
  return [...entries].sort((a, b) => {
    if (a.action_required !== b.action_required) return a.action_required ? -1 : 1;
    const ctA = contentTypeRank(a);
    const ctB = contentTypeRank(b);
    if (ctA !== ctB) return ctA - ctB;
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    const isA = a.impact_score ?? 0;
    const isB = b.impact_score ?? 0;
    if (isA !== isB) return isB - isA;
    return b.published_date.localeCompare(a.published_date);
  });
}