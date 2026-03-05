# Futurepedia Scraper

TypeScript scraper that extracts all AI tool listings from [futurepedia.io](https://www.futurepedia.io) using Playwright for JS-rendered content.

## How it works

1. **Discovery** — Automatically scrapes all categories/subcategories from the `/ai-tools` page
2. **Listings** — Crawls each subcategory, scrolls and paginates to collect all tool cards
3. **Details** — Visits each tool's detail page to extract full data (description, pricing, reviews, social links, etc.)
4. **Export** — Outputs deduplicated CSV and JSON files

## Prerequisites

- Node.js >= 18

## Installation

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
npm start        # build + run
npm run dev      # run directly via tsx (no build step)
```

## Lint

```bash
npm run lint       # check
npm run lint:fix   # auto-fix
```

## Output files

| File | Content |
|---|---|
| `futurepedia_tools.csv` | Tabular data (28 columns) |
| `futurepedia_tools_full.json` | Full data in JSON format |

### CSV columns

`name`, `description`, `full_description`, `category`, `subcategory`, `tags`, `all_categories`, `pricing`, `prices_found`, `rating`, `overall_rating`, `review_count`, `rating_dimensions`, `features`, `pros`, `cons`, `official_url`, `url`, `external_url`, `logo_url`, `social_links`, `platform`, `verified`, `visit_count`, `last_updated`, `target_users`, `creator`, `badge`

## Project structure

```
src/
├── index.ts                    # Entry point
├── types.ts                    # TypeScript interfaces
├── config/
│   ├── constants.ts            # Configuration (concurrency, timeouts, user-agents)
│   └── extractors.ts           # JS functions evaluated in the browser
├── services/
│   ├── categoryDiscovery.ts    # Dynamic category discovery
│   ├── scraper.ts              # Listing and detail page scraping
│   ├── stats.ts                # Real-time stats tracking
│   └── dashboard.ts            # Terminal dashboard display
└── utils/
    ├── semaphore.ts            # Concurrency control
    ├── helpers.ts              # Utility functions (scroll, retry, sleep)
    └── csv.ts                  # CSV export
```

## Configuration

Settings are in `src/config/constants.ts`:

| Parameter | Default | Description |
|---|---|---|
| `LISTING_CONCURRENCY` | 4 | Parallel workers for listing pages |
| `DETAIL_CONCURRENCY` | 6 | Parallel workers for detail pages |
| `SCRAPE_DETAILS` | true | Enable/disable detail page scraping |
| `BATCH_SIZE` | 60 | Batch size for detail scraping |
| `MAX_RETRIES` | 2 | Retry attempts on failure |
