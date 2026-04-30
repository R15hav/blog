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

function StatCard({ label, value }) {
    return (
        <div className="stat-card">
            <div className="stat-card-value">{value ?? "—"}</div>
            <div className="stat-card-label">{label}</div>
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
        if (success) {
            setSettingsMsg("Settings saved.");
        } else {
            setSettingsError(detail?.detail ?? "Failed to save settings.");
        }
    }

    async function handleLogoUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingLogo(true);
        setSettingsError(null);
        const { success, detail } = await uploadLogo(file, token);
        setUploadingLogo(false);
        if (success) {
            setLogoUrl(`${API}${detail.url}`);
        } else {
            setSettingsError(detail?.detail ?? "Upload failed.");
        }
    }

    return (
        <div className="admin-dashboard">
            <h1>Admin Dashboard</h1>

            {/* ── Metrics ── */}
            <section className="admin-metrics">
                <h2>Overview</h2>
                {statsError && <p role="alert">{statsError}</p>}
                <div className="stat-cards">
                    <StatCard label="Total Articles" value={stats?.articles?.total} />
                    <StatCard label="Published" value={stats?.articles?.published} />
                    <StatCard label="Drafts" value={stats?.articles?.draft} />
                    <StatCard label="Total Users" value={stats?.users?.total} />
                    <StatCard label="Active Users" value={stats?.users?.active} />
                </div>
            </section>

            {/* ── Site Settings ── */}
            <section>
                <h2>Site Settings</h2>
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
                        {uploadingLogo && <p className="upload-hint">Uploading…</p>}
                    </div>

                    {logoUrl && (
                        <div>
                            <p className="upload-hint">Preview:</p>
                            <img
                                src={logoUrl}
                                alt="Logo preview"
                                className="logo-preview"
                            />
                        </div>
                    )}

                    <div>
                        <button type="submit" disabled={savingSettings}>
                            {savingSettings ? "Saving…" : "Save Settings"}
                        </button>
                    </div>

                    {settingsMsg && <p className="msg-success">{settingsMsg}</p>}
                    {settingsError && <p role="alert">{settingsError}</p>}
                </form>
            </section>
        </div>
    );
}
