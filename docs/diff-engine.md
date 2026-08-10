# Diff engine

## Normalization

```text
RAW HTML
  → remove scripts/styles/iframes
  → strip tags to text
  → scrub timestamps / UUIDs / analytics IDs
  → extract title, description, headings
  → canonicalize meaningful representation
  → hash
```

Technical noise must not create false positives. Only normalized content is fingerprinted.

## Raw diff

Line-oriented diff (`diff` package) stored on each `Change` for exact before/after inspection.

## Semantic classification

Deterministic rules first:

- `PRICE_CHANGE`
- `FEATURE_ADDED` / `FEATURE_REMOVED`
- policy / docs / team / contact / launch heuristics
- fallbacks: `CONTENT_ADDED`, `CONTENT_REMOVED`, `TECHNICAL_CHANGE`, `UNKNOWN`

AI is optional for investigations — classification does not require an LLM.
