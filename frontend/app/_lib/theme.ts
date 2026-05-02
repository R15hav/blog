export async function getActiveThemeUrl(): Promise<string | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/v1/theme/active`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchPublicSettings() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/v1/settings`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getSiteName(): Promise<string> {
  const data = await fetchPublicSettings();
  return data?.site_name ?? "Blog";
}

export async function getSiteDescription(): Promise<string> {
  const data = await fetchPublicSettings();
  return data?.site_description ?? "";
}

export async function getSiteUrl(): Promise<string> {
  const data = await fetchPublicSettings();
  return data?.site_url ?? "";
}

export async function getLogoUrl(): Promise<string | null> {
  const data = await fetchPublicSettings();
  return data?.logo_url ?? null;
}

export async function getOgSettings(): Promise<{
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
}> {
  const data = await fetchPublicSettings();
  return {
    ogTitle: data?.og_title ?? null,
    ogDescription: data?.og_description ?? null,
    ogImageUrl: data?.og_image_url ?? null,
  };
}

export async function getAllowRegistration(): Promise<boolean> {
  const data = await fetchPublicSettings();
  return data?.allow_registration ?? true;
}
