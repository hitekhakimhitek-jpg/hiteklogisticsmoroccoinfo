import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classify, finalStatus } from "./health.ts";

const base = { sourceName: "X", startedAt: Date.now() };

Deno.test("zero new items on a working feed is not broken", () => {
  const c = classify({ ...base, httpStatus: 200, itemsDiscovered: 0 });
  assertEquals(c.status, "no_new_items");
  assertEquals(finalStatus(c, 0), "no_new_items");
});
Deno.test("404 is a failure, broken after 3", () => {
  const c = classify({ ...base, httpStatus: 404, itemsDiscovered: 0, error: "HTTP 404" });
  assertEquals(c.failure, true);
  assertEquals(finalStatus(c, 1), "degraded");
  assertEquals(finalStatus(c, 3), "broken");
});
Deno.test("403 / 429 / timeout are failures with readable reasons", () => {
  assertEquals(classify({ ...base, httpStatus: 403, itemsDiscovered: 0, error: "x" }).reason.startsWith("HTTP 403"), true);
  assertEquals(classify({ ...base, httpStatus: 429, itemsDiscovered: 0, error: "x" }).reason.startsWith("HTTP 429"), true);
  assertEquals(classify({ ...base, httpStatus: 0, itemsDiscovered: 0, error: "timeout" }).failure, true);
});
Deno.test("partial validation failure is degraded", () => {
  assertEquals(classify({ ...base, httpStatus: 200, itemsDiscovered: 7, itemsValid: 2 }).status, "degraded");
  assertEquals(classify({ ...base, httpStatus: 200, itemsDiscovered: 7, itemsValid: 5 }).status, "healthy");
});
Deno.test("parser returning nothing from a real response is degraded", () => {
  assertEquals(classify({ ...base, httpStatus: 200, itemsDiscovered: 0, parserEmpty: true }).status, "degraded");
});
Deno.test("fallback use is degraded", () => {
  assertEquals(classify({ ...base, httpStatus: 200, itemsDiscovered: 3, itemsValid: 3, fallbackUsed: true }).status, "degraded");
});

Deno.test("alert feed: quiet and mostly-expired warnings are not degraded", () => {
  const quiet = classify({ sourceName: "x", itemsDiscovered: 0, startedAt: 0, httpStatus: 200, alertFeed: true, error: "no items" });
  if (quiet.status !== "no_new_items") throw new Error(quiet.status);
  const expired = classify({ sourceName: "x", itemsDiscovered: 39, itemsValid: 16, startedAt: 0, alertFeed: true });
  if (expired.status !== "healthy") throw new Error(expired.status);
});
