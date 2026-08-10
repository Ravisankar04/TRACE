/**
 * URL validation + SSRF protection for TRACE crawler.
 * Blocks localhost, private ranges, link-local, metadata endpoints.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".lan"];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null;
  }
  // Force unsigned 32-bit to avoid JS signed bitwise pitfalls
  return (((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!) >>> 0;
}

function inCidr(ipInt: number, base: number, maskBits: number): boolean {
  const mask = maskBits === 0 ? 0 : ((0xffffffff << (32 - maskBits)) >>> 0);
  return (ipInt & mask) === (base & mask);
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  if (inCidr(n, 0x00000000, 8)) return true; // 0.0.0.0/8
  if (inCidr(n, 0x0a000000, 8)) return true; // 10.0.0.0/8
  if (inCidr(n, 0x7f000000, 8)) return true; // 127.0.0.0/8
  if (inCidr(n, 0xa9fe0000, 16)) return true; // 169.254.0.0/16
  if (inCidr(n, 0xac100000, 12)) return true; // 172.16.0.0/12
  if (inCidr(n, 0xc0a80000, 16)) return true; // 192.168.0.0/16
  if (inCidr(n, 0x64400000, 10)) return true; // 100.64.0.0/10
  if (inCidr(n, 0xc0000000, 24)) return true; // 192.0.0.0/24
  if (inCidr(n, 0xc0000200, 24)) return true; // 192.0.2.0/24
  if (inCidr(n, 0xc6336400, 24)) return true; // 198.51.100.0/24
  if (inCidr(n, 0xcb007100, 24)) return true; // 203.0.113.0/24
  if (inCidr(n, 0xe0000000, 4)) return true; // 224.0.0.0/4 multicast+
  return false;
}

function isBlockedIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA
  if (h.startsWith("fe80")) return true; // link-local
  if (h.startsWith("ff")) return true; // multicast
  // IPv4-mapped
  const mapped = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped?.[1] && isPrivateOrReservedIpv4(mapped[1])) return true;
  return false;
}

export interface UrlValidationResult {
  ok: boolean;
  url?: URL;
  normalized?: string;
  reason?: string;
}

export function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  url.hash = "";
  // Strip common tracking params
  const tracking = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
    "_ga",
    "ref",
  ];
  for (const key of tracking) url.searchParams.delete(key);
  // Normalize trailing slash for non-root paths: keep as-is but lowercase host
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function validatePublicHttpUrl(input: string): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "Invalid URL format." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https URLs are allowed." };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (!host) {
    return { ok: false, reason: "Hostname is required." };
  }

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "Localhost and metadata hosts are blocked." };
  }

  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "Internal hostnames are blocked." };
  }

  // Bare IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateOrReservedIpv4(host)) {
      return { ok: false, reason: "Private or reserved IP addresses are blocked (SSRF protection)." };
    }
  } else if (host.includes(":")) {
    if (isBlockedIpv6(host)) {
      return { ok: false, reason: "Private or reserved IPv6 addresses are blocked (SSRF protection)." };
    }
  }

  // Block credentials in URL
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with embedded credentials are not allowed." };
  }

  // Block non-default dangerous ports commonly used internally
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  const blockedPorts = new Set([22, 23, 25, 135, 139, 445, 3306, 5432, 6379, 11211, 27017]);
  if (blockedPorts.has(port)) {
    return { ok: false, reason: `Port ${port} is not allowed for crawling.` };
  }

  const normalized = normalizeUrl(url.toString());
  return { ok: true, url: new URL(normalized), normalized };
}

export function isSameRegistrableDomain(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.toLowerCase();
    const hb = new URL(b).hostname.toLowerCase();
    return ha === hb || ha.endsWith(`.${hb}`) || hb.endsWith(`.${ha}`);
  } catch {
    return false;
  }
}
