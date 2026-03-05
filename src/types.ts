export interface ToolListing {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  tags: string;
  url: string;
  logo_url: string;
  rating: string;
  review_count: string;
  pricing: string;
  badge: string;
  external_url: string;
  [key: string]: string;
}

export interface ToolDetail extends ToolListing {
  full_description: string;
  meta_description: string;
  pricing_raw: string;
  prices_found: string;
  rating_dimensions: string;
  overall_rating: string;
  detail_review_count: string;
  features: string;
  pros: string;
  cons: string;
  all_categories: string;
  social_links: string;
  official_url: string;
  platform: string;
  verified: string;
  visit_count: string;
  last_updated: string;
  target_users: string;
  creator: string;
  json_ld: string;
}

export interface RawCard {
  href: string;
  name: string;
  description: string;
  tags: string;
  logo_url: string;
  rating: string;
  review_count: string;
  pricing: string;
  badge: string;
  external_url: string;
}

export interface CategoryEntry {
  slug: string;
  text: string;
  parent: string;
}

export interface Stats {
  startTime: number;
  toolsFound: number;
  categoriesDone: number;
  categoriesTotal: number;
  detailsDone: number;
  detailsTotal: number;
  detailsFailed: number;
  pagesScraped: number;
  retries: number;
  phase: string;
  currentWorkers: string[];
  errors: string[];
  categoryTools: Record<string, number>;
  readonly elapsed: number;
  readonly rate: number;
  addWorker(name: string): void;
  removeWorker(name: string): void;
  addError(msg: string): void;
}

export interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
}
