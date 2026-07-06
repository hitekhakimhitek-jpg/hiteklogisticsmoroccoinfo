import { defineMcp } from "@lovable.dev/mcp-js";
import searchIntelligence from "./tools/search_intelligence";
import getIntelligenceItem from "./tools/get_intelligence_item";
import listRecentIntelligence from "./tools/list_recent_intelligence";
import getWeeklyDigest from "./tools/get_weekly_digest";

export default defineMcp({
  name: "hitek-info-mcp",
  title: "Hitek Info MCP",
  version: "0.1.0",
  instructions:
    "Hitek Info is a Morocco freight & logistics intelligence dashboard. Use these tools to search recent intelligence items, fetch a specific item by ID, list what happened in the last N days, or read the weekly digest (global/operational/financial).",
  tools: [
    searchIntelligence,
    getIntelligenceItem,
    listRecentIntelligence,
    getWeeklyDigest,
  ],
});