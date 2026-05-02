import type { Metadata } from "next";
import "./globals.css";
import { getActiveThemeUrl, getSiteName, getSiteDescription } from "../_lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const [siteName, siteDescription] = await Promise.all([getSiteName(), getSiteDescription()]);
  return {
    title: { default: siteName, template: `%s | ${siteName}` },
    description: siteDescription || "An open-source configurable blog platform",
  };
}

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      <body>{children}</body>
    </html>
  );
}
