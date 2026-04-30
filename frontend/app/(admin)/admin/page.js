"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getAdminStats,
  getAdminSettings,
  updateAdminSettings,
  uploadLogo,
} from "../../_lib/api_callout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? "—"}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { token } = useAuth();

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);

  const [siteName, setSiteName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [settingsError, setSettingsError] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    getAdminStats(token).then(({ success, detail }) => {
      if (success) setStats(detail);
      else setStatsError("Failed to load stats.");
    });
    getAdminSettings(token).then(({ success, detail }) => {
      if (success) {
        setSiteName(detail.site_name ?? "");
        setLogoUrl(detail.logo_url ?? "");
      }
    });
  }, [token]);

  async function handleSettingsSave(e) {
    e.preventDefault();
    setSettingsMsg(null);
    setSettingsError(null);
    setSavingSettings(true);
    const { success, detail } = await updateAdminSettings(
      { site_name: siteName, logo_url: logoUrl || null },
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
          <button type="submit" className="btn btn-primary" disabled={savingSettings}>
            {savingSettings ? "Saving…" : "Save Settings"}
          </button>
        </div>

        {settingsMsg && <p className="msg-success">{settingsMsg}</p>}
        {settingsError && <p className="msg-error" role="alert">{settingsError}</p>}
      </form>
    </>
  );
}
