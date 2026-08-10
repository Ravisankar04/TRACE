# Crawler

## Goals

Respectful, bounded, SSRF-safe crawling of same-domain pages for monitoring — not open-web scraping.

## Pipeline

```text
validate URL → robots.txt → queue BFS → Playwright page → HTML → normalize → return
```

## Controls

- Max depth / max pages / concurrency / timeout
- Same-domain restriction by default
- Retry with exponential backoff
- Duplicate URL set
- Tracking query param stripping during normalization of discovered links
- Localhost blocked except explicit `/demo-site` demo allowance

## SSRF protection

Blocks localhost, loopback, RFC1918, link-local (`169.254.0.0/16`), ULA IPv6, metadata hostnames, credentialed URLs, and common internal ports.

See `@trace/shared` `validatePublicHttpUrl`.
