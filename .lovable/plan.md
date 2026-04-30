## Goal

Make regulatory news (the items shown on the Regulatory Changes page) outrank ordinary dashboard news in the Top News digest, so anything important from Regulatory Changes always appears first on the dashboard.

## Change

Update the sort logic in `src/components/dashboard/DailyDigest.tsx` so that, at the same priority level, items with `category === "regulation"` or `category === "compliance"` are ranked above items from other categories.

Final ranking order:
1. `action_required = true` first
2. Priority: critical → important → informational
3. Regulatory/compliance items before other categories (new tiebreaker)
4. Most recent `published_date` last

The existing rule that always surfaces every critical item (including critical regulatory ones) stays in place. Top 3 cap stays.

## Technical detail

In `DailyDigest.tsx`, extend the comparator:

```ts
const isRegulatory = (e: DbNewsEntry) =>
  e.category === "regulation" || e.category === "compliance";

const sorted = [...entries].sort((a, b) => {
  if (a.action_required !== b.action_required) return a.action_required ? -1 : 1;
  if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
  if (isRegulatory(a) !== isRegulatory(b)) return isRegulatory(a) ? -1 : 1;
  return b.published_date.localeCompare(a.published_date);
});
```

No other files, hooks, or edge functions need to change. The Regulatory Changes page already filters on these same categories, so this guarantees consistency between the two views.

## Files

- `src/components/dashboard/DailyDigest.tsx` (edit)