const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Single-file sitemap. Sitemap protocol caps a single file at 50,000 URLs / 50 MB.
// We fetch up to MAX_ARTICLES from the lightweight backend endpoint in one page.
// If the catalog ever crosses ~5,000 articles, switch to generateSitemaps() + a
// custom /sitemap.xml route that emits a <sitemapindex> referencing chunks.
const MAX_ARTICLES = 5000;
const HOME_PAGE_SIZE = 20;

export const revalidate = 3600;

async function fetchSiteUrl() {
  try {
    const res = await fetch(`${API}/api/v1/settings`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const settings = await res.json();
      return settings.site_url || APP_URL;
    }
  } catch {}
  return APP_URL;
}

async function fetchMeta() {
  try {
    const res = await fetch(`${API}/api/v1/sitemap/meta`, { next: { revalidate: 3600 } });
    if (res.ok) return res.json();
  } catch {}
  return { total: 0, max_lastmod: null };
}

async function fetchAllArticles() {
  try {
    const params = new URLSearchParams({ page: "1", per_page: String(MAX_ARTICLES) });
    const res = await fetch(`${API}/api/v1/sitemap/articles?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return data?.items ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const [siteUrl, meta, items] = await Promise.all([
    fetchSiteUrl(),
    fetchMeta(),
    fetchAllArticles(),
  ]);

  const homeLastMod = meta?.max_lastmod ? new Date(meta.max_lastmod) : new Date();
  const indexCount = Math.max(0, Math.ceil((meta?.total ?? items.length) / HOME_PAGE_SIZE));

  const staticEntries = [
    {
      url: `${siteUrl}/`,
      lastModified: homeLastMod,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/search-article`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  const paginatedIndexEntries = [];
  for (let p = 2; p <= indexCount; p++) {
    paginatedIndexEntries.push({
      url: `${siteUrl}/?page=${p}`,
      lastModified: homeLastMod,
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  const articleEntries = items.map((a) => ({
    url: `${siteUrl}/article/${a.id}`,
    lastModified: a.lastmod ? new Date(a.lastmod) : new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...paginatedIndexEntries, ...articleEntries];
}
