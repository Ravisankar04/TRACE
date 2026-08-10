import type { ChangeSeverity, ChangeType, SemanticDiffResult } from "@trace/shared";
import { computeRawDiff } from "./raw-diff.js";

const PRICE_RE = /(?:\$|€|£)\s?\d+(?:[.,]\d+)?(?:\s?\/\s?(?:mo|month|yr|year|user))?|(?:\d+(?:[.,]\d+)?)\s?(?:USD|EUR|GBP)(?:\s?\/\s?(?:mo|month))?/gi;

const RULES: Array<{
  type: ChangeType;
  severity: ChangeSeverity;
  test: (prev: string, curr: string, added: string, removed: string) => boolean;
  summary: (prev: string, curr: string) => string;
  confidence: number;
}> = [
  {
    type: "PRICE_CHANGE",
    severity: "high",
    confidence: 0.92,
    test: (_p, _c, added, removed) => PRICE_RE.test(added) || PRICE_RE.test(removed),
    summary: () => "Pricing information changed on this page.",
  },
  {
    type: "FEATURE_ADDED",
    severity: "medium",
    confidence: 0.78,
    test: (_p, _c, added) =>
      /\b(new feature|enterprise|pro plan|free tier|api access|sso|audit log)\b/i.test(added),
    summary: () => "New feature or plan language was added.",
  },
  {
    type: "FEATURE_REMOVED",
    severity: "high",
    confidence: 0.8,
    test: (_p, _c, _a, removed) =>
      /\b(free tier|deprecated|removed|no longer|discontinued)\b/i.test(removed) ||
      /\b(free api|starter)\b/i.test(removed),
    summary: () => "Feature or offering language was removed.",
  },
  {
    type: "POLICY_CHANGE",
    severity: "high",
    confidence: 0.85,
    test: (p, c) =>
      /\b(privacy policy|terms of service|terms of use|cookie policy)\b/i.test(p) ||
      /\b(privacy policy|terms of service|terms of use|cookie policy)\b/i.test(c),
    summary: () => "Policy-related content appears to have changed.",
  },
  {
    type: "DOCUMENTATION_CHANGE",
    severity: "medium",
    confidence: 0.7,
    test: (p, c) =>
      /\b(api reference|documentation|getting started|sdk|endpoint)\b/i.test(p + c),
    summary: () => "Documentation content changed.",
  },
  {
    type: "TEAM_CHANGE",
    severity: "medium",
    confidence: 0.72,
    test: (p, c) => /\b(our team|careers|founder|ceo|engineering)\b/i.test(p + c),
    summary: () => "Team or people-related content changed.",
  },
  {
    type: "CONTACT_CHANGE",
    severity: "medium",
    confidence: 0.75,
    test: (_p, _c, a, r) =>
      /@|mailto:|\+\d|contact@|support@/i.test(a + r),
    summary: () => "Contact information changed.",
  },
  {
    type: "PRODUCT_LAUNCH",
    severity: "high",
    confidence: 0.74,
    test: (_p, _c, added) =>
      /\b(introducing|launching|now available|announcing)\b/i.test(added),
    summary: () => "Launch or announcement language was added.",
  },
];

function excerptPrices(text: string): string | undefined {
  const matches = text.match(PRICE_RE);
  return matches ? [...new Set(matches)].slice(0, 5).join(", ") : undefined;
}

function collectChangedLines(previous: string, current: string) {
  const diff = computeRawDiff(previous, current, 0);
  const added = diff.lines.filter((l) => l.type === "add").map((l) => l.text).join("\n");
  const removed = diff.lines.filter((l) => l.type === "remove").map((l) => l.text).join("\n");
  return { added, removed, diff };
}

export function classifySemanticChange(previous: string, current: string): SemanticDiffResult {
  if (previous === current) {
    return {
      type: "TECHNICAL_CHANGE",
      severity: "low",
      summary: "No semantic content difference after normalization.",
      confidence: 1,
    };
  }

  const { added, removed } = collectChangedLines(previous, current);

  for (const rule of RULES) {
    // reset lastIndex on global regexes used in tests
    PRICE_RE.lastIndex = 0;
    if (rule.test(previous, current, added, removed)) {
      const sections = [];
      if (rule.type === "PRICE_CHANGE") {
        sections.push({
          label: "Pricing",
          previous: excerptPrices(removed) || excerptPrices(previous),
          current: excerptPrices(added) || excerptPrices(current),
        });
      }
      return {
        type: rule.type,
        severity: rule.severity,
        summary: rule.summary(previous, current),
        confidence: rule.confidence,
        previousExcerpt: removed.slice(0, 400) || undefined,
        currentExcerpt: added.slice(0, 400) || undefined,
        sections: sections.length ? sections : undefined,
      };
    }
  }

  const addLen = added.length;
  const remLen = removed.length;
  if (addLen > 200 && remLen < 50) {
    return {
      type: "CONTENT_ADDED",
      severity: "medium",
      summary: "Substantial new content was added.",
      confidence: 0.65,
      currentExcerpt: added.slice(0, 400),
    };
  }
  if (remLen > 200 && addLen < 50) {
    return {
      type: "CONTENT_REMOVED",
      severity: "medium",
      summary: "Substantial content was removed.",
      confidence: 0.65,
      previousExcerpt: removed.slice(0, 400),
    };
  }

  // Mostly structural / small edits
  if (addLen + remLen < 120) {
    return {
      type: "TECHNICAL_CHANGE",
      severity: "low",
      summary: "Minor technical or copy edit detected.",
      confidence: 0.6,
      previousExcerpt: removed.slice(0, 200) || undefined,
      currentExcerpt: added.slice(0, 200) || undefined,
    };
  }

  return {
    type: "UNKNOWN",
    severity: "medium",
    summary: "Content changed; classification is uncertain.",
    confidence: 0.4,
    previousExcerpt: removed.slice(0, 400) || undefined,
    currentExcerpt: added.slice(0, 400) || undefined,
  };
}
