# AI investigation

## Principle

**Evidence first.** The model may only cite retrieved evidence IDs. Unknown IDs are stripped. Empty evidence yields an explicit insufficient-evidence answer.

## Pipeline

```text
Question → tokenize/search → rank changes/snapshots → persist Evidence
        → LLM JSON (if AI_API_KEY) OR heuristic fallback
        → structured claims with evidenceIds → UI
```

## Provider abstraction

`OpenAICompatibleProvider` works with OpenAI and OpenRouter-compatible `/chat/completions` endpoints. Configure:

```env
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_PROVIDER=openai
```

Without a key, TRACE still answers using deterministic heuristics over retrieved evidence (used by the portfolio demo).
