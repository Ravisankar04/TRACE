import { describe, expect, it } from "vitest";
import { normalizeHtml } from "../src/normalize.js";
import { computeRawDiff } from "../src/raw-diff.js";
import { classifySemanticChange } from "../src/classify.js";

describe("normalizeHtml", () => {
  it("strips scripts and extracts text", () => {
    const html = `<html><head><title>Acme</title><script>track()</script></head>
      <body><h1>Pricing</h1><p>Starter — $19/month</p><span data-ts="2026-01-01T00:00:00Z">x</span></body></html>`;
    const n = normalizeHtml(html);
    expect(n.title).toBe("Acme");
    expect(n.text).toContain("Starter — $19/month");
    expect(n.normalizedContent).not.toContain("track()");
  });
});

describe("diff + classify", () => {
  it("detects price changes", () => {
    const a = "TITLE: Pricing\nTEXT:\nStarter — $19/month\nFree API";
    const b = "TITLE: Pricing\nTEXT:\nStarter — $29/month\nEnterprise plan";
    const diff = computeRawDiff(a, b);
    expect(diff.identical).toBe(false);
    const sem = classifySemanticChange(a, b);
    expect(sem.type).toBe("PRICE_CHANGE");
    expect(sem.confidence).toBeGreaterThan(0.8);
  });
});
