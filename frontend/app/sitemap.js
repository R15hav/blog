const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default async function sitemap() {
  let siteUrl = APP_URL;
  let articles = [];

  try {
    const res = await fetch(`${API}/api/v1/settings`);
    if (res.ok) {
      const settings = await res.json();
      siteUrl = settings.site_url || APP_URL;
    }
  } catch {}

  try {
    const res = await fetch(`${API}/api/v1/get-articles?skip=0&limit=1000`);
    if (res.ok) {
      const data = await res.json();
      articles = data?.articles ?? [];
    }
  } catch {}

  const staticRoutes = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/search-article`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
  ];

  const articleRoutes = articles
    .filter((a) => a.published === "true" || a.published === true)
    .map((a) => ({
      url: `${siteUrl}/article/${a.id}`,
      lastModified: a.created_date ? new Date(a.created_date) : new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    }));

  return [...staticRoutes, ...articleRoutes];
}
