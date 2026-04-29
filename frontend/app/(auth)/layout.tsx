import type { Metadata } from "next";
import { getActiveThemeUrl } from "../_lib/theme";

export const metadata: Metadata = {
  title: "Blog",
  description: "An open-source configurable blog platform",
};

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeUrl = await getActiveThemeUrl();

  return (
    <html lang="en">
      <head>
        {themeUrl && <link rel="stylesheet" href={themeUrl} />}
      </head>
      <body>
        <header>
          <nav>
            <a className="nav-home" href="/">Home</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
