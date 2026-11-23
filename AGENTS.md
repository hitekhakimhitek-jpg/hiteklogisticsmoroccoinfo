# Architecture decisions
- Keep news ingestion resilient without paid scraping: use the free RSS fallback, preserve publisher attribution, and persist temporary provider cooldowns so scheduled runs recover automatically.
- Keep scraped-news text normalization in a dependency-free shared utility so collectors and dashboard views render the same clean text.