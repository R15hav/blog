import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import AdminGuard from "./AdminGuard";
import { getActiveThemeUrl, getSiteName } from "../_lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  return {
    title: { default: `Admin — ${siteName}`, template: `%s | ${siteName} Admin` },
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const themeUrl = await getActiveThemeUrl();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {themeUrl && <link rel="stylesheet" href={themeUrl} />}
      </head>
      <body>
        <AuthProvider>
          <AdminGuard>{children}</AdminGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
