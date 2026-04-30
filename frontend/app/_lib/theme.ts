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

export async function getAllowRegistration(): Promise<boolean> {
  const data = await fetchPublicSettings();
  return data?.allow_registration ?? true;
}
