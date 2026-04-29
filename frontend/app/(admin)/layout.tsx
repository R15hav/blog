import { AuthProvider } from "../context/AuthContext";
import AdminGuard from "./AdminGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>
                    <AdminGuard>{children}</AdminGuard>
                </AuthProvider>
            </body>
        </html>
    );
}
