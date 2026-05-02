"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyToken } from "../../_lib/api_callout";

const API = process.env.NEXT_PUBLIC_API_URL || "";

export default function LoginForm({ allowRegistration = true }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const res = await fetch(`${API}/auth/jwt/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && (data.detail || JSON.stringify(data))) || `Login failed (${res.status})`);
        return;
      }
      const token = data?.access_token ?? data?.token;
      if (!token) {
        setError("No access token returned by server.");
        return;
      }
      const { valid, detail: userData } = await verifyToken(token);
      if (!valid) {
        setError("Token verification failed. Please try again.");
        return;
      }
      localStorage.setItem("access_token", token);
      router.push(userData?.is_superuser ? "/admin/users" : "/");
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      {/* Left — marketing panel */}
      <div className="auth-marketing">
        <a className="wordmark" href="/">
          Blog<span className="dot" />
        </a>
        <blockquote style={{ margin: 0 }}>
          <p className="auth-quote">
            &ldquo;The art of writing is the art of discovering what you believe.&rdquo;
          </p>
          <p className="auth-quote-cite">— Gustave Flaubert</p>
        </blockquote>
        <footer className="auth-footer">
          <a href="/">Home</a>
          {allowRegistration && <a href="/register">Create account</a>}
        </footer>
      </div>

      {/* Right — form panel */}
      <div className="auth-form">
        <h1>Welcome back</h1>
        <p className="lede">Sign in to continue writing.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="form-error" role="alert">{String(error)}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {allowRegistration && (
          <div className="auth-divider">
            No account? <a href="/register">Create one</a>
          </div>
        )}
      </div>
    </div>
  );
}
