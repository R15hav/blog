"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { getAdminComments, getAuthorComments, deleteComment } from "../../../_lib/api_callout";

const PAGE_SIZE = 50;

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminCommentsPage() {
  const { token, user } = useAuth();

  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isSearchMode = debounced.trim().length > 0;

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const opts = { skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, search: debounced };
    const fetch = user?.is_superuser
      ? getAdminComments(token, opts)
      : getAuthorComments(token, { skip: opts.skip, limit: opts.limit });
    fetch.then(({ success, detail }) => {
      setLoading(false);
      if (success) { setComments(detail.comments); setTotal(detail.total); }
    });
  }, [token, user, page, debounced]);

  async function handleDelete(postId, commentId) {
    setDeletingId(commentId);
    await deleteComment(postId, commentId, token);
    setDeletingId(null);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setTotal((t) => t - 1);
  }

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Comments</h1>
          <p>{total} comment{total !== 1 ? "s" : ""} across all articles</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 360,
          background: "var(--paper-2)", border: "1px solid var(--rule)",
          borderRadius: "var(--r)", padding: "7px 12px",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--ink-4)" }}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by article or comment body…"
            style={{ background: "none", border: 0, outline: 0, width: "100%", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--ink-4)", padding: 0, lineHeight: 1, fontSize: 16 }} aria-label="Clear">×</button>
          )}
        </div>
        {isSearchMode && !loading && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)" }}>
            {comments.length} result{comments.length !== 1 ? "s" : ""} for &ldquo;{debounced}&rdquo;
          </span>
        )}
      </div>

      {loading ? (
        <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14, paddingTop: 4 }}>Loading…</p>
      ) : comments.length === 0 ? (
        <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-4)", fontSize: 14, paddingTop: 4 }}>No comments found.</p>
      ) : (
        <>
          <table className="dataset">
            <thead>
              <tr>
                <th>Commenter</th>
                <th>Article</th>
                <th>Comment</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{c.author_email}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a href={`/article/${c.post_id}`} style={{ color: "var(--accent-ink)", textDecoration: "none", fontSize: 13 }}>
                      {c.post_title || "—"}
                    </a>
                  </td>
                  <td style={{ maxWidth: 380 }}>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-2)" }}>
                      {c.body.length > 120 ? c.body.slice(0, 120) + "…" : c.body}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap", color: "var(--ink-4)" }}>{fmt(c.created_at)}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={deletingId === c.id ? {} : { color: "oklch(0.46 0.13 25)", borderColor: "oklch(0.80 0.06 25)" }}
                      onClick={() => handleDelete(c.post_id, c.id)}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isSearchMode && totalPages > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rule-soft)",
              fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)",
            }}>
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                <span style={{ color: "var(--ink-2)", fontWeight: 500, minWidth: 80, textAlign: "center" }}>Page {page} of {totalPages}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
