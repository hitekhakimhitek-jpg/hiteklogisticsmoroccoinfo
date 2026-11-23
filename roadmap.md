# Reliability follow-through
- [ ] Keep news ingestion flowing when Firecrawl credits or access are unavailable.
- [ ] Include user-added sources in the free RSS fallback and report fallback health accurately.
- [ ] Add regression coverage for duplicate event detection and fallback-related invariants.
- [ ] Clean malformed HTML fragments such as `href=` from news titles and summaries before display.
- [ ] Deploy, run tests, verify a real collection result and scheduled-job health, then commit.
