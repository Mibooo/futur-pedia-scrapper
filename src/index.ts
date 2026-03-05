import { chromium } from "playwright";
import fs from "fs";
import type { ToolListing } from "./types";
import {
  OUTPUT_FILE,
  DETAIL_OUTPUT_FILE,
  LISTING_CONCURRENCY,
  DETAIL_CONCURRENCY,
  SCRAPE_DETAILS,
  BATCH_SIZE,
  USER_AGENTS,
  CSV_FIELDS,
} from "./config/constants";
import { createStats } from "./services/stats";
import { discoverCategories } from "./services/categoryDiscovery";
import { printDashboard, printSummary, printBanner, initDashboard, cleanupDashboard } from "./services/dashboard";
import { scrapeCategory, scrapeToolDetail } from "./services/scraper";
import { createSemaphore } from "./utils/semaphore";
import { shuffleArray, pickRandom } from "./utils/helpers";
import { writeCsv } from "./utils/csv";

function saveProgress(tools: ToolListing[]): void {
  writeCsv(OUTPUT_FILE, CSV_FIELDS, tools);
  fs.writeFileSync(DETAIL_OUTPUT_FILE, JSON.stringify(tools, null, 2), "utf-8");
}

async function main(): Promise<void> {
  const stats = createStats();
  const allTools: ToolListing[] = [];
  let toolsList: ToolListing[] = [];
  const seenUrls = new Set<string>();

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const context = await browser.newContext({
    userAgent: pickRandom(USER_AGENTS),
    viewport: { width: 1280, height: 900 },
  });

  // Phase 0: Discover categories dynamically
  stats.phase = "discovery";
  const categories = await discoverCategories(context);
  stats.categoriesTotal = Object.keys(categories).length;

  printBanner(stats.categoriesTotal);
  initDashboard();

  const dashboardInterval = setInterval(() => printDashboard(stats), 200);

  try {
    // Phase 1: Listing pages
    stats.phase = "listings";
    const listingSem = createSemaphore(LISTING_CONCURRENCY);
    const catItems = shuffleArray(Object.entries(categories));

    const listingPromises = catItems.map(async ([slug, category]) => {
      await listingSem.acquire();
      try {
        const tools = await scrapeCategory(context, slug, category, seenUrls, stats);
        allTools.push(...tools);
      } finally {
        listingSem.release();
      }
    });

    await Promise.all(listingPromises);

    // Deduplicate
    const unique = new Map<string, ToolListing>();
    for (const t of allTools) {
      if (t.url) unique.set(t.url, t);
    }
    toolsList = [...unique.values()].sort((a, b) => a.category.localeCompare(b.category));

    // Save after listings phase
    saveProgress(toolsList);

    // Phase 2: Detail pages
    if (SCRAPE_DETAILS && toolsList.length) {
      stats.phase = "details";
      stats.detailsTotal = toolsList.length;

      const detailSem = createSemaphore(DETAIL_CONCURRENCY);

      for (let i = 0; i < toolsList.length; i += BATCH_SIZE) {
        const batch = toolsList.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((tool) => scrapeToolDetail(context, tool, detailSem, stats)));
        saveProgress(toolsList);
      }
    }

    stats.phase = "saving";
  } finally {
    clearInterval(dashboardInterval);
    cleanupDashboard();
    await context.close();
    await browser.close();
  }

  // Write final outputs
  stats.phase = "done";
  saveProgress(toolsList);

  printSummary(stats, toolsList.length, OUTPUT_FILE, DETAIL_OUTPUT_FILE);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
