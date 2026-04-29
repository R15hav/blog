import { AuthProvider } from "../context/AuthContext";
import AdminGuard from "./AdminGuard";
import { getActiveThemeUrl } from "../_lib/theme";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const themeUrl = await getActiveThemeUrl();

    return (
        <html lang="en">
            <head>
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
