---
name: Backend API is internal-only
description: The FastAPI backend is consumed solely by the Next.js frontend — never exposed to the public internet or third-party clients
type: project
originSessionId: a6920713-d451-49bd-ac5b-6dd497baa972
---
The FastAPI backend at `backend/app/` is internal infrastructure for the Next.js frontend only. It is reached server-to-server during Next.js SSR/ISR, or via an internal nginx proxy in single-container deploys. It is NOT publicly addressable.

**Why:** Architectural decision by the user. The API exists to power the frontend, not for third-party integrations or public consumption.

**How to apply:**

- Don't propose features aimed at public API consumers: versioned compatibility shims for third-party clients, public OpenAPI portals, public rate limiting tied to API keys, third-party developer tooling, hypermedia controls for public discoverability.
- DO still suggest defense-in-depth (CORS allowlist, `robots.txt Disallow: /api/`, auth middleware) — multiple layers guard against a misconfigured proxy accidentally exposing the backend.
- For SEO and crawler concerns: only Next.js routes are visible to Googlebot. The backend is invisible. Don't suggest `<meta>`, `<link rel="canonical">`, or sitemap entries that assume direct backend exposure.
- For caching: backend `Cache-Control` headers benefit Next.js's internal fetch cache during SSR/ISR. They won't reach browsers or CDN edges directly. Don't conflate.
- For auth: storing JWTs in localStorage + sending via `Authorization` header is safe because browsers only ever talk to Next.js, never the backend directly. Don't push for httpOnly-cookie session migration on a "public API" rationale.
- For new endpoint design: optimize for the single known consumer (Next.js). Avoid premature generalization.
