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

export async function getSiteName(): Promise<string> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/v1/settings`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return "Blog";
    const data = await res.json();
    return data?.site_name ?? "Blog";
  } catch {
    return "Blog";
  }
}
