"use client";
import { useAuth } from "../../context/AuthContext";

export default function NavLinks() {
  const { user, logout } = useAuth();
  const canWrite = user?.role === "author" || user?.role === "admin";

  return (
    <nav>
      <a className="nav-home" href="/">Home</a>
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
