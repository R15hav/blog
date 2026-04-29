import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { getActiveThemeUrl } from "../_lib/theme";

export const metadata: Metadata = {
  title: "Blog",
  description: "An open-source configurable blog platform",
};

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
