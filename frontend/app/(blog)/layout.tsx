import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { getActiveThemeUrl, getSiteName, getAllowRegistration } from "../_lib/theme";
import NavLinks from "./components/NavLinks";

export const metadata: Metadata = {
  title: "Blog",
  description: "An open-source configurable blog platform",
};

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
