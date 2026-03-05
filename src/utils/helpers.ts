import type { Page, Route } from "playwright";
import type { Stats } from "../types";
import { BLOCKED_TYPES, MAX_SCROLLS, SCROLL_WAIT_MS, MAX_RETRIES } from "../config/constants";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function blockResources(route: Route): Promise<void> {
  if (BLOCKED_TYPES.has(route.request().resourceType())) {
    await route.abort();
  } else {
    await route.continue();
  }
}

export async function smartScroll(page: Page): Promise<void> {
  let prevHeight = 0;
  for (let i = 0; i < MAX_SCROLLS; i++) {
    const height = await page.evaluate("document.body.scrollHeight") as number;
    if (height === prevHeight) break;
    prevHeight = height;
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(SCROLL_WAIT_MS);
  }
}

export async function gotoWithRetry(
  page: Page,
  url: string,
  retries: number = MAX_RETRIES,
  stats: Stats | null = null,
): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await page.goto(url, { waitUntil: "load", timeout: 45_000 });
      if (resp && resp.status() === 404) return false;

      try {
        await page.waitForSelector('a[href*="/tool/"]', { timeout: 8_000 });
      } catch {
        // Page loaded but no tool cards yet
      }
      await page.waitForTimeout(1000);
      return true;
    } catch (e) {
      if (attempt < retries) {
        if (stats) stats.retries++;
        const wait = 2 + attempt * 3 + randomBetween(0, 2);
        await sleep(wait * 1000);
      } else {
        throw e;
      }
    }
  }
  return false;
}
