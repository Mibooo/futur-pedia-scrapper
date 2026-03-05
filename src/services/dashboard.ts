import type { Stats } from "../types";
import { LISTING_CONCURRENCY, DETAIL_CONCURRENCY } from "../config/constants";

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
};

const hide = "\x1b[?25l";
const show = "\x1b[?25h";
const pad = (n: number): string => String(n).padStart(2, "0");

function progressBar(pct: number, width = 28): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const filledChar = "█";
  const emptyChar = "░";
  return (
    `${c.green}${filledChar.repeat(filled)}${c.gray}${emptyChar.repeat(empty)}${c.reset}` +
    ` ${c.bold}${c.white}${pct}%${c.reset}`
  );
}

function colorNum(n: number, color: string): string {
  return `${c.bold}${color}${n.toLocaleString()}${c.reset}`;
}

function box(lines: string[], width: number): string {
  const top = `${c.blue}╭${"─".repeat(width - 2)}╮${c.reset}`;
  const bot = `${c.blue}╰${"─".repeat(width - 2)}╯${c.reset}`;
  const mid = lines.map((l) => `${c.blue}│${c.reset} ${l}`).join("\n");
  return `${top}\n${mid}\n${bot}`;
}

// ── Live dashboard ───────────────────────────────────────────────────────────

let firstRender = true;
let lastLineCount = 0;

function moveCursorUp(n: number): void {
  if (n > 0) process.stdout.write(`\x1b[${n}A`);
}

function clearDown(): void {
  process.stdout.write("\x1b[J");
}

function render(output: string): void {
  if (firstRender) {
    firstRender = false;
    process.stdout.write(hide);
  } else {
    moveCursorUp(lastLineCount);
    clearDown();
  }
  process.stdout.write(output + "\n");
  lastLineCount = output.split("\n").length;
}

export function initDashboard(): void {
  firstRender = true;
  lastLineCount = 0;
  process.stdout.write(hide);
}

export function cleanupDashboard(): void {
  process.stdout.write(show);
}

// ── Print dashboard ──────────────────────────────────────────────────────────

export function printDashboard(stats: Stats): void {
  const W = 62;
  const mins = Math.floor(stats.elapsed / 60);
  const secs = Math.floor(stats.elapsed % 60);

  const listingPct = stats.categoriesTotal
    ? Math.round((stats.categoriesDone / stats.categoriesTotal) * 100)
    : 0;
  const detailPct = stats.detailsTotal
    ? Math.round((stats.detailsDone / stats.detailsTotal) * 100)
    : 0;

  const phaseColors: Record<string, string> = {
    discovery: c.magenta,
    listings: c.yellow,
    details: c.cyan,
    saving: c.green,
    done: c.green,
  };
  const phaseColor = phaseColors[stats.phase] || c.white;
  const phaseLabel = `${phaseColor}${c.bold}● ${stats.phase.toUpperCase()}${c.reset}`;

  const lines: string[] = [];

  // Header
  const title = `${c.bold}${c.bgBlue}${c.white} FUTUREPEDIA SCRAPER ${c.reset}`;
  const timer = `${c.dim}${pad(mins)}:${pad(secs)}${c.reset}`;
  const rate = `${c.green}${c.bold}${stats.rate.toFixed(1)}${c.reset}${c.dim}/s${c.reset}`;
  lines.push(`${title}  ${phaseLabel}  ${timer}  ${rate}`.padEnd(W));
  lines.push("");

  // Stats grid
  const toolsStr = colorNum(stats.toolsFound, c.green);
  const catsStr = `${c.bold}${c.yellow}${stats.categoriesDone}${c.dim}/${stats.categoriesTotal}${c.reset}`;
  const detailStr = `${c.bold}${c.cyan}${stats.detailsDone}${c.dim}/${stats.detailsTotal}${c.reset}`;
  const pagesStr = colorNum(stats.pagesScraped, c.magenta);
  const errStr = stats.errors.length
    ? `${c.bold}${c.red}${stats.errors.length}${c.reset}`
    : `${c.dim}0${c.reset}`;

  lines.push(
    `  ${c.dim}Tools${c.reset}  ${toolsStr}   ${c.dim}Cats${c.reset}  ${catsStr}   ${c.dim}Details${c.reset}  ${detailStr}   ${c.dim}Pages${c.reset}  ${pagesStr}   ${c.dim}Err${c.reset}  ${errStr}`.padEnd(W),
  );
  lines.push("");

  // Progress bars
  lines.push(
    `  ${c.dim}Listings${c.reset}  ${progressBar(listingPct)}   ${c.dim}${stats.categoriesDone}/${stats.categoriesTotal}${c.reset}`.padEnd(W),
  );
  lines.push(
    `  ${c.dim}Details ${c.reset}  ${progressBar(detailPct)}   ${c.dim}${stats.detailsDone}/${stats.detailsTotal}${c.reset}`.padEnd(W),
  );
  lines.push("");

  // Active workers
  if (stats.currentWorkers.length) {
    const visible = stats.currentWorkers.slice(-4);
    const extra = stats.currentWorkers.length > 4
      ? `${c.dim} +${stats.currentWorkers.length - 4}${c.reset}`
      : "";
    const workerList = visible.map((w) => `${c.cyan}${w}${c.reset}`).join(`${c.dim} │ ${c.reset}`);
    lines.push(`  ${c.dim}Workers${c.reset}  ${workerList}${extra}`.padEnd(W));
  } else {
    lines.push(`  ${c.dim}Workers  —${c.reset}`.padEnd(W));
  }
  lines.push("");

  // Category breakdown
  const cats = Object.entries(stats.categoryTools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (cats.length) {
    const maxCat = cats[0][1] || 1;
    const catLines = cats.map(([name, count]) => {
      const barW = 16;
      const filled = Math.round((count / maxCat) * barW);
      const miniBar = `${c.green}${"█".repeat(filled)}${c.gray}${"░".repeat(barW - filled)}${c.reset}`;
      return `  ${c.bold}${name.padEnd(16)}${c.reset} ${miniBar} ${c.bold}${c.white}${count}${c.reset}`;
    });
    lines.push(`  ${c.dim}── Categories ──────────────────────────${c.reset}`.padEnd(W));
    lines.push(...catLines);
  }

  // Retries
  if (stats.retries > 0) {
    lines.push("");
    lines.push(`  ${c.yellow}⚠ ${stats.retries} retries${c.reset}`.padEnd(W));
  }

  // Errors
  if (stats.errors.length) {
    lines.push("");
    lines.push(`  ${c.red}${c.bold}✗ Last errors:${c.reset}`.padEnd(W));
    for (const err of stats.errors.slice(-2)) {
      lines.push(`  ${c.dim}${c.red}${err.slice(0, 56)}${c.reset}`.padEnd(W));
    }
  }

  render(box(lines, W));
}

// ── Banner ───────────────────────────────────────────────────────────────────

export function printBanner(categoriesTotal: number): void {
  const lines = [
    "",
    `  ${c.bold}${c.bgBlue}${c.white} FUTUREPEDIA.IO ${c.reset}${c.bold}${c.bgGreen}${c.white} AI TOOLS SCRAPER ${c.reset}`,
    "",
    `  ${c.dim}Categories${c.reset}   ${c.bold}${categoriesTotal}${c.reset}`,
    `  ${c.dim}Listing  ${c.reset}    ${c.bold}${LISTING_CONCURRENCY}${c.reset}${c.dim} workers${c.reset}`,
    `  ${c.dim}Detail   ${c.reset}    ${c.bold}${DETAIL_CONCURRENCY}${c.reset}${c.dim} workers${c.reset}`,
    "",
  ];
  console.log(box(lines, 44));
  console.log();
}

// ── Summary ──────────────────────────────────────────────────────────────────

export function printSummary(stats: Stats, toolCount: number, csvPath: string, jsonPath: string): void {
  const elapsed = stats.elapsed;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);

  const lines: string[] = [];
  lines.push("");
  lines.push(`  ${c.bold}${c.bgGreen}${c.white} SCRAPE COMPLETE ${c.reset}`);
  lines.push("");

  const rows: [string, string][] = [
    ["Total tools", `${c.bold}${c.green}${toolCount.toLocaleString()}${c.reset}`],
    ["Categories", `${c.bold}${stats.categoriesDone}${c.reset}`],
    ["Pages", `${c.bold}${stats.pagesScraped.toLocaleString()}${c.reset}`],
    ["Details", `${c.bold}${stats.detailsDone.toLocaleString()}${c.reset}`],
    ["Failures", stats.detailsFailed ? `${c.bold}${c.red}${stats.detailsFailed}${c.reset}` : `${c.dim}0${c.reset}`],
    ["Retries", stats.retries ? `${c.bold}${c.yellow}${stats.retries}${c.reset}` : `${c.dim}0${c.reset}`],
    ["Errors", stats.errors.length ? `${c.bold}${c.red}${stats.errors.length}${c.reset}` : `${c.dim}0${c.reset}`],
    ["Duration", `${c.bold}${mins}m ${secs}s${c.reset}`],
    ["Rate", `${c.bold}${elapsed > 0 ? (toolCount / elapsed).toFixed(1) : "-"}${c.reset}${c.dim} tools/s${c.reset}`],
  ];
  for (const [label, value] of rows) {
    lines.push(`  ${c.dim}${label.padEnd(14)}${c.reset} ${value}`);
  }
  lines.push("");
  lines.push(`  ${c.dim}CSV ${c.reset}  ${c.blue}${c.bold}${csvPath}${c.reset}`);
  lines.push(`  ${c.dim}JSON${c.reset}  ${c.blue}${c.bold}${jsonPath}${c.reset}`);
  lines.push("");

  // Category bars
  if (Object.keys(stats.categoryTools).length) {
    lines.push(`  ${c.dim}── Tools by Category ───────────────────${c.reset}`);
    const maxCount = Math.max(...Object.values(stats.categoryTools));
    for (const [cat, count] of Object.entries(stats.categoryTools).sort((a, b) => b[1] - a[1])) {
      const barW = 20;
      const filled = Math.round((count / maxCount) * barW);
      const miniBar = `${c.green}${"█".repeat(filled)}${c.gray}${"░".repeat(barW - filled)}${c.reset}`;
      lines.push(`  ${c.bold}${cat.padEnd(16)}${c.reset} ${miniBar} ${c.bold}${count}${c.reset}`);
    }
    lines.push("");
  }

  // Errors
  if (stats.errors.length) {
    lines.push(`  ${c.dim}── Errors ─────────────────────────────${c.reset}`);
    for (const err of stats.errors.slice(-10)) {
      lines.push(`  ${c.red}${err.slice(0, 54)}${c.reset}`);
    }
    lines.push("");
  }

  console.log(box(lines, 60));
}
