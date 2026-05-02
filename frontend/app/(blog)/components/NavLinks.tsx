"use client";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function NavLinks({ siteName = "Blog", allowRegistration = true }: { siteName?: string; allowRegistration?: boolean }) {
  const { user, logout } = useAuth()!;
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const canWrite = user?.is_superuser || ["author", "admin"].includes(user?.role ?? "");
  const initials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "";

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem("title") as HTMLInputElement)?.value.trim();
    if (input) {
      router.push(`/search-article?title=${encodeURIComponent(input)}`);
      setMenuOpen(false);
    }
  }

  return (
    <nav className="nav">
      <div className="nav-bar">
        <div className="nav-left">
          <a className="wordmark" href="/">
            {siteName}
            <span className="dot" />
          </a>
          <div className="nav-desktop-links">
            <a className={`nav-link${pathname === "/" ? " active" : ""}`} href="/">Home</a>
            <a className={`nav-link${pathname === "/search-article" ? " active" : ""}`} href="/search-article">Search</a>
          </div>
        </div>

        <div className="nav-right">
          <form className="nav-search" onSubmit={handleSearch}>
            <SearchIcon />
            <input name="title" placeholder="Search articles…" defaultValue="" />
            <kbd>⌘K</kbd>
          </form>

          {canWrite && (
            <>
              <a
                className={`nav-link${(pathname === "/admin" || pathname === "/dashboard") ? " active" : ""}`}
                href={user?.is_superuser ? "/admin" : "/dashboard"}
              >
                Dashboard
              </a>
              <a className="nav-link" href="/create-article">Write</a>
            </>
          )}

          {user ? (
            <>
              <div
                className="avatar sm"
                title={user.email}
                style={{ cursor: "default" }}
              >
                {initials}
              </div>
              <a className={`nav-link${pathname === "/profile" ? " active" : ""}`} href="/profile">Profile</a>
              <button className="nav-link" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <a className="nav-link" href="/login">Sign in</a>
              {allowRegistration && (
                <a className="btn btn-primary btn-sm" href="/register">Get started</a>
              )}
            </>
          )}
        </div>

        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <XIcon /> : <MenuIcon />}
        </button>
      </div>

      {menuOpen && (
        <div className="nav-mobile-menu">
          <form className="nav-mobile-search" onSubmit={handleSearch}>
            <SearchIcon />
            <input name="title" placeholder="Search articles…" autoFocus />
            <button type="submit" className="btn btn-primary btn-sm">Go</button>
          </form>
          <div className="nav-mobile-links">
            <a className="nav-mobile-link" href="/" onClick={() => setMenuOpen(false)}>Home</a>
            <a className="nav-mobile-link" href="/search-article" onClick={() => setMenuOpen(false)}>Search</a>
            {canWrite && (
              <>
                <a
                  className="nav-mobile-link"
                  href={user?.is_superuser ? "/admin" : "/dashboard"}
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </a>
                <a className="nav-mobile-link" href="/create-article" onClick={() => setMenuOpen(false)}>Write</a>
              </>
            )}
            {user ? (
              <>
                <a className="nav-mobile-link" href="/profile" onClick={() => setMenuOpen(false)}>Profile</a>
                <button className="nav-mobile-link" onClick={() => { logout(); setMenuOpen(false); }}>Log out</button>
              </>
            ) : (
              <>
                <a className="nav-mobile-link" href="/login" onClick={() => setMenuOpen(false)}>Sign in</a>
                {allowRegistration && (
                  <a
                    className="nav-mobile-link"
                    href="/register"
                    onClick={() => setMenuOpen(false)}
                    style={{ color: "var(--accent-ink)", fontWeight: 600 }}
                  >
                    Get started →
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
