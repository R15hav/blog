# SEO — Google Search Console Setup & Operations

This guide covers verifying the site in Google Search Console (GSC), submitting the sitemap, and monitoring indexing for the blog platform.

It assumes the SEO crawl-wall fix is deployed — that is:
- Home `/` is server-rendered with all article links in initial HTML.
- Pagination uses `?page=N` search params with self-canonical URLs.
- `/sitemap.xml` is a single-file sitemap served by Next.js (capacity ~5,000 articles before chunking is needed).
- `/robots.txt` references the sitemap and disallows admin/auth routes.

---

## 1. Pre-flight checklist (before touching GSC)

Run these against the **production** URL (replace `https://your-blog.example.com`):

```bash
# Sitemap reachable, valid XML, contains article URLs
curl -sI https://your-blog.example.com/sitemap.xml | grep -E '^(HTTP|content-type)'
curl -s  https://your-blog.example.com/sitemap.xml | grep -c '<loc>'

# robots.txt references the sitemap
curl -s  https://your-blog.example.com/robots.txt | grep -i sitemap

# Home page exposes article anchors in initial HTML (no JS needed)
curl -s  https://your-blog.example.com/ | grep -oE 'href="/article/[a-f0-9-]+"' | sort -u | wc -l

# Article detail page is SSR'd with canonical
curl -s  https://your-blog.example.com/article/<some-uuid> | grep -oE 'rel="canonical"[^>]*'
```

Expected:
- Sitemap: `HTTP/2 200`, `content-type: application/xml`, `<loc>` count = (static URLs + paginated index URLs + published article count).
- robots.txt: contains `Sitemap: https://your-blog.example.com/sitemap.xml`.
- Home: article-anchor count equals the published-article count (or capped at 5,000 — see [Section 7](#7-when-to-revisit-the-architecture)).
- Article detail: canonical points to itself.

If any of these fail in production, fix that first — GSC will reject the sitemap or report soft-404s.

Also confirm `NEXT_PUBLIC_APP_URL` and the admin `site_url` config both equal the canonical production URL (https, no trailing slash, no www inconsistency). The sitemap and robots.txt fetch `/api/v1/settings.site_url` first and fall back to `NEXT_PUBLIC_APP_URL` — divergence leads to mixed canonicals.

---

## 2. Verify domain ownership

GSC offers two property types:

| Property type | Scope | Verification methods |
|---|---|---|
| **Domain** (recommended) | All subdomains + http/https | DNS TXT record only |
| **URL prefix** | One exact origin (e.g. `https://blog.example.com/`) | DNS, HTML file, HTML tag, Google Analytics, Google Tag Manager |

**Recommendation: use a Domain property** (e.g. `example.com`). It captures `www`, `blog`, `https`, and any future subdomain in one place, and avoids the duplicate-property cleanup later.

### DNS verification (Domain property)

1. In GSC, go to **Settings → Ownership verification → DNS record**.
2. Copy the TXT value Google provides (looks like `google-site-verification=AbCdEf...`).
3. Add a TXT record at the apex of your domain at your DNS provider:
   ```
   Name:  @  (or leave blank — apex)
   Type:  TXT
   Value: google-site-verification=AbCdEf...
   TTL:   3600 (or default)
   ```
4. Click **Verify** in GSC. DNS propagation usually takes 1–60 minutes; if it fails, wait and retry.

### HTML file verification (URL prefix property — fallback)

If you can't touch DNS:

1. GSC gives you a file like `googleabc123.html`.
2. Place it at `frontend/public/googleabc123.html` so Next.js serves it at `https://your-blog.example.com/googleabc123.html`.
3. Click **Verify** in GSC.
4. **Don't delete the file** — GSC re-checks it periodically and will revoke verification if it disappears.

---

## 3. Submit the sitemap

1. In GSC, open **Indexing → Sitemaps**.
2. In the "Add a new sitemap" field, enter just `sitemap.xml` (GSC prepends the property URL).
3. Submit.
4. Within minutes you should see status `Success` and a discovered-URL count. If status is `Couldn't fetch`, recheck `curl -i https://your-blog.example.com/sitemap.xml` from outside your network — most failures are origin-firewall or `Cache-Control` issues.

**What to expect afterward:**
- Initial discovery: minutes to hours.
- Initial indexing of all pages: typically 1–14 days for a new site, faster (24–72h per URL) for established domains.
- The sitemap auto-revalidates every hour (`export const revalidate = 3600` in `app/sitemap.js`). New articles appear in `/sitemap.xml` within an hour of publish without redeploying.

---

## 4. Request indexing of priority pages

For high-value pages (home + a few flagship articles), don't wait for organic discovery:

1. **URL Inspection tool** (top search bar in GSC) → paste the full URL.
2. Wait for the live test to complete.
3. Click **Request indexing**.

There's a daily quota (10–20 URLs/day depending on the property's track record). Use it on:
- Home `/`
- Highest-value evergreen articles
- Newly published articles you want indexed quickly

Don't request indexing on every article — for routine content, the sitemap does the job.

---

## 5. Monitor coverage

**Indexing → Pages** is the single most important screen. It splits URLs into:

| Bucket | Meaning | Expected |
|---|---|---|
| **Indexed** | Live in Google's index | All published articles within 1–4 weeks |
| **Not indexed** | Discovered but excluded — click for the reason | Should match excluded patterns: 404s, `noindex`, redirects, canonicals away |

Watch for these specific exclusion reasons (each is actionable):

- **Crawled — currently not indexed.** Google fetched the page but chose not to index. Common causes: thin content, duplicate-feeling content, low link equity. For long-tail articles this can be normal. If your hero articles land here, content quality / internal linking is the lever.
- **Discovered — currently not indexed.** Google found the URL in the sitemap but hasn't fetched it. Indicates crawl budget pressure — let it work over time, don't spam re-submits.
- **Page with redirect.** Expected only for `?page=1 → /`. If anything else shows up here, something is misconfigured.
- **Excluded by 'noindex' tag.** Should appear ONLY for invalid/out-of-range pagination (`?page=abc`, `?page=99999`) which return Next.js 404 with `noindex`. Real article URLs landing here is a bug.
- **Soft 404.** Page returns 200 but has no real content. Check the article detail page renders meaningful HTML for the UUID being inspected.
- **Duplicate without user-selected canonical.** Two URLs serve identical content and you didn't pick a winner. Verify the article detail page sets `<link rel="canonical">` to the single article URL (it does in this codebase).

### Performance reports — once you have data

After 2–4 weeks of indexing:

- **Performance → Search results** shows queries, clicks, impressions, CTR, position. Use this to identify articles ranking on page 2 (positions 11–20) — those are easiest to push to page 1 with content tweaks or internal links.
- **Sitemaps** screen shows discovered vs. indexed counts per submission. A large gap is a signal worth investigating.
- **Removals** is the panic button for accidentally exposing a draft.

---

## 6. Common issues and what to do

### "Sitemap could not be read"
- 99% of the time: GSC fetched while the backend was down or the proxy returned HTML 200 instead of XML. Confirm `curl -i https://your-blog.example.com/sitemap.xml` returns `Content-Type: application/xml`.
- The next.js sitemap revalidates hourly; force-refresh by hitting the URL in an incognito tab (warms the cache for the next GSC fetch).

### Sitemap submitted but article count drops
- Check `/api/v1/sitemap/meta` — if `total` dropped, articles got unpublished or deleted server-side. Compare with `published` flags in the admin.
- If `total` is stable but the sitemap returns fewer URLs, the Next.js fetch from sitemap.js is failing. Check Next.js server logs for fetch errors during `revalidate`.

### Articles indexed under wrong URL
- Verify the article detail page's `<link rel="canonical">` matches the article's slug/UUID format used in the sitemap. Mismatch causes Google to pick the canonical itself, sometimes wrongly.
- If `NEXT_PUBLIC_APP_URL` and the admin `site_url` disagree, the home page may emit `https://app.example.com` while the sitemap emits `https://www.example.com`. Pick one and align both.

### `?page=2` shows up as duplicate of `/`
- Should not happen — `?page=N` self-canonicals. If it does, recheck `generateMetadata` in `app/(blog)/page.js` is still emitting `alternates.canonical: ${baseUrl}/?page=${page}` for inner pages. Don't let a future refactor canonicalize them back to `/`; that re-creates the crawl wall.

### Old infinite-scroll URLs in the index
- Pre-fix Google may have indexed `/` only. After the fix, the sitemap submission triggers re-discovery. Just wait — there's nothing to "redirect" because the URL didn't change, only its rendered content did.

### `/robots.txt` blocks something Google already indexed
- `Disallow` doesn't remove URLs from the index, it just stops future crawls. To remove an indexed URL, use **Removals → New request** in GSC and also serve a `noindex` meta on the URL itself.

---

## 7. When to revisit the architecture

The current sitemap is single-file by design. Re-architect when:

| Trigger | Action |
|---|---|
| Published-article count crosses ~4,000 | Plan the migration to chunked sitemaps. |
| Crosses 5,000 | Migrate. Switch `app/sitemap.js` to use `generateSitemaps()` + add a custom `app/sitemap-index.xml/route.js` (or similar non-conflicting path) that emits a `<sitemapindex>`. Update `robots.txt` to point to the index. |
| Crosses 50,000 | Mandatory — single sitemap is no longer protocol-compliant. |
| Backend `/api/v1/sitemap/meta` p95 > 100ms | Add the partial index: `CREATE INDEX idx_posts_published_true_created ON posts(created_date DESC) WHERE published = 'true';` |
| Two posts share an exact `created_date` and visibly swap pages | Add `Post.id.desc()` as a tiebreaker in `services/articles.py` `list_articles` and `list_sitemap_entries`. |

---

## 8. Reference URLs

| Endpoint | Purpose |
|---|---|
| `https://your-blog.example.com/sitemap.xml` | Submit this to GSC |
| `https://your-blog.example.com/robots.txt` | Crawler rules — auto-fetched by Google |
| `https://your-blog.example.com/api/v1/sitemap/meta` | Internal — diagnostics only, not exposed publicly |
| `https://your-blog.example.com/api/v1/sitemap/articles?page=1&per_page=5000` | Internal — diagnostics only |
| `https://search.google.com/search-console` | GSC dashboard |
| `https://search.google.com/test/rich-results` | Test article structured data (the article detail page emits JSON-LD) |
| `https://pagespeed.web.dev/` | Run after launch — Core Web Vitals affect ranking |

---

## 9. One-time launch checklist

- [ ] Production deploy includes the SEO crawl-wall fix (sitemap.js, page.js, robots.js, backend sitemap endpoints).
- [ ] `NEXT_PUBLIC_APP_URL` and admin `site_url` match the canonical production URL exactly.
- [ ] `curl https://your-blog.example.com/sitemap.xml` returns valid XML with article URLs.
- [ ] `curl https://your-blog.example.com/` shows article anchors in initial HTML.
- [ ] Domain verified in GSC (DNS TXT preferred).
- [ ] Sitemap submitted in GSC and shows `Success`.
- [ ] URL inspection on home + 2–3 flagship articles → request indexing.
- [ ] Calendar reminder set for 2 weeks out: review **Pages** report and address any unexpected exclusions.
