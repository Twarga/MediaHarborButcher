# Security Policy

## Supported versions

Only the latest released version receives security fixes. Upgrade to the
newest tag when reporting, and file fixes against `main`.

| Version | Supported |
| ------- | --------- |
| 2.1.x   | ✅         |
| 2.0.x   | ❌         |
| < 2.0   | ❌         |

## Scope

MediaHarbor runs locally and binds to `127.0.0.1` by default. Relevant threat
surfaces:

- **Command execution** via the `/open-folder` endpoint
- **SSRF-ish behavior** — the app can be asked to fetch arbitrary URLs. This
  is by design; users should only harvest URLs they trust.
- **XSS** from content rendered in the preview grid (image URLs, poster URLs)
- **Path handling** in the downloader (where files are written)
- **Dependency vulnerabilities** (FastAPI, Playwright, yt-dlp, aiohttp, React)

Out of scope:

- Sites actively blocking MediaHarbor (use the issue tracker, not this page)
- Self-inflicted damage from running the app behind a public proxy

## Reporting a vulnerability

Please email **twarga@users.noreply.github.com** with:

- A clear description of the issue
- Reproduction steps (a minimal URL or code snippet)
- Impact (what can an attacker do?)
- Your environment (OS, Python, Node versions)

If the issue is sensitive, encrypt with GPG on request.

Expect an acknowledgement within 72 hours and a first assessment within 7
days. Please do not open a public issue before we've had a chance to fix it.

## Known trade-offs

- The app binds to localhost; if you forward it to a public interface,
  `/open-folder` can be invoked remotely. Don't do that.
- The browser session created by Playwright uses the user-provided URL as
  Referer — this is intentional for cookie forwarding to CDNs.

Thanks for helping keep MediaHarbor secure.
