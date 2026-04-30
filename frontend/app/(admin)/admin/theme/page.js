"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
  getThemes,
  createTheme,
  activateTheme,
  deleteTheme,
} from "../../../_lib/api_callout";

export default function ThemePage() {
  const { token } = useAuth();
  const [themes, setThemes] = useState([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { success, detail } = await getThemes(token);
    if (success) setThemes(detail?.themes ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!name.trim() || !url.trim()) { setError("Name and URL are required."); return; }
    const { success, detail } = await createTheme(name.trim(), url.trim(), token);
    if (!success) { setError(detail?.detail ?? "Failed to add theme."); return; }
    setThemes((prev) => [...prev, detail]);
    setName("");
    setUrl("");
    setMsg("Theme added.");
  }

  async function handleActivate(themeId) {
    setError(null);
    setMsg(null);
    const { success, detail } = await activateTheme(themeId, token);
    if (!success) { setError(detail?.detail ?? "Failed to activate theme."); return; }
    setThemes((prev) => prev.map((t) => ({ ...t, is_active: t.id === themeId })));
    setMsg("Theme activated. Visitors will see it within 60 seconds.");
  }

  async function handleDelete(themeId) {
    if (!confirm("Delete this theme?")) return;
    setError(null);
    const { success, detail } = await deleteTheme(themeId, token);
    if (!success) { setError(detail?.detail ?? "Failed to delete theme."); return; }
    setThemes((prev) => prev.filter((t) => t.id !== themeId));
  }

  if (loading) return (
    <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14, paddingTop: 24 }}>Loading themes…</p>
  );

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Theme</h1>
          <p>Inject an external CSS override for all visitors — no redeploy needed</p>
        </div>
      </div>

      {error && <p className="msg-error" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
      {msg && <p className="msg-success" style={{ marginBottom: 12 }}>{msg}</p>}

      {/* Add theme row */}
      <form className="add-theme" onSubmit={handleAdd}>
        <span className="lbl">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dark"
          required
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://cdn.example.com/theme.css"
          required
          style={{ gridColumn: "span 1" }}
        />
        <button type="submit" className="btn btn-primary btn-sm">Add</button>
      </form>

      <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-4)", marginBottom: 20 }}>
        GitHub raw URLs are blocked by browsers. Use jsDelivr:{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          https://cdn.jsdelivr.net/gh/USER/REPO@BRANCH/path/file.css
        </code>
      </p>

      {themes.length === 0 ? (
        <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14 }}>No themes saved yet.</p>
      ) : (
        <div>
          {themes.map((t) => (
            <div key={t.id} className={`theme-card${t.is_active ? " active" : ""}`}>
              <div>
                <h4>
                  {t.name}
                  {t.is_active && <span className="status accent" style={{ fontSize: 11 }}>Active</span>}
                </h4>
                <div className="theme-url">{t.url}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {!t.is_active && (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleActivate(t.id)}>
                    Activate
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDelete(t.id)}
                  style={{ color: "oklch(0.46 0.13 70)" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
