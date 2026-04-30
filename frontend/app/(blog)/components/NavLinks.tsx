"use client";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../../components/BackButton";

export default function NavLinks({ siteName = "Blog" }: { siteName?: string }) {
  const { user, logout } = useAuth();
  const canWrite = user?.role === "author" || user?.role === "admin";
  const initial = siteName.trim()[0]?.toUpperCase() ?? "B";

  return (
    <nav>
      <BackButton />
      <span> | </span>
      <a className="nav-home" href="/" data-initial={initial}>{siteName}</a>
      <form className="nav-search" action="/search-article" method="get">
        <input type="text" name="title" placeholder="Search…" />
        <button type="submit" aria-label="Search">&#128269;</button>
      </form>
      {canWrite && (
        <>
          <span> | </span>
          <a href="/create-article">Write</a>
        </>
      )}
      {user?.is_superuser && (
        <>
          <span> | </span>
          <a href="/admin">Dashboard</a>
        </>
      )}
      {user ? (
        <>
          <span> | </span>
          <button className="btn-logout" onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <span> | </span>
          <a href="/login">Login</a>
          <span> | </span>
          <a href="/register">Register</a>
        </>
      )}
    </nav>
  );
}
