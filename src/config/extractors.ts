// These functions are serialized and evaluated in the browser context via page.evaluate().
// They must be self-contained — no closures over Node.js variables.
// TypeScript types are stripped at compile time so these run fine in the browser.

export function extractListingCards() {
  const cards = document.querySelectorAll('a[href*="/tool/"]');
  return [...cards].map((card) => {
    const href = card.getAttribute("href") || "";
    const nameEl = card.querySelector('h3, h2, [class*="title"], [class*="name"]');
    const descEl = card.querySelector('p, [class*="description"], [class*="desc"]');
    const tagEls = card.querySelectorAll('a[href*="/ai-tools/"]');
    const tags = [...tagEls].map((t) => t.textContent?.trim().replace(/^#/, "") || "").filter(Boolean);
    const imgEl = card.querySelector("img");
    const logoUrl = imgEl ? (imgEl as HTMLImageElement).src || imgEl.getAttribute("data-src") || "" : "";
    const allText = card.textContent || "";
    const ratingMatch = allText.match(/Rated\s+([\d.]+)\s+out\s+of\s+5/i);
    const reviewMatch = allText.match(/\((\d+)\)/);
    const pricingPatterns = ["Free", "Freemium", "Paid", "Contact for Pricing", "Free Trial"];
    let pricing = "", badge = "";
    const spans = card.querySelectorAll("span, div");
    for (const el of spans) {
      const txt = (el.textContent || "").trim();
      if (!pricing && pricingPatterns.some((p) => txt.toLowerCase().includes(p.toLowerCase())) && txt.length < 40)
        pricing = txt;
      if (!badge && ["Featured", "Editor's Pick", "Popular", "New"].includes(txt))
        badge = txt;
    }
    const visitLink = card.querySelector('a[href*="utm_source=futurepedia"]');
    return {
      href,
      name: nameEl ? (nameEl.textContent || "").trim() : "",
      description: descEl ? (descEl.textContent || "").trim().slice(0, 500) : "",
      tags: tags.join(", "),
      logo_url: logoUrl,
      rating: ratingMatch ? ratingMatch[1] : "",
      review_count: reviewMatch ? reviewMatch[1] : "",
      pricing,
      badge,
      external_url: visitLink ? (visitLink as HTMLAnchorElement).href : "",
    };
  });
}

export function extractToolDetail() {
  const data: Record<string, string> = {};
  const bodyText = document.body.textContent || "";

  const descEls = document.querySelectorAll("p");
  const descs = [...descEls].map((p) => (p.textContent || "").trim()).filter((d) => d.length > 80);
  data.full_description = descs.length > 0 ? descs[0] : "";

  const metaDesc = document.querySelector('meta[name="description"]');
  data.meta_description = metaDesc ? (metaDesc as HTMLMetaElement).content : "";

  const pricingSection: string[] = [];
  for (const el of document.querySelectorAll("div, section")) {
    const text = el.textContent || "";
    if (text.includes("/month") && text.length < 200 && !pricingSection.includes(text.trim()))
      pricingSection.push(text.trim());
  }
  data.pricing_raw = pricingSection.slice(0, 10).join(" | ");

  const priceMatches = bodyText.match(/\$[\d,]+(?:\.\d{2})?(?:\/\w+)?/g);
  data.prices_found = priceMatches ? [...new Set(priceMatches)].join(", ") : "";

  const ratingDimensions: Record<string, string> = {};
  const dimensionLabels = [
    "Accuracy and Reliability", "Ease of Use", "Functionality and Features",
    "Performance and Speed", "Customization and Flexibility", "Data Privacy and Security",
    "Support and Resources", "Cost-Efficiency", "Integration Capabilities", "Overall Score",
  ];
  for (const label of dimensionLabels) {
    const regex = new RegExp(label + "\\s*[:\\-]?\\s*([\\d.]+)", "i");
    const match = bodyText.match(regex);
    if (match) ratingDimensions[label] = match[1];
  }
  data.rating_dimensions = JSON.stringify(ratingDimensions);

  const overallMatch = bodyText.match(/Rated\s+([\d.]+)\s+out\s+of\s+5/i);
  data.overall_rating = overallMatch ? overallMatch[1] : "";

  const reviewCountMatch = bodyText.match(/(\d+)\s+(?:user\s+)?reviews?/i);
  data.review_count = reviewCountMatch ? reviewCountMatch[1] : "";

  const features: string[] = [];
  for (const h of document.querySelectorAll("h3, h4")) {
    const text = (h.textContent || "").trim();
    if (text.length > 3 && text.length < 100) {
      const nextP = h.nextElementSibling;
      if (nextP && nextP.tagName === "P")
        features.push(text + ": " + (nextP.textContent || "").trim().slice(0, 200));
    }
  }
  data.features = features.slice(0, 15).join(" || ");

  const pros: string[] = [], cons: string[] = [];
  for (const li of document.querySelectorAll("li")) {
    const parent = li.closest("div, section, ul");
    const parentText = parent ? (parent.previousElementSibling?.textContent || "") : "";
    if (parentText.toLowerCase().includes("pros")) pros.push((li.textContent || "").trim());
    else if (parentText.toLowerCase().includes("cons")) cons.push((li.textContent || "").trim());
  }
  data.pros = pros.slice(0, 10).join(" || ");
  data.cons = cons.slice(0, 10).join(" || ");

  const catLinks = document.querySelectorAll('a[href*="/ai-tools/"]');
  data.all_categories = [
    ...new Set([...catLinks].map((a) => (a.textContent || "").trim().replace(/^#/, "")).filter(Boolean)),
  ].join(", ");

  const socialLinks: Record<string, string> = {};
  const socialDomains = [
    "twitter.com", "x.com", "linkedin.com", "youtube.com", "instagram.com",
    "github.com", "tiktok.com", "discord.gg", "facebook.com", "reddit.com",
  ];
  for (const a of document.querySelectorAll("a[href]")) {
    const href = (a as HTMLAnchorElement).href;
    for (const domain of socialDomains) {
      if (href.includes(domain) && !href.includes("futurepedia")) {
        const key = domain.replace(".com", "").replace(".gg", "");
        if (!socialLinks[key]) socialLinks[key] = href;
      }
    }
  }
  data.social_links = JSON.stringify(socialLinks);

  const visitLink = document.querySelector('a[href*="utm_source=futurepedia"]');
  data.official_url = visitLink ? (visitLink as HTMLAnchorElement).href.split("?")[0] : "";

  const osMatch = bodyText.match(/(?:Platform|Operating System|Available on)[:\s]+([\w\s,]+)/i);
  data.platform = osMatch ? osMatch[1].trim() : "";
  data.verified = bodyText.includes("Verified") ? "Yes" : "No";

  const visitMatch = bodyText.match(/(\d[\d,]+)\s+visits?/i);
  data.visit_count = visitMatch ? visitMatch[1].replace(",", "") : "";

  const updatedMatch = bodyText.match(/(?:Last\s+)?[Uu]pdated[:\s]+(\d{2}\/\d{2}\/\d{4})/);
  data.last_updated = updatedMatch ? updatedMatch[1] : "";

  const userPatterns = bodyText.match(/(?:Who (?:Uses|is it for)|Target Users?|Ideal for)[:\s]+((?:.*?\n){1,8})/i);
  data.target_users = userPatterns ? userPatterns[1].trim().slice(0, 500) : "";

  const jsonLdData: unknown[] = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { jsonLdData.push(JSON.parse(script.textContent || "")); } catch { /* skip */ }
  }
  data.json_ld = JSON.stringify(jsonLdData);

  const creatorMatch = bodyText.match(/(?:Created by|Creator)[:\s]+([\w\s]+?)(?:\n|$)/i);
  data.creator = creatorMatch ? creatorMatch[1].trim() : "";

  return data;
}
