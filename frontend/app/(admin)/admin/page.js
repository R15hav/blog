"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getAdminStats,
  getAdminSettings,
  updateAdminSettings,
  uploadLogo,
} from "../../_lib/api_callout";

const API = process.env.NEXT_PUBLIC_API_URL || "";

function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? "—"}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !user.is_superuser) {
      router.replace("/admin/articles");
    }
  }, [user, router]);

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);

  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [settingsError, setSettingsError] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [ogMsg, setOgMsg] = useState(null);
  const [ogError, setOgError] = useState(null);
  const [savingOg, setSavingOg] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);

  const fileInputRef = useRef(null);
  const ogImageInputRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    getAdminStats(token).then(({ success, detail }) => {
      if (success) setStats(detail);
      else setStatsError("Failed to load stats.");
    });
    getAdminSettings(token).then(({ success, detail }) => {
      if (success) {
        setSiteName(detail.site_name ?? "");
        setSiteDescription(detail.site_description ?? "");
        setSiteUrl(detail.site_url ?? "");
        setLogoUrl(detail.logo_url ?? "");
        setAllowRegistration(detail.allow_registration ?? true);
        setOgTitle(detail.og_title ?? "");
        setOgDescription(detail.og_description ?? "");
        setOgImageUrl(detail.og_image_url ?? "");
      }
    });
  }, [token]);

  async function handleSettingsSave(e) {
    e.preventDefault();
    setSettingsMsg(null);
    setSettingsError(null);
    setSavingSettings(true);
    const { success, detail } = await updateAdminSettings(
      {
        site_name: siteName,
        site_description: siteDescription || null,
        site_url: siteUrl || null,
        logo_url: logoUrl || null,
        allow_registration: allowRegistration,
      },
      token
    );
    setSavingSettings(false);
    if (success) setSettingsMsg("Settings saved.");
    else setSettingsError(detail?.detail ?? "Failed to save settings.");
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setSettingsError(null);
    const { success, detail } = await uploadLogo(file, token);
    setUploadingLogo(false);
    if (success) setLogoUrl(`${API}${detail.url}`);
    else setSettingsError(detail?.detail ?? "Upload failed.");
  }

  async function handleOgSave(e) {
    e.preventDefault();
    setOgMsg(null);
    setOgError(null);
    setSavingOg(true);
    const { success, detail } = await updateAdminSettings(
      {
        og_description: ogDescription,
        og_image_url: ogImageUrl,
      },
      token
    );
    setSavingOg(false);
    if (success) setOgMsg("Open Graph settings saved.");
    else setOgError(detail?.detail ?? "Failed to save OG settings.");
  }

  async function handleOgImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingOgImage(true);
    setOgError(null);
    const { success, detail } = await uploadLogo(file, token);
    setUploadingOgImage(false);
    if (success) setOgImageUrl(`${API}${detail.url}`);
    else setOgError(detail?.detail ?? "Upload failed.");
  }

  function ogPreviewDomain() {
    try { return new URL(siteUrl).hostname; } catch { return siteUrl || "yourblog.com"; }
  }

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview and site settings</p>
        </div>
      </div>

      {statsError && <p className="msg-error" role="alert">{statsError}</p>}

      <div className="kpi-row">
        <Kpi label="Total Articles" value={stats?.articles?.total} />
        <Kpi label="Published" value={stats?.articles?.published} />
        <Kpi label="Drafts" value={stats?.articles?.draft} />
        <Kpi label="Users" value={stats?.users?.total} />
      </div>

      <h2 className="admin-section-title">Site Settings</h2>

      <form className="admin-settings-form" onSubmit={handleSettingsSave}>
        <div>
          <label>Site Name</label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="My Blog"
            required
          />
        </div>

        <div>
          <label>Site Description</label>
          <input
            type="text"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder="A short description shown in search results and social shares"
          />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-4)", marginTop: 5 }}>
            Used as the default meta description and OG description for the home page.
          </p>
        </div>

        <div>
          <label>Site URL</label>
          <input
            type="url"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://yourblog.com"
          />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-4)", marginTop: 5 }}>
            Your public site URL. Used to build canonical links, OG URLs, and the sitemap.
          </p>
        </div>

        <div>
          <label>Logo URL</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
        </div>

        <div>
          <label>Upload Logo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
          />
          {uploadingLogo && <span className="msg-success" style={{ fontSize: 12 }}>Uploading…</span>}
        </div>

        {logoUrl && (
          <div>
            <img src={logoUrl} alt="Logo preview" className="logo-preview" />
          </div>
        )}

        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allowRegistration}
              onChange={(e) => setAllowRegistration(e.target.checked)}
              style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: "pointer" }}
            />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-2)" }}>
              Allow self-registration
            </span>
          </label>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-4)", marginTop: 5 }}>
            When unchecked, the Register page and &ldquo;Get started&rdquo; links are hidden from visitors.
          </p>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={savingSettings}>
            {savingSettings ? "Saving…" : "Save Settings"}
          </button>
        </div>

        {settingsMsg && <p className="msg-success">{settingsMsg}</p>}
        {settingsError && <p className="msg-error" role="alert">{settingsError}</p>}
      </form>

      <h2 className="admin-section-title">Open Graph — Home Page</h2>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
        Controls what appears when someone shares your home URL on social media (Twitter, Facebook, LinkedIn, iMessage, etc.).
        Leave a field blank to fall back to the corresponding Site Setting.
      </p>

      <div className="og-section" style={{ display: "flex", gap: 100, alignItems: "start" }}>
        <form className="admin-settings-form" style={{ width: "26rem", flexShrink: 0 }} onSubmit={handleOgSave}>
          <div>
            <label>OG Title</label>
            <input
              type="text"
              value={siteName}
              readOnly
              style={{ opacity: 0.6, cursor: "default" }}
            />
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-4)", marginTop: 5 }}>
              Mirrors the Site Name. Change it in Site Settings above.
            </p>
          </div>

          <div>
            <label>OG Description</label>
            <textarea
              value={ogDescription}
              onChange={(e) => setOgDescription(e.target.value)}
              placeholder={siteDescription || "Defaults to Site Description"}
              rows={3}
              style={{
                width: "100%",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                padding: "8px 10px",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r)",
                background: "var(--paper-2)",
                color: "var(--ink)",
                resize: "vertical",
                boxSizing: "border-box",
                outline: 0,
              }}
            />
          </div>

          <div>
            <label>OG Image URL</label>
            <input
              type="url"
              value={ogImageUrl}
              onChange={(e) => setOgImageUrl(e.target.value)}
              placeholder={logoUrl || "https://yourblog.com/og-image.png — defaults to Logo"}
            />
          </div>

          <div>
            <label>Upload OG Image</label>
            <input
              ref={ogImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleOgImageUpload}
            />
            {uploadingOgImage && <span className="msg-success" style={{ fontSize: 12 }}>Uploading…</span>}
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-4)", marginTop: 5 }}>
              Recommended: 1200 × 630 px, under 1 MB. JPEG or PNG.
            </p>
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={savingOg}>
              {savingOg ? "Saving…" : "Save OG Settings"}
            </button>
          </div>

          {ogMsg && <p className="msg-success">{ogMsg}</p>}
          {ogError && <p className="msg-error" role="alert">{ogError}</p>}
        </form>

        {/* Live social card preview */}
        <div className="og-preview" style={{ minWidth: 300, maxWidth: 380 }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Preview
          </p>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface-1)", boxShadow: "0 2px 12px rgba(0,0,0,0.10)" }}>
            <div style={{
              height: 160,
              background: "var(--surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
            }}>
              {(ogImageUrl || logoUrl) ? (
                <img
                  src={ogImageUrl || logoUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-4)" }}>No image set</span>
              )}
            </div>
            <div style={{ padding: "10px 14px 14px" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-4)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {ogPreviewDomain()}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 4px", lineHeight: 1.3 }}>
                {siteName || "Your Blog Title"}
              </p>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", margin: 0,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4,
              }}>
                {ogDescription || siteDescription || "Your blog description will appear here."}
              </p>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-4)", marginTop: 8 }}>
            Updates live as you type.
          </p>
        </div>
      </div>
    </>
  );
}
