# Security

## Threats addressed

| Threat | Mitigation |
| --- | --- |
| SSRF via crawl URL | Strict public URL validator + IP/hostname denylist |
| Auth abuse | bcrypt passwords, httpOnly cookies, rate limits |
| IDOR | All project/change queries scoped by `userId` |
| API key leakage | Store SHA-256 only; show raw once |
| Webhook spoofing | Shared secret + `X-Trace-Signature` |
| XSS from HTML | Snapshots stored server-side; UI renders text/diffs not raw HTML |
| SQLi | Prisma parameterized queries |
| Unlimited crawl | depth/page/concurrency caps |

## Cookies

Session cookie `trace_session` — httpOnly, SameSite=Lax, optional Secure.

## Audit log

Signup/login/project create recorded in `AuditLog`.

## OAuth

Route stub returns `501 OAUTH_UNAVAILABLE` — designed for later providers without rewriting auth storage (`Session` table is provider-agnostic).
