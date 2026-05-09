"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { verifyToken } from "../../_lib/api_callout";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

export default function LoginForm({ allowRegistration = true, siteName = "Blog" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const captchaRef = useRef(null);

  function resetCaptcha() {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (SITE_KEY && !captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);
      if (SITE_KEY) body.append("hcaptcha_token", captchaToken);

      const res = await fetch(`${API}/auth/jwt/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && (data.detail || JSON.stringify(data))) || `Login failed (${res.status})`);
        if (SITE_KEY) resetCaptcha();
        return;
      }
      const token = data?.access_token ?? data?.token;
      if (!token) {
        setError("No access token returned by server.");
        if (SITE_KEY) resetCaptcha();
        return;
      }
      const { valid, detail: userData } = await verifyToken(token);
      if (!valid) {
        setError("Token verification failed. Please try again.");
        if (SITE_KEY) resetCaptcha();
        return;
      }
      localStorage.setItem("access_token", token);
      router.push(userData?.is_superuser ? "/admin/users" : "/");
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
        <div className="auth-mobile-brand">
          <a className="wordmark" href="/">{siteName}<span className="dot" /></a>
        </div>
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
