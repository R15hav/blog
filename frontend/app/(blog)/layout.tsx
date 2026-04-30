import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { getActiveThemeUrl, getSiteName } from "../_lib/theme";
import NavLinks from "./components/NavLinks";

export const metadata: Metadata = {
  title: "Blog",
  description: "An open-source configurable blog platform",
};

export default async function BlogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [themeUrl, siteName] = await Promise.all([getActiveThemeUrl(), getSiteName()]);

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
            <NavLinks siteName={siteName} />
          </header>
          <main className="blog-main">{children}</main>
          <footer>
            <p>Powered by open-source blog platform</p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
