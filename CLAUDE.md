# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file Python scraper that extracts AI tool listings from futurepedia.io using Playwright for JS-rendered content. It iterates through ~50 subcategory slugs, paginates through each, and outputs a deduplicated CSV (`futurepedia_tools.csv`).

## Setup

```bash
pip install playwright pandas
playwright install chromium
```

## Running

```bash
python main.py
```

Output: `futurepedia_tools.csv` with columns: name, description, category, subcategory, tags, url.

## Architecture

- **main.py** — entire scraper in one file
  - `CATEGORIES` dict maps URL slugs to high-level category names
  - `scrape_category()` — async function that handles one subcategory: navigates to listing page, scrolls to trigger lazy-loading, extracts tool cards (`a[href^='/tool/']`), and paginates (click-based then URL-based fallback)
  - `main()` — launches headless Chromium via Playwright, iterates all categories, deduplicates by URL, writes CSV
- Uses `playwright.async_api` with `asyncio.run()` entry point
- Deduplication happens both during scraping (`seen_urls` set) and at final output (dict keyed by URL)
