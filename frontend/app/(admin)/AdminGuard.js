"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { href: "/admin",          label: "Dashboard" },
  { href: "/admin/users",    label: "Users" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/theme",    label: "Theme" },
];

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !user.is_superuser)) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <span style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14 }}>Loading…</span>
    </div>
  );
  if (!user || !user.is_superuser) return null;

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-side-brand">
          <a className="wordmark" href="/">Blog<span className="dot" /></a>
          <div className="admin-side-version">Admin</div>
        </div>

        <h6>Navigation</h6>
        <nav className="admin-nav">
          {NAV.map(({ href, label }) => (
            <a key={href} href={href} className={pathname === href ? "active" : ""}>
              {label}
            </a>
          ))}
        </nav>

        <div style={{ flexGrow: 1 }} />

        <h6>Site</h6>
        <nav className="admin-nav">
          <a href="/">View Site</a>
        </nav>
      </aside>

      <div className="admin-main">{children}</div>
    </div>
  );
}
