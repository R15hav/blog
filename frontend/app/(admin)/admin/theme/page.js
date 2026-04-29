"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import BackButton from "../../../components/BackButton";
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
        if (!name.trim() || !url.trim()) {
            setError("Name and URL are required.");
            return;
        }
        const { success, detail } = await createTheme(name.trim(), url.trim(), token);
        if (!success) {
            setError(detail?.detail ?? "Failed to add theme.");
            return;
        }
        setThemes((prev) => [...prev, detail]);
        setName("");
        setUrl("");
        setMsg("Theme added.");
    }

    async function handleActivate(themeId) {
        setError(null);
        setMsg(null);
        const { success, detail } = await activateTheme(themeId, token);
        if (!success) {
            setError(detail?.detail ?? "Failed to activate theme.");
            return;
        }
        setThemes((prev) =>
            prev.map((t) => ({ ...t, is_active: t.id === themeId }))
        );
        setMsg("Theme activated. Visitors will see it within 60 seconds.");
    }

    async function handleDelete(themeId) {
        if (!confirm("Delete this theme?")) return;
        setError(null);
        const { success, detail } = await deleteTheme(themeId, token);
        if (!success) {
            setError(detail?.detail ?? "Failed to delete theme.");
            return;
        }
        setThemes((prev) => prev.filter((t) => t.id !== themeId));
    }

    if (loading) return <p>Loading themes…</p>;

    return (
        <div>
            <BackButton />
            <h1>Theme Management</h1>
            <p>
                Paste any external CSS URL. The active theme is injected as a{" "}
                <code>&lt;link&gt;</code> tag for all visitors — no redeploy needed.
            </p>
            <p style={{ fontSize: "0.85em", color: "#666" }}>
                ⚠️ GitHub raw URLs (<code>raw.githubusercontent.com</code>) are blocked by browsers due to MIME type.
                Use <strong>jsDelivr</strong> instead:{" "}
                <code>https://cdn.jsdelivr.net/gh/USER/REPO@BRANCH/path/file.css</code>
            </p>

            <form onSubmit={handleAdd}>
                <h2>Add theme</h2>
                <div>
                    <label>
                        Name:
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Classless"
                            required
                        />
                    </label>
                </div>
                <div>
                    <label>
                        CSS URL:
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://cdn.example.com/theme.css"
                            style={{ width: "400px" }}
                            required
                        />
                    </label>
                </div>
                <button type="submit">Add</button>
            </form>

            {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
            {msg && <p style={{ color: "green" }}>{msg}</p>}

            <h2>Saved themes</h2>
            {themes.length === 0 && <p>No themes yet.</p>}
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>URL</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {themes.map((t) => (
                        <tr key={t.id}>
                            <td>{t.name}</td>
                            <td>
                                <a href={t.url} target="_blank" rel="noreferrer">
                                    {t.url.length > 50 ? t.url.slice(0, 50) + "…" : t.url}
                                </a>
                            </td>
                            <td>{t.is_active ? "✓ Active" : "—"}</td>
                            <td>
                                {!t.is_active && (
                                    <button onClick={() => handleActivate(t.id)}>Set Active</button>
                                )}
                                {" "}
                                <button onClick={() => handleDelete(t.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
