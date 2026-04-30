"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { getArticles, deleteArticle } from "../../../_lib/api_callout";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isPublished(val) {
  return val === true || val === "true";
}

export default function AdminArticlesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    const { success, detail } = await getArticles();
    if (!success) setError("Failed to load articles.");
    else setArticles(detail?.articles ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(articleId) {
    if (!confirm("Delete this article?")) return;
    const { success, detail } = await deleteArticle(articleId, token);
    if (!success) { setError(detail?.detail ?? "Delete failed."); return; }
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
  }

  const total = articles.length;
  const published = articles.filter((a) => isPublished(a.published)).length;
  const drafts = total - published;

  if (loading) return (
    <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14, paddingTop: 24 }}>Loading articles…</p>
  );

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Articles</h1>
          <p>Browse and manage all content</p>
        </div>
        <a className="btn btn-primary" href="/create-article">New article</a>
      </div>

      {error && <p className="msg-error" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi"><div className="kpi-label">Total</div><div className="kpi-value">{total}</div></div>
        <div className="kpi"><div className="kpi-label">Published</div><div className="kpi-value">{published}</div></div>
        <div className="kpi"><div className="kpi-label">Drafts</div><div className="kpi-value">{drafts}</div></div>
      </div>

      <table className="dataset">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id}>
              <td style={{ fontFamily: "var(--font-serif)", fontSize: 15 }}>{a.title || "(Untitled)"}</td>
              <td>
                {isPublished(a.published) ? (
                  <span className="status ok"><span className="dot" />Published</span>
                ) : (
                  <span className="status"><span className="dot" />Draft</span>
                )}
              </td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{fmt(a.created_date)}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => router.push(`/update-article/${a.id}`)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDelete(a.id)}
                  style={{ color: "oklch(0.46 0.13 70)" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
