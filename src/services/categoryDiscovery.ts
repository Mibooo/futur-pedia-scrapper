import type { BrowserContext } from "playwright";
import { BASE_URL } from "../config/constants";
import { smartScroll } from "../utils/helpers";

function discoverCategoriesJS(): Array<{ slug: string; text: string; parent: string }> {
  const results: Array<{ slug: string; text: string; parent: string }> = [];
  const seen = new Set<string>();
  const links = document.querySelectorAll('a[href*="ai-tools/"]');

  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const parts = href.split("ai-tools/");
    if (parts.length < 2) continue;

    const slug = parts[1].split("/")[0].split("?")[0];
    if (!slug || slug === "best" || seen.has(slug)) continue;
    seen.add(slug);

    const text = (link.textContent || "").trim();
    if (!text) continue;

    let parent = "";
    let el = link.parentElement;
    while (el) {
      const h2 = el.querySelector(":scope > h2");
      if (h2) {
        parent = (h2.textContent || "").trim();
        break;
      }
      el = el.parentElement;
    }

    results.push({ slug, text, parent });
  }

  return results;
}

export async function discoverCategories(context: BrowserContext): Promise<Record<string, string>> {
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/ai-tools`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(3000);
    await smartScroll(page);

    const raw = await page.evaluate(discoverCategoriesJS);

    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      throw new Error("Failed to discover categories from /ai-tools — page structure may have changed");
    }

    const categories: Record<string, string> = {};
    for (const { slug, parent } of raw) {
      let category = parent
        .replace(/^AI\s+/i, "")
        .replace(/\s+Tools?$/i, "")
        .replace(/\s+Generators?$/i, "")
        .trim();

      if (!category) {
        category = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }

      categories[slug] = category;
    }

    console.log(`  Discovered ${Object.keys(categories).length} categories/subcategories`);
    return categories;
  } finally {
    await page.close();
  }
}
