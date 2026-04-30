"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RegisterForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, first_name: firstName || null, last_name: lastName || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data && (data.detail || JSON.stringify(data))) ||
          `Registration failed (${res.status})`
        );
        return;
      }
      setDone(true);
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
            &ldquo;A writer only begins a book. A reader finishes it.&rdquo;
          </p>
          <p className="auth-quote-cite">— Samuel Johnson</p>
        </blockquote>
        <footer className="auth-footer">
          <a href="/">Home</a>
          <a href="/login">Sign in</a>
        </footer>
      </div>

      {/* Right — form panel */}
      <div className="auth-form">
        {done ? (
          <>
            <h1>You&rsquo;re on the list</h1>
            <p className="lede">Account created successfully.</p>
            <div className="notice">
              <span className="notice-label">Pending approval</span>
              Your account is awaiting admin activation. You&rsquo;ll be able to sign in once approved.
            </div>
            <a className="btn btn-ghost" href="/login" style={{ alignSelf: "flex-start" }}>
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <h1>Create account</h1>
            <p className="lede">Join and start writing.</p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="field">
                  <label htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ada"
                    autoComplete="given-name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Lovelace"
                    autoComplete="family-name"
                  />
                </div>
              </div>

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
                  autoComplete="new-password"
                />
              </div>

              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="form-error" role="alert">{String(error)}</p>}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>

            <div className="auth-divider">
              Already have an account? <a href="/login">Sign in</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
