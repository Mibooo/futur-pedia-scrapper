import type { Stats } from "../types";

const pad = (n: number): string => String(n).padStart(2, "0");

function bar(pct: number, width = 30): string {
  const filled = Math.round((pct / 100) * width);
  return "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]";
}

export function printDashboard(stats: Stats): void {
  const mins = Math.floor(stats.elapsed / 60);
  const secs = Math.floor(stats.elapsed % 60);

  const listingPct = stats.categoriesTotal
    ? Math.round((stats.categoriesDone / stats.categoriesTotal) * 100)
    : 0;
  const detailPct = stats.detailsTotal
    ? Math.round((stats.detailsDone / stats.detailsTotal) * 100)
    : 0;

  process.stdout.write("\x1B[2J\x1B[H");
  console.log(
    `\n  FUTUREPEDIA SCRAPER  |  ${stats.phase.toUpperCase()}  |  ${pad(mins)}:${pad(secs)}  |  ${stats.rate.toFixed(1)}/s${stats.retries ? `  |  retries:${stats.retries}` : ""}`,
  );
  console.log(
    `  Tools: ${stats.toolsFound}  |  Categories: ${stats.categoriesDone}/${stats.categoriesTotal}  |  Details: ${stats.detailsDone}/${stats.detailsTotal}  |  Pages: ${stats.pagesScraped}  |  Errors: ${stats.errors.length}`,
  );
  console.log(
    `  Listings ${bar(listingPct)} ${listingPct}%    Details ${bar(detailPct)} ${detailPct}%`,
  );

  if (stats.currentWorkers.length) {
    const visible = stats.currentWorkers.slice(-6);
    const extra = stats.currentWorkers.length > 6 ? ` +${stats.currentWorkers.length - 6}` : "";
    console.log(`  Active: ${visible.join(" | ")}${extra}`);
  }

  const cats = Object.entries(stats.categoryTools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (cats.length) {
    console.log(`  Cats: ${cats.map(([c, n]) => `${c}:${n}`).join("  ")}`);
  }

  if (stats.errors.length) {
    for (const err of stats.errors.slice(-2)) {
      console.log(`  ERR: ${err.slice(0, 90)}`);
    }
  }
}

export function printSummary(stats: Stats, toolCount: number): void {
  const elapsed = stats.elapsed;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);

  console.log("\n  -- Scrape Complete ----------------------");
  console.log(`  Total tools:       ${toolCount}`);
  console.log(`  Categories:        ${stats.categoriesDone}`);
  console.log(`  Pages scraped:     ${stats.pagesScraped}`);
  console.log(`  Details scraped:   ${stats.detailsDone}`);
  console.log(`  Detail failures:   ${stats.detailsFailed}`);
  console.log(`  Retries:           ${stats.retries}`);
  console.log(`  Errors:            ${stats.errors.length}`);
  console.log(`  Duration:          ${mins}m ${secs}s`);
  console.log(`  Avg rate:          ${elapsed > 0 ? (toolCount / elapsed).toFixed(1) : "-"} tools/s`);

  if (Object.keys(stats.categoryTools).length) {
    console.log("\n  -- Tools by Category --------------------");
    const maxCount = Math.max(...Object.values(stats.categoryTools));
    for (const [cat, count] of Object.entries(stats.categoryTools).sort((a, b) => b[1] - a[1])) {
      const barLen = Math.round((28 * count) / maxCount);
      console.log(`  ${cat.padEnd(14)} ${String(count).padStart(5)}  ${"#".repeat(barLen)}`);
    }
  }

  if (stats.errors.length) {
    console.log("\n  -- Errors -------------------------------");
    for (const err of stats.errors.slice(-15)) {
      console.log(`  ${err.slice(0, 90)}`);
    }
  }

  console.log();
}
