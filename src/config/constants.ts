export const BASE_URL = "https://www.futurepedia.io";
export const OUTPUT_FILE = "futurepedia_tools.csv";
export const DETAIL_OUTPUT_FILE = "futurepedia_tools_full.json";

export const MAX_PAGES = Infinity;
export const LISTING_CONCURRENCY = 4;
export const DETAIL_CONCURRENCY = 6;
export const SCROLL_WAIT_MS = 500;
export const MAX_SCROLLS = Infinity;
export const SCRAPE_DETAILS = true;
export const BATCH_SIZE = 60;
export const MAX_RETRIES = 2;

export const BLOCKED_TYPES = new Set(["image", "media", "font"]);

export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

export const CSV_FIELDS = [
  "name", "description", "full_description", "category", "subcategory",
  "tags", "all_categories", "pricing", "prices_found",
  "rating", "overall_rating", "review_count", "rating_dimensions",
  "features", "pros", "cons",
  "official_url", "url", "external_url", "logo_url",
  "social_links", "platform", "verified", "visit_count",
  "last_updated", "target_users", "creator", "badge",
];
