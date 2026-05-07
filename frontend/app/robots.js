const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default async function robots() {
  let siteUrl = APP_URL;

  try {
    const res = await fetch(`${API}/api/v1/settings`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const settings = await res.json();
      siteUrl = settings.site_url || APP_URL;
    }
  } catch {}

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/uploads/",
        "/admin/",
        "/dashboard/",
        "/create-article",
        "/update-article/",
        "/login",
        "/register",
        "/forgot-password",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
