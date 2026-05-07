# Security Policy

## Supported Versions

This project is in active development on the `master` branch. Only the latest commit on `master` receives security fixes.

| Version | Supported |
|---------|-----------|
| `master` | ✅ |
| Older tags / forks | ❌ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.** Public disclosure before a fix is shipped puts every deployed instance at risk.

Instead, email the maintainer directly:

📧 **gaming.boy.fhx@gmail.com**

Include:

- A clear description of the issue
- Steps to reproduce, or a proof-of-concept
- The version (commit SHA) you tested against
- Your assessment of impact (data exposure, auth bypass, RCE, etc.)
- Whether the issue is already known publicly

### What to expect

- **Acknowledgement within 72 hours.** If you don't hear back in that window, send a follow-up — your first email may have hit a spam filter.
- **Triage within 7 days.** We'll confirm whether the report is in-scope, ask clarifying questions, and give you a rough fix timeline.
- **Coordinated disclosure.** We'll let you know when the fix is merged and released. We're happy to credit you in release notes (or keep your report anonymous, your call).
- **No bug bounty.** This is a small open-source project; we don't have a budget for paid disclosures.

## Scope

### In scope

- Authentication or authorisation bypass (e.g. accessing admin routes without `is_superuser`)
- Privilege escalation (e.g. authoring articles while role is `guest`)
- Insecure direct object reference (IDOR) on article / comment / profile endpoints
- SQL injection, command injection, server-side request forgery
- Cross-site scripting (XSS) — particularly in Editor.js block rendering
- Container escape or local file disclosure via the upload endpoint
- Token forgery or JWT validation flaws
- Sensitive data exposure (passwords, tokens, secrets in logs or responses)
- Misconfigured CORS, missing security headers in nginx config
- Path traversal in `/uploads/`

### Out of scope

- Denial-of-service via raw request volume — this is a Render-tier capacity issue, not a code defect
- Social engineering, phishing, or attacks against contributors' accounts directly
- Rate-limiting concerns on the free tier (no rate limiting is currently shipped; PRs welcome)
- Vulnerabilities in third-party dependencies that don't affect this project's actual usage
- Issues that require physical access to the server or local filesystem
- Self-XSS (vulnerability that requires the victim to paste attacker-controlled content into their own console)
- Missing best-practice headers (HSTS, CSP) where the impact is theoretical only — please open a regular issue or PR instead

## Safe harbour

Good-faith security research conducted within the scope above will not be subject to legal action. We expect researchers to:

- Avoid privacy violations, data destruction, and service disruption
- Test only against your own deployed instance (or a self-hosted local copy) — not against any third party's production deployment
- Give us a reasonable window to fix the issue before public disclosure

Thanks for helping keep this project safe.
