"use client";
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

export default function NavLinks({ siteName = "Blog" }: { siteName?: string }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const canWrite = user?.is_superuser || ["author", "admin"].includes(user?.role ?? "");
  const initials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "";

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem("title") as HTMLInputElement)?.value.trim();
    if (input) router.push(`/search-article?title=${encodeURIComponent(input)}`);
  }

  return (
    <nav className="nav">
      <div className="nav-left">
        <a className="wordmark" href="/">
          {siteName}
          <span className="dot" />
        </a>
        <div style={{ display: "flex", gap: 22 }}>
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
          <a className="nav-link" href="/create-article">Write</a>
        )}
        {user?.is_superuser && (
          <a className="nav-link" href="/admin">Admin</a>
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
            <button className="nav-link" onClick={logout}>Log out</button>
          </>
        ) : (
          <>
            <a className="nav-link" href="/login">Sign in</a>
            <a className="btn btn-primary btn-sm" href="/register">Get started</a>
          </>
        )}
      </div>
    </nav>
  );
}
