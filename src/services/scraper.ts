import type { BrowserContext } from "playwright";
import type { Stats, Semaphore, ToolListing } from "../types";
import { BASE_URL, MAX_PAGES } from "../config/constants";
import { extractListingCards, extractToolDetail } from "../config/extractors";
import { blockResources, smartScroll, gotoWithRetry, sleep, randomBetween } from "../utils/helpers";

export async function scrapeCategory(
  context: BrowserContext,
  slug: string,
  category: string,
  seenUrls: Set<string>,
  stats: Stats,
): Promise<ToolListing[]> {
  const tools: ToolListing[] = [];
  const url = `${BASE_URL}/ai-tools/${slug}`;

  stats.addWorker(slug);

  const page = await context.newPage();
  await page.route("**/*", blockResources);

  try {
    const ok = await gotoWithRetry(page, url, undefined, stats);
    if (!ok) {
      stats.addError(`[${slug}] 404 or failed to load`);
      return tools;
    }
  } catch (e) {
    stats.addError(`[${slug}] ${String(e).slice(0, 60)}`);
    await page.close();
    stats.removeWorker(slug);
    return tools;
  }

  let pageNum = 1;
  while (pageNum <= MAX_PAGES) {
    const prevCount = tools.length;
    await smartScroll(page);

    let rawCards;
    try {
      rawCards = await page.evaluate(extractListingCards);
    } catch (e) {
      stats.addError(`[${slug}] JS eval failed: ${String(e).slice(0, 40)}`);
      break;
    }

    for (const card of rawCards) {
      const href = card.href || "";
      if (!href || !href.includes("/tool/")) continue;
      const toolUrl = href.startsWith("http") ? href : BASE_URL + href;
      if (seenUrls.has(toolUrl)) continue;
      seenUrls.add(toolUrl);
      const name = card.name || href.split("/tool/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      tools.push({
        name,
        description: card.description || "",
        category,
        subcategory: slug,
        tags: card.tags || "",
        url: toolUrl,
        logo_url: card.logo_url || "",
        rating: card.rating || "",
        review_count: card.review_count || "",
        pricing: card.pricing || "",
        badge: card.badge || "",
        external_url: card.external_url || "",
      });
    }

    stats.pagesScraped++;
    if (tools.length === prevCount) break;

    const nextBtn = await page.$(
      "a[aria-label='Next page']:visible, button:has-text('Next'):visible, " +
        "a:has-text('Next'):visible, [class*='pagination'] a:last-child:visible",
    );

    if (nextBtn) {
      try {
        await nextBtn.click({ timeout: 5000 });
        await page.waitForTimeout(1500);
        try {
          await page.waitForSelector('a[href*="/tool/"]', { timeout: 5_000 });
        } catch { /* no new cards */ }
        pageNum++;
      } catch {
        break;
      }
    } else {
      const nextUrl = `${BASE_URL}/ai-tools/${slug}?page=${pageNum + 1}`;
      try {
        const ok = await gotoWithRetry(page, nextUrl, 1, stats);
        if (!ok) break;
        pageNum++;
      } catch {
        break;
      }
    }
  }

  await page.close();

  stats.toolsFound += tools.length;
  stats.categoriesDone++;
  stats.categoryTools[category] = (stats.categoryTools[category] || 0) + tools.length;
  stats.removeWorker(slug);

  await sleep(randomBetween(500, 1500));
  return tools;
}

export async function scrapeToolDetail(
  context: BrowserContext,
  tool: ToolListing,
  sem: Semaphore,
  stats: Stats,
): Promise<ToolListing> {
  const shortName = tool.name.slice(0, 25);
  stats.addWorker(shortName);

  await sem.acquire();
  const page = await context.newPage();
  await page.route("**/*", blockResources);

  try {
    await page.goto(tool.url, { waitUntil: "load", timeout: 40_000 });
    await page.waitForTimeout(1200);
    await smartScroll(page);

    const detail = await page.evaluate(extractToolDetail);
    Object.assign(tool, {
      full_description: detail.full_description || "",
      meta_description: detail.meta_description || "",
      pricing_raw: detail.pricing_raw || "",
      prices_found: detail.prices_found || "",
      rating_dimensions: detail.rating_dimensions || "{}",
      overall_rating: detail.overall_rating || tool.rating || "",
      detail_review_count: detail.review_count || tool.review_count || "",
      features: detail.features || "",
      pros: detail.pros || "",
      cons: detail.cons || "",
      all_categories: detail.all_categories || "",
      social_links: detail.social_links || "{}",
      official_url: detail.official_url || "",
      platform: detail.platform || "",
      verified: detail.verified || "",
      visit_count: detail.visit_count || "",
      last_updated: detail.last_updated || "",
      target_users: detail.target_users || "",
      creator: detail.creator || "",
      json_ld: detail.json_ld || "[]",
    });
  } catch (e) {
    stats.detailsFailed++;
    stats.addError(`[${tool.name.slice(0, 30)}] ${String(e).slice(0, 50)}`);
  } finally {
    await page.close();
    sem.release();
  }

  stats.detailsDone++;
  stats.removeWorker(shortName);

  await sleep(randomBetween(200, 600));
  return tool;
}
