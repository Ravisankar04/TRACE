/**
 * Content normalization pipeline:
 * RAW HTML → strip scripts/styles/tracking → whitespace → meaningful text → metadata → hash
 */

const TRACKING_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "template",
  "[aria-hidden='true']",
];

const NOISE_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
  /\b(?:cid|sid|session|request)[_-]?id[=:][^\s"'<>]+/gi,
  /\bgtm-[a-z0-9]+\b/gi,
  /\bUA-\d+-\d+\b/g,
  /\bG-[A-Z0-9]+\b/g,
  /\b\d{10,13}\b/g, // epoch-ish counters
];

export interface NormalizedPage {
  title: string;
  description: string;
  text: string;
  headings: string[];
  links: string[];
  metadata: Record<string, string>;
  normalizedContent: string;
}

function decodeEntities(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html: string): string {
  let out = html;
  for (const tag of TRACKING_SELECTORS) {
    if (tag.startsWith("[")) continue;
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    out = out.replace(re, " ");
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), " ");
  }
  // comments, remaining tags
  out = out.replace(/<!--[\s\S]*?-->/g, " ");
  out = out.replace(/<[^>]+>/g, " ");
  return decodeEntities(out);
}

function extractTagContent(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m?.[1] ? stripTags(m[1]).trim() : "";
}

function extractMeta(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`,
    "i",
  );
  const m = html.match(re);
  return (m?.[1] || m?.[2] || "").trim();
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const t = stripTags(m[1] || "").replace(/\s+/g, " ").trim();
    if (t) headings.push(t);
  }
  return headings;
}

function extractLinks(html: string, baseUrl?: string): string[] {
  const links: string[] = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1]?.trim();
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    try {
      const abs = baseUrl ? new URL(href, baseUrl).toString() : href;
      links.push(abs);
    } catch {
      // ignore bad hrefs
    }
  }
  return [...new Set(links)];
}

function scrubNoise(text: string): string {
  let out = text;
  for (const re of NOISE_PATTERNS) out = out.replace(re, " ");
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

export function normalizeHtml(html: string, baseUrl?: string): NormalizedPage {
  const title = extractTagContent(html, "title");
  const description = extractMeta(html, "description") || extractMeta(html, "og:description");
  const headings = extractHeadings(html);
  const links = extractLinks(html, baseUrl);
  const text = scrubNoise(stripTags(html));
  const metadata: Record<string, string> = {};
  if (title) metadata.title = title;
  if (description) metadata.description = description;
  const ogTitle = extractMeta(html, "og:title");
  if (ogTitle) metadata.ogTitle = ogTitle;

  const normalizedContent = [
    `TITLE: ${title}`,
    `DESCRIPTION: ${description}`,
    `HEADINGS:`,
    ...headings.map((h) => `- ${h}`),
    `TEXT:`,
    text,
  ].join("\n");

  return {
    title,
    description,
    text,
    headings,
    links,
    metadata,
    normalizedContent: scrubNoise(normalizedContent),
  };
}
