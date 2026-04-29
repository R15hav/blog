import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata: Metadata = {
  title: "Blog",
  description: "An open-source configurable blog platform",
};

async function getActiveThemeUrl(): Promise<string | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/v1/theme/active`, {
      // Revalidate every 60 seconds so theme changes propagate quickly
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url ?? null;
  } catch {
    return null;
  }
}

export default async function BlogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const themeUrl = await getActiveThemeUrl();

  return (
    <html lang="en">
      <head>
        {themeUrl && (
          <link rel="stylesheet" href={themeUrl} />
        )}
      </head>
      <body>
        <AuthProvider>
          <header>
            <nav>
              <a href="/">Blog</a>
              <span> | </span>
              <a href="/search-article">Search</a>
              <span> | </span>
              <a href="/create-article">Write</a>
              <span> | </span>
              <a href="/login">Login</a>
              <span> | </span>
              <a href="/register">Register</a>
            </nav>
          </header>
          <main>{children}</main>
          <footer>
            <p>Powered by open-source blog platform</p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
