import { describe, expect, it } from "vitest";
import { normalizeUrl, validatePublicHttpUrl } from "../src/url.js";
import { contentHash, generateApiKey, sha256 } from "../src/crypto.js";

describe("validatePublicHttpUrl", () => {
  it("accepts public https URLs", () => {
    const r = validatePublicHttpUrl("https://example.com/pricing");
    expect(r.ok).toBe(true);
    expect(r.normalized).toContain("example.com");
  });

  it("blocks localhost", () => {
    expect(validatePublicHttpUrl("http://localhost:3000").ok).toBe(false);
    expect(validatePublicHttpUrl("http://127.0.0.1/").ok).toBe(false);
  });

  it("blocks private IPs", () => {
    expect(validatePublicHttpUrl("http://10.0.0.5/").ok).toBe(false);
    expect(validatePublicHttpUrl("http://192.168.1.1/").ok).toBe(false);
    expect(validatePublicHttpUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
  });

  it("blocks non-http schemes", () => {
    expect(validatePublicHttpUrl("file:///etc/passwd").ok).toBe(false);
    expect(validatePublicHttpUrl("ftp://example.com").ok).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it("strips tracking params and hash", () => {
    const n = normalizeUrl("https://Example.com/path/?utm_source=x&ok=1#frag");
    expect(n).toBe("https://example.com/path?ok=1");
  });
});

describe("hashing", () => {
  it("is deterministic", () => {
    expect(contentHash("hello")).toBe(sha256("hello"));
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });

  it("generates masked api keys", () => {
    const key = generateApiKey();
    expect(key.raw.startsWith("trc_live_")).toBe(true);
    expect(key.hash).toHaveLength(64);
  });
});
