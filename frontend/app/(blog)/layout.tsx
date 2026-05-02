import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import {
  getActiveThemeUrl,
  getSiteName,
  getSiteDescription,
  getSiteUrl,
  getLogoUrl,
  getOgSettings,
  getAllowRegistration,
} from "../_lib/theme";
import NavLinks from "./components/NavLinks";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const [siteName, siteDescription, siteUrl, logoUrl, ogSettings] = await Promise.all([
    getSiteName(),
    getSiteDescription(),
    getSiteUrl(),
    getLogoUrl(),
    getOgSettings(),
  ]);

  const baseUrl = siteUrl || APP_URL;

  let metadataBase: URL;
  try {
    metadataBase = new URL(baseUrl);
  } catch {
    metadataBase = new URL(APP_URL);
  }

  // og:title always equals the site name; og:description uses the OG-specific override or falls back
  const ogTitle = siteName;
  const ogDescription = ogSettings.ogDescription || siteDescription || "An open-source configurable blog platform";
  const rawOgImage = ogSettings.ogImageUrl || logoUrl;
  const absoluteOgImage = rawOgImage
    ? rawOgImage.startsWith("http") ? rawOgImage : `${API}${rawOgImage}`
    : null;

  const metaDescription = siteDescription || "An open-source configurable blog platform";

  return {
    metadataBase,
    title: { default: siteName, template: `%s | ${siteName}` },
    description: metaDescription,
    openGraph: {
      siteName,
      type: "website",
      url: baseUrl,
      title: ogTitle,
      description: ogDescription,
      ...(absoluteOgImage ? { images: [{ url: absoluteOgImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      ...(absoluteOgImage ? { images: [absoluteOgImage] } : {}),
    },
  };
}

export default async function BlogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [themeUrl, siteName, allowRegistration] = await Promise.all([
    getActiveThemeUrl(),
    getSiteName(),
    getAllowRegistration(),
  ]);

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
          <NavLinks siteName={siteName} allowRegistration={allowRegistration} />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
