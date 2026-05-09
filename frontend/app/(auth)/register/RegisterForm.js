"use client";

import { useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

export default function RegisterForm({ siteName = "Blog" }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const captchaRef = useRef(null);

  function resetCaptcha() {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (SITE_KEY && !captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Only include hcaptcha_token when captcha is enabled, so backend's
      // captcha-disabled mode keeps the same wire shape as before.
      const body = { email, password, first_name: firstName || null, last_name: lastName || null };
      if (SITE_KEY) body.hcaptcha_token = captchaToken;
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data && (data.detail || JSON.stringify(data))) ||
          `Registration failed (${res.status})`
        );
        if (SITE_KEY) resetCaptcha();
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err?.message ?? String(err));
      if (SITE_KEY) resetCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      {/* Left — marketing panel */}
      <div className="auth-marketing">
        <a className="wordmark" href="/">
          {siteName}<span className="dot" />
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
        <div className="auth-mobile-brand">
          <a className="wordmark" href="/">{siteName}<span className="dot" /></a>
        </div>
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
              <div className="register-name-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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

              {SITE_KEY && (
                <div className="field">
                  <span id="hcaptcha-label">Verify you&rsquo;re human</span>
                  <div aria-labelledby="hcaptcha-label">
                    <HCaptcha
                      ref={captchaRef}
                      sitekey={SITE_KEY}
                      onVerify={setCaptchaToken}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                    />
                  </div>
                </div>
              )}

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
