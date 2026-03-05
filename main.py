#!/usr/bin/env python3
"""
Futurepedia.io Full Scraper (Enhanced)
=======================================
Scrape all AI tools from futurepedia.io using Playwright (handles JS rendering).
Phase 1: Collect tool cards from listing pages (basic info).
Phase 2: Visit each tool's detail page to extract rich data.

Requirements:
    pip install playwright rich
    playwright install chromium

Usage:
    python main.py
"""

import asyncio
import csv
import json
import random
import time
from dataclasses import dataclass, field

from playwright.async_api import async_playwright, TimeoutError as PwTimeout
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TaskID,
    TextColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
)
from rich.table import Table
from rich.text import Text

console = Console()

# ── Configuration ────────────────────────────────────────────────────────────
BASE_URL = "https://www.futurepedia.io"
OUTPUT_FILE = "futurepedia_tools.csv"
DETAIL_OUTPUT_FILE = "futurepedia_tools_full.json"

CATEGORIES = {
    "productivity": "Productivity", "personal-assistant": "Productivity",
    "research-assistant": "Productivity", "spreadsheet-assistant": "Productivity",
    "translators": "Productivity", "presentations": "Productivity",
    "email-assistant": "Productivity", "search-engine": "Productivity",
    "video": "Video", "video-enhancer": "Video", "video-editing": "Video",
    "video-generators": "Video", "text-to-video": "Video",
    "text-generators": "Text", "prompt-generators": "Text",
    "writing-generators": "Text", "paraphrasing": "Text", "storyteller": "Text",
    "copywriting-assistant": "Text", "summarizer": "Text", "ai-detection": "Text",
    "business": "Business", "website-builders": "Business", "marketing": "Business",
    "seo": "Business", "finance": "Business", "stock-trading": "Business",
    "project-management": "Business", "ticketing-management": "Business",
    "social-media": "Business", "customer-support": "Business",
    "churn-management": "Business", "e-commerce": "Business",
    "human-resources": "Business", "sales-assistant": "Business",
    "legal": "Business", "startup-assistant": "Business", "real-estate": "Business",
    "image": "Image", "design-generators": "Image", "image-generators": "Image",
    "image-editing": "Image", "text-to-image": "Image",
    "automations": "Automation", "workflows": "Automation", "ai-agents": "Automation",
    "art": "Art", "art-generators": "Art", "cartoon-generators": "Art",
    "portrait-generators": "Art", "avatar-generator": "Art",
    "logo-generator": "Art", "3D-generator": "Art",
    "audio-editing": "Audio", "audio-generators": "Audio",
    "text-to-speech": "Audio", "music-generator": "Audio", "transcriber": "Audio",
    "code": "Code", "code-assistant": "Code", "no-code": "Code", "sql-assistant": "Code",
    "education": "Education", "students": "Education", "teachers": "Education",
    "health": "Misc", "fitness": "Misc", "religion": "Misc",
    "fashion-assistant": "Misc", "gift-ideas": "Misc", "fun-tools": "Misc",
    "misc-tools": "Misc", "gaming": "Misc", "travel": "Misc",
    "chatbots": "AI",
}

MAX_PAGES = 50
LISTING_CONCURRENCY = 4       # conservative to avoid rate-limits
DETAIL_CONCURRENCY = 6        # detail pages are lighter
SCROLL_WAIT_MS = 500
MAX_SCROLLS = 15
SCRAPE_DETAILS = True
BATCH_SIZE = 60
MAX_RETRIES = 2               # retry failed page loads

# Rotating user-agents to reduce fingerprinting
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]

# ── JS snippets ──────────────────────────────────────────────────────────────

EXTRACT_JS = """
() => {
    const cards = document.querySelectorAll('a[href*="/tool/"]');
    return [...cards].map(card => {
        const href = card.getAttribute('href') || '';
        const nameEl = card.querySelector('h3, h2, [class*="title"], [class*="name"]');
        const descEl = card.querySelector('p, [class*="description"], [class*="desc"]');
        const tagEls = card.querySelectorAll('a[href*="/ai-tools/"]');
        const tags = [...tagEls].map(t => t.innerText.trim().replace(/^#/, '')).filter(Boolean);
        const imgEl = card.querySelector('img');
        const logoUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
        const allText = card.innerText || '';
        const ratingMatch = allText.match(/Rated\\s+([\\d.]+)\\s+out\\s+of\\s+5/i);
        const reviewMatch = allText.match(/\\((\\d+)\\)/);
        const pricingPatterns = ['Free', 'Freemium', 'Paid', 'Contact for Pricing', 'Free Trial'];
        let pricing = '', badge = '';
        const spans = card.querySelectorAll('span, div');
        for (const el of spans) {
            const txt = el.innerText.trim();
            if (!pricing && pricingPatterns.some(p => txt.toLowerCase().includes(p.toLowerCase())) && txt.length < 40)
                pricing = txt;
            if (!badge && ['Featured', "Editor's Pick", 'Popular', 'New'].includes(txt))
                badge = txt;
        }
        const visitLink = card.querySelector('a[href*="utm_source=futurepedia"]');
        return {
            href, name: nameEl ? nameEl.innerText.trim() : '',
            description: descEl ? descEl.innerText.trim().slice(0, 500) : '',
            tags: tags.join(', '), logo_url: logoUrl,
            rating: ratingMatch ? ratingMatch[1] : '',
            review_count: reviewMatch ? reviewMatch[1] : '',
            pricing, badge,
            external_url: visitLink ? visitLink.href : '',
        };
    });
}
"""

DETAIL_EXTRACT_JS = """
() => {
    const data = {};
    const bodyText = document.body.innerText || '';
    const descEls = document.querySelectorAll('p');
    const descs = [...descEls].map(p => p.innerText.trim()).filter(d => d.length > 80);
    data.full_description = descs.length > 0 ? descs[0] : '';
    const metaDesc = document.querySelector('meta[name="description"]');
    data.meta_description = metaDesc ? metaDesc.content : '';
    const pricingSection = [];
    for (const el of document.querySelectorAll('div, section')) {
        const text = el.innerText || '';
        if (text.includes('/month') && text.length < 200 && !pricingSection.includes(text.trim()))
            pricingSection.push(text.trim());
    }
    data.pricing_raw = pricingSection.slice(0, 10).join(' | ');
    const priceMatches = bodyText.match(/\\$[\\d,]+(?:\\.\\d{2})?(?:\\/\\w+)?/g);
    data.prices_found = priceMatches ? [...new Set(priceMatches)].join(', ') : '';
    const ratingDimensions = {};
    for (const label of ['Accuracy and Reliability','Ease of Use','Functionality and Features',
        'Performance and Speed','Customization and Flexibility','Data Privacy and Security',
        'Support and Resources','Cost-Efficiency','Integration Capabilities','Overall Score']) {
        const regex = new RegExp(label + '\\\\s*[:\\\\-]?\\\\s*([\\\\d.]+)', 'i');
        const match = bodyText.match(regex);
        if (match) ratingDimensions[label] = match[1];
    }
    data.rating_dimensions = JSON.stringify(ratingDimensions);
    const overallMatch = bodyText.match(/Rated\\s+([\\d.]+)\\s+out\\s+of\\s+5/i);
    data.overall_rating = overallMatch ? overallMatch[1] : '';
    const reviewCountMatch = bodyText.match(/(\\d+)\\s+(?:user\\s+)?reviews?/i);
    data.review_count = reviewCountMatch ? reviewCountMatch[1] : '';
    const features = [];
    for (const h of document.querySelectorAll('h3, h4')) {
        const text = h.innerText.trim();
        if (text.length > 3 && text.length < 100) {
            const nextP = h.nextElementSibling;
            if (nextP && nextP.tagName === 'P')
                features.push(text + ': ' + nextP.innerText.trim().slice(0, 200));
        }
    }
    data.features = features.slice(0, 15).join(' || ');
    const pros = [], cons = [];
    for (const li of document.querySelectorAll('li')) {
        const parent = li.closest('div, section, ul');
        const parentText = parent ? (parent.previousElementSibling?.innerText || '') : '';
        if (parentText.toLowerCase().includes('pros')) pros.push(li.innerText.trim());
        else if (parentText.toLowerCase().includes('cons')) cons.push(li.innerText.trim());
    }
    data.pros = pros.slice(0, 10).join(' || ');
    data.cons = cons.slice(0, 10).join(' || ');
    const catLinks = document.querySelectorAll('a[href*="/ai-tools/"]');
    data.all_categories = [...new Set([...catLinks].map(a => a.innerText.trim().replace(/^#/, '')).filter(Boolean))].join(', ');
    const socialLinks = {};
    for (const a of document.querySelectorAll('a[href]')) {
        for (const domain of ['twitter.com','x.com','linkedin.com','youtube.com','instagram.com',
                               'github.com','tiktok.com','discord.gg','facebook.com','reddit.com']) {
            if (a.href.includes(domain) && !a.href.includes('futurepedia')) {
                const key = domain.replace('.com','').replace('.gg','');
                if (!socialLinks[key]) socialLinks[key] = a.href;
            }
        }
    }
    data.social_links = JSON.stringify(socialLinks);
    const visitLink = document.querySelector('a[href*="utm_source=futurepedia"]');
    data.official_url = visitLink ? visitLink.href.split('?')[0] : '';
    const osMatch = bodyText.match(/(?:Platform|Operating System|Available on)[:\\s]+([\\w\\s,]+)/i);
    data.platform = osMatch ? osMatch[1].trim() : '';
    data.verified = bodyText.includes('Verified') ? 'Yes' : 'No';
    const visitMatch = bodyText.match(/(\\d[\\d,]+)\\s+visits?/i);
    data.visit_count = visitMatch ? visitMatch[1].replace(',','') : '';
    const updatedMatch = bodyText.match(/(?:Last\\s+)?[Uu]pdated[:\\s]+(\\d{2}\\/\\d{2}\\/\\d{4})/);
    data.last_updated = updatedMatch ? updatedMatch[1] : '';
    const userPatterns = bodyText.match(/(?:Who (?:Uses|is it for)|Target Users?|Ideal for)[:\\s]+((?:.*?\\n){1,8})/i);
    data.target_users = userPatterns ? userPatterns[1].trim().slice(0, 500) : '';
    const jsonLdData = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { jsonLdData.push(JSON.parse(script.textContent)); } catch(e) {}
    }
    data.json_ld = JSON.stringify(jsonLdData);
    const creatorMatch = bodyText.match(/(?:Created by|Creator)[:\\s]+([\\w\\s]+?)(?:\\n|$)/i);
    data.creator = creatorMatch ? creatorMatch[1].trim() : '';
    return data;
}
"""

BLOCKED_TYPES = {"image", "media", "font"}


# ── Stats tracker ────────────────────────────────────────────────────────────

@dataclass
class Stats:
    start_time: float = field(default_factory=time.time)
    tools_found: int = 0
    categories_done: int = 0
    categories_total: int = 0
    details_done: int = 0
    details_total: int = 0
    details_failed: int = 0
    pages_scraped: int = 0
    retries: int = 0
    phase: str = "init"
    current_workers: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    category_tools: dict = field(default_factory=dict)

    @property
    def elapsed(self) -> float:
        return time.time() - self.start_time

    @property
    def rate(self) -> float:
        if self.elapsed < 1:
            return 0
        if self.phase == "details":
            return self.details_done / self.elapsed
        return self.tools_found / self.elapsed


stats = Stats()


def build_dashboard(progress: Progress) -> Panel:
    grid = Table.grid(expand=True)
    grid.add_column(ratio=1)

    elapsed = stats.elapsed
    mins, secs = divmod(int(elapsed), 60)

    # Title + phase
    title = Text()
    title.append(" FUTUREPEDIA ", style="bold white on blue")
    title.append(" SCRAPER ", style="bold white on dark_green")
    phase_colors = {"init": "dim", "listings": "bold yellow", "details": "bold cyan",
                    "saving": "bold green", "done": "bold green"}
    title.append(f"    {stats.phase.upper()} ", style=phase_colors.get(stats.phase, ""))
    title.append(f"  {mins:02d}:{secs:02d}", style="bold white")
    title.append(f"  {stats.rate:.1f}/s", style="bold green")
    if stats.retries:
        title.append(f"  retries:{stats.retries}", style="yellow")
    grid.add_row(title)
    grid.add_row(Text(""))

    # Stat counters
    st = Table.grid(expand=True)
    for _ in range(5):
        st.add_column(ratio=1)

    def cell(label, val, style="bold white"):
        t = Text()
        t.append(f"{label} ", style="dim")
        t.append(str(val), style=style)
        return t

    st.add_row(
        cell("Tools", f"{stats.tools_found:,}", "bold green"),
        cell("Categories", f"{stats.categories_done}/{stats.categories_total}", "bold yellow"),
        cell("Details", f"{stats.details_done}/{stats.details_total}", "bold cyan"),
        cell("Pages", f"{stats.pages_scraped:,}", "bold magenta"),
        cell("Errors", f"{len(stats.errors)}", "bold red" if stats.errors else "dim"),
    )
    grid.add_row(st)
    grid.add_row(Text(""))

    # Progress bars
    grid.add_row(progress.get_renderable())
    grid.add_row(Text(""))

    # Active workers
    if stats.current_workers:
        wt = Text()
        wt.append(" Active ", style="bold dim")
        visible = stats.current_workers[-6:]
        for i, w in enumerate(visible):
            if i > 0:
                wt.append(" | ", style="dim")
            wt.append(w, style="cyan")
        if len(stats.current_workers) > 6:
            wt.append(f"  +{len(stats.current_workers) - 6}", style="dim")
        grid.add_row(wt)

    # Category breakdown
    if stats.category_tools:
        ct = Text()
        ct.append(" Cats ", style="bold dim")
        for i, (cat, count) in enumerate(sorted(stats.category_tools.items(), key=lambda x: -x[1])[:8]):
            if i > 0:
                ct.append("  ", style="dim")
            ct.append(cat, style="bold")
            ct.append(f":{count}", style="green")
        grid.add_row(ct)

    # Last errors
    if stats.errors:
        et = Text()
        for err in stats.errors[-2:]:
            et.append(f"\n {err[:90]}", style="dim red")
        grid.add_row(et)

    return Panel(
        grid, border_style="blue", padding=(1, 2),
        title="[bold white] futurepedia.io [/]",
        subtitle=f"[dim]{LISTING_CONCURRENCY}L + {DETAIL_CONCURRENCY}D workers[/]",
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _block_resources(route):
    if route.request.resource_type in BLOCKED_TYPES:
        await route.abort()
    else:
        await route.continue_()


async def _smart_scroll(page):
    prev_height = 0
    for _ in range(MAX_SCROLLS):
        height = await page.evaluate("document.body.scrollHeight")
        if height == prev_height:
            break
        prev_height = height
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(SCROLL_WAIT_MS)


async def _goto_with_retry(page, url: str, retries: int = MAX_RETRIES) -> bool:
    """Navigate to URL with retries. Returns True on success."""
    for attempt in range(retries + 1):
        try:
            resp = await page.goto(url, wait_until="load", timeout=45_000)
            if resp and resp.status == 404:
                return False
            # Wait for Next.js hydration — look for tool cards or give it time
            try:
                await page.wait_for_selector(
                    'a[href*="/tool/"]',
                    timeout=8_000,
                )
            except PwTimeout:
                # Page loaded but no tool cards yet — might be empty or slow
                pass
            # Extra settle time for React hydration
            await page.wait_for_timeout(1000)
            return True
        except Exception as e:
            if attempt < retries:
                stats.retries += 1
                wait = 2 + attempt * 3 + random.uniform(0, 2)
                await asyncio.sleep(wait)
            else:
                raise e
    return False


# ── Core scraping ────────────────────────────────────────────────────────────

async def scrape_category(
    context,
    slug: str,
    category: str,
    seen_urls: set,
    lock: asyncio.Lock,
    progress: Progress,
    task_id: TaskID,
) -> list[dict]:
    tools = []
    url = f"{BASE_URL}/ai-tools/{slug}"

    stats.current_workers.append(slug)

    page = await context.new_page()
    await page.route("**/*", _block_resources)

    try:
        ok = await _goto_with_retry(page, url)
        if not ok:
            stats.errors.append(f"[{slug}] 404 or failed to load")
            return tools
    except Exception as e:
        stats.errors.append(f"[{slug}] {str(e)[:60]}")
        await page.close()
        if slug in stats.current_workers:
            stats.current_workers.remove(slug)
        return tools

    page_num = 1
    while page_num <= MAX_PAGES:
        prev_count = len(tools)
        await _smart_scroll(page)

        try:
            raw_cards = await page.evaluate(EXTRACT_JS)
        except Exception as e:
            stats.errors.append(f"[{slug}] JS eval failed: {str(e)[:40]}")
            break

        async with lock:
            for card in raw_cards:
                href = card.get("href", "")
                if not href or "/tool/" not in href:
                    continue
                tool_url = href if href.startswith("http") else BASE_URL + href
                if tool_url in seen_urls:
                    continue
                seen_urls.add(tool_url)
                name = card.get("name") or href.split("/tool/")[-1].replace("-", " ").title()
                tools.append({
                    "name": name,
                    "description": card.get("description", ""),
                    "category": category,
                    "subcategory": slug,
                    "tags": card.get("tags", ""),
                    "url": tool_url,
                    "logo_url": card.get("logo_url", ""),
                    "rating": card.get("rating", ""),
                    "review_count": card.get("review_count", ""),
                    "pricing": card.get("pricing", ""),
                    "badge": card.get("badge", ""),
                    "external_url": card.get("external_url", ""),
                })

        stats.pages_scraped += 1
        new_count = len(tools)

        if new_count == prev_count:
            break

        # Pagination
        next_btn = await page.query_selector(
            "a[aria-label='Next page']:visible, button:has-text('Next'):visible, "
            "a:has-text('Next'):visible, [class*='pagination'] a:last-child:visible"
        )
        if next_btn:
            try:
                await next_btn.click(timeout=5000)
                # Wait for new cards to appear
                await page.wait_for_timeout(1500)
                try:
                    await page.wait_for_selector('a[href*="/tool/"]', timeout=5_000)
                except PwTimeout:
                    pass
                page_num += 1
            except Exception:
                break
        else:
            next_url = f"{BASE_URL}/ai-tools/{slug}?page={page_num + 1}"
            try:
                ok = await _goto_with_retry(page, next_url, retries=1)
                if not ok:
                    break
                page_num += 1
            except Exception:
                break

    await page.close()

    stats.tools_found += len(tools)
    stats.categories_done += 1
    stats.category_tools[category] = stats.category_tools.get(category, 0) + len(tools)
    if slug in stats.current_workers:
        stats.current_workers.remove(slug)
    progress.update(task_id, advance=1)

    # Polite delay between categories to avoid rate-limiting
    await asyncio.sleep(random.uniform(0.5, 1.5))
    return tools


async def scrape_tool_detail(
    context,
    tool: dict,
    sem: asyncio.Semaphore,
    progress: Progress,
    task_id: TaskID,
) -> dict:
    short_name = tool["name"][:25]
    stats.current_workers.append(short_name)

    async with sem:
        page = await context.new_page()
        await page.route("**/*", _block_resources)

        try:
            await page.goto(tool["url"], wait_until="load", timeout=40_000)
            await page.wait_for_timeout(1200)
            await _smart_scroll(page)

            detail = await page.evaluate(DETAIL_EXTRACT_JS)
            tool.update({
                "full_description": detail.get("full_description", ""),
                "meta_description": detail.get("meta_description", ""),
                "pricing_raw": detail.get("pricing_raw", ""),
                "prices_found": detail.get("prices_found", ""),
                "rating_dimensions": detail.get("rating_dimensions", "{}"),
                "overall_rating": detail.get("overall_rating", "") or tool.get("rating", ""),
                "detail_review_count": detail.get("review_count", "") or tool.get("review_count", ""),
                "features": detail.get("features", ""),
                "pros": detail.get("pros", ""),
                "cons": detail.get("cons", ""),
                "all_categories": detail.get("all_categories", ""),
                "social_links": detail.get("social_links", "{}"),
                "official_url": detail.get("official_url", ""),
                "platform": detail.get("platform", ""),
                "verified": detail.get("verified", ""),
                "visit_count": detail.get("visit_count", ""),
                "last_updated": detail.get("last_updated", ""),
                "target_users": detail.get("target_users", ""),
                "creator": detail.get("creator", ""),
                "json_ld": detail.get("json_ld", "[]"),
            })
        except Exception as e:
            stats.details_failed += 1
            stats.errors.append(f"[{tool['name'][:30]}] {str(e)[:50]}")
        finally:
            await page.close()

    stats.details_done += 1
    if short_name in stats.current_workers:
        stats.current_workers.remove(short_name)
    progress.update(task_id, advance=1)

    # Small polite delay
    await asyncio.sleep(random.uniform(0.2, 0.6))
    return tool


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    all_tools: list[dict] = []
    seen_urls: set[str] = set()
    lock = asyncio.Lock()

    stats.categories_total = len(CATEGORIES)

    progress = Progress(
        SpinnerColumn("dots"),
        TextColumn("[bold]{task.description}"),
        BarColumn(bar_width=40, complete_style="green", finished_style="bright_green"),
        MofNCompleteColumn(),
        TextColumn("[dim]|[/]"),
        TimeElapsedColumn(),
        TextColumn("[dim]|[/]"),
        TimeRemainingColumn(),
        expand=True,
    )
    listing_task = progress.add_task("[yellow]Listings ", total=len(CATEGORIES))
    detail_task = progress.add_task("[cyan]Details  ", total=0, visible=False)

    # Banner
    console.print()
    console.print(Panel(
        "[bold blue]FUTUREPEDIA.IO[/] [bold green]AI TOOLS SCRAPER[/]\n"
        f"[dim]{len(CATEGORIES)} subcategories | "
        f"{LISTING_CONCURRENCY} listing workers | "
        f"{DETAIL_CONCURRENCY} detail workers | "
        f"retries: {MAX_RETRIES}[/]",
        border_style="bright_blue", padding=(1, 4),
    ))
    console.print()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": 1280, "height": 900},
        )

        # ── Phase 1: Listing pages ──────────────────────────────────────
        stats.phase = "listings"
        listing_sem = asyncio.Semaphore(LISTING_CONCURRENCY)

        with Live(build_dashboard(progress), console=console, refresh_per_second=4) as live:

            async def refresh_loop():
                while stats.phase in ("listings", "details"):
                    live.update(build_dashboard(progress))
                    await asyncio.sleep(0.25)

            refresh_coro = asyncio.create_task(refresh_loop())

            async def _listing_worker(slug, category):
                async with listing_sem:
                    tools = await scrape_category(
                        context, slug, category, seen_urls, lock, progress, listing_task,
                    )
                    all_tools.extend(tools)

            # Shuffle category order to spread load across different sections
            cat_items = list(CATEGORIES.items())
            random.shuffle(cat_items)

            listing_tasks = [_listing_worker(slug, cat) for slug, cat in cat_items]
            await asyncio.gather(*listing_tasks)

            # Deduplicate
            unique = {t["url"]: t for t in all_tools if t["url"]}
            tools_list = sorted(unique.values(), key=lambda x: x["category"])

            # ── Phase 2: Detail pages ────────────────────────────────────
            if SCRAPE_DETAILS and tools_list:
                stats.phase = "details"
                stats.details_total = len(tools_list)
                progress.update(detail_task, total=len(tools_list), visible=True)

                detail_sem = asyncio.Semaphore(DETAIL_CONCURRENCY)

                for batch_start in range(0, len(tools_list), BATCH_SIZE):
                    batch = tools_list[batch_start:batch_start + BATCH_SIZE]
                    dtasks = [
                        scrape_tool_detail(context, tool, detail_sem, progress, detail_task)
                        for tool in batch
                    ]
                    await asyncio.gather(*dtasks)

            stats.phase = "saving"
            live.update(build_dashboard(progress))
            refresh_coro.cancel()
            try:
                await refresh_coro
            except asyncio.CancelledError:
                pass

        await context.close()
        await browser.close()

    # ── Write outputs ────────────────────────────────────────────────────
    stats.phase = "done"

    csv_fields = [
        "name", "description", "full_description", "category", "subcategory",
        "tags", "all_categories", "pricing", "prices_found",
        "rating", "overall_rating", "review_count", "rating_dimensions",
        "features", "pros", "cons",
        "official_url", "url", "external_url", "logo_url",
        "social_links", "platform", "verified", "visit_count",
        "last_updated", "target_users", "creator", "badge",
    ]
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(tools_list)

    with open(DETAIL_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(tools_list, f, ensure_ascii=False, indent=2)

    # ── Final summary ────────────────────────────────────────────────────
    elapsed = stats.elapsed
    mins, secs = divmod(int(elapsed), 60)

    summary = Table(title="Scrape Complete", border_style="green", show_header=False, padding=(0, 2))
    summary.add_column(style="dim", width=22)
    summary.add_column(style="bold")
    summary.add_row("Total tools", f"[green]{len(tools_list):,}[/]")
    summary.add_row("Categories scraped", f"{stats.categories_done}")
    summary.add_row("Pages scraped", f"{stats.pages_scraped:,}")
    summary.add_row("Details scraped", f"{stats.details_done:,}")
    summary.add_row("Detail failures", f"[red]{stats.details_failed}[/]" if stats.details_failed else "[green]0[/]")
    summary.add_row("Retries", f"[yellow]{stats.retries}[/]" if stats.retries else "0")
    summary.add_row("Total errors", f"[red]{len(stats.errors)}[/]" if stats.errors else "[green]0[/]")
    summary.add_row("Duration", f"{mins}m {secs}s")
    summary.add_row("Avg rate", f"{len(tools_list) / elapsed:.1f} tools/s" if elapsed > 0 else "-")
    summary.add_row("CSV output", f"[blue]{OUTPUT_FILE}[/]")
    summary.add_row("JSON output", f"[blue]{DETAIL_OUTPUT_FILE}[/]")

    console.print()
    console.print(summary)

    if stats.category_tools:
        cat_table = Table(title="Tools by Category", border_style="blue")
        cat_table.add_column("Category", style="bold")
        cat_table.add_column("Count", justify="right", style="green")
        cat_table.add_column("Bar", width=30)
        max_count = max(stats.category_tools.values()) if stats.category_tools else 1
        for cat, count in sorted(stats.category_tools.items(), key=lambda x: -x[1]):
            bar_len = int(28 * count / max_count)
            cat_table.add_row(cat, str(count), "[green]" + "#" * bar_len + "[/]")
        console.print(cat_table)

    if stats.errors:
        err_table = Table(title="Errors", border_style="red", show_lines=True)
        err_table.add_column("Error", style="dim red", max_width=90)
        for err in stats.errors[-15:]:
            err_table.add_row(err[:90])
        console.print(err_table)

    console.print()


if __name__ == "__main__":
    asyncio.run(main())
