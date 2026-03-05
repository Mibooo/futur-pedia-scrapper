# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scraper that extracts AI tool listings from futurepedia.io using Playwright for JS-rendered content. Two implementations exist: a legacy single-file Python version and the main TypeScript version.

## Setup

### TypeScript (main)
```bash
npm install
npx playwright install chromium
```

### Python (legacy)
```bash
pip install playwright pandas
playwright install chromium
```

## Running

### TypeScript
```bash
npm run dev          # dev with tsx
npm run start        # build + run
npm run build        # compile TS only
npm run lint         # eslint
npm run lint:fix     # eslint --fix
```

Output: `futurepedia_tools.csv` + `futurepedia_tools_full.json`

### Python (legacy)
```bash
python main.py
```

Output: `futurepedia_tools.csv`

## Architecture

### TypeScript (`src/`)

- **`src/index.ts`** — entry point, orchestrates 3 phases: category discovery → listing scraping → detail scraping
- **`src/types.ts`** — interfaces: `ToolListing`, `ToolDetail`, `RawCard`, `CategoryEntry`, `Stats`, `Semaphore`
- **`src/config/constants.ts`** — config: URLs, concurrency limits, user agents, CSV fields
- **`src/config/extractors.ts`** — data extraction logic from DOM
- **`src/services/categoryDiscovery.ts`** — dynamically discovers subcategories from the site
- **`src/services/scraper.ts`** — `scrapeCategory()` for listings, `scrapeToolDetail()` for detail pages
- **`src/services/dashboard.ts`** — real-time terminal dashboard during scraping
- **`src/services/stats.ts`** — stats tracking (tools found, pages scraped, errors, etc.)
- **`src/utils/semaphore.ts`** — concurrency limiter
- **`src/utils/csv.ts`** — CSV writer
- **`src/utils/helpers.ts`** — `shuffleArray`, `pickRandom`

Key patterns:
- Concurrent scraping with semaphores (`LISTING_CONCURRENCY=4`, `DETAIL_CONCURRENCY=6`)
- Batched detail scraping (`BATCH_SIZE=60`)
- Deduplication by URL (during scraping + final pass)
- Resource blocking (images, media, fonts) for speed
- User-agent rotation

### Python (`main.py`) — legacy
- Single-file scraper using `playwright.async_api` with `asyncio.run()`
- `CATEGORIES` dict maps URL slugs to category names
- `scrape_category()` handles pagination and tool card extraction
- Outputs deduplicated CSV only
