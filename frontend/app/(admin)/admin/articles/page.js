"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { getArticles, searchArticles, deleteArticle, getAdminStats } from "../../../_lib/api_callout";

const PAGE_SIZE = 20;

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isPublished(val) {
  return val === true || val === "true";
}

function SortIcon({ active, dir }) {
  const up = active && dir === "asc";
  const down = active && dir === "desc";
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 1, marginLeft: 5, verticalAlign: "middle", lineHeight: 1 }}>
      <svg width="8" height="5" viewBox="0 0 8 5" style={{ opacity: up ? 1 : 0.25 }}>
        <path d="M4 0L8 5H0z" fill="currentColor" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" style={{ opacity: down ? 1 : 0.25 }}>
        <path d="M4 5L0 0H8z" fill="currentColor" />
      </svg>
    </span>
  );
}

export default function AdminArticlesPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  const [pendingDelete, setPendingDelete] = useState(null); // article object awaiting confirmation
  const [deleting, setDeleting] = useState(false);

  const isSearchMode = debouncedQuery.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce query → debouncedQuery
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Paginated fetch (normal mode)
  async function loadArticles(p) {
    setError(null);
    setLoading(true);
    const { success, detail } = await getArticles({ skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE });
    if (!success) setError("Failed to load articles.");
    else {
      setArticles(detail?.articles ?? []);
      setTotal(detail?.total ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isSearchMode) return;
    loadArticles(page);
  }, [page, isSearchMode]);

  // Search fetch
  useEffect(() => {
    if (!isSearchMode) return;
    setSearching(true);
    setError(null);
    searchArticles(debouncedQuery.trim()).then(({ success, detail }) => {
      if (!success) setError("Search failed.");
      else setArticles(detail?.articles ?? []);
      setSearching(false);
    });
  }, [debouncedQuery]);

  // Reset page when entering/leaving search mode
  useEffect(() => {
    setPage(1);
    setSortKey(null);
  }, [isSearchMode]);

  // Stats for KPI cards
  useEffect(() => {
    if (!token) return;
    getAdminStats(token).then(({ success, detail }) => {
      if (success) setStats(detail);
    });
  }, [token]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedArticles = useMemo(() => {
    if (!sortKey) return articles;
    return [...articles].sort((a, b) => {
      let av, bv;
      if (sortKey === "status") {
        av = isPublished(a.published) ? 1 : 0;
        bv = isPublished(b.published) ? 1 : 0;
      } else {
        av = a.created_date ? new Date(a.created_date).getTime() : 0;
        bv = b.created_date ? new Date(b.created_date).getTime() : 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [articles, sortKey, sortDir]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const { success, detail } = await deleteArticle(pendingDelete.id, token);
    setDeleting(false);
    setPendingDelete(null);
    if (!success) { setError(detail?.detail ?? "Delete failed."); return; }
    setArticles((prev) => prev.filter((a) => a.id !== pendingDelete.id));
    if (!isSearchMode) setTotal((n) => n - 1);
    if (stats) setStats((s) => ({
      ...s,
      articles: { ...s.articles, total: s.articles.total - 1 },
    }));
  }

  const kpiTotal = stats?.articles?.total ?? total;
  const kpiPublished = stats?.articles?.published ?? "—";
  const kpiDrafts = stats?.articles?.draft ?? "—";
  const isLoading = loading || searching;

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
        <div className="kpi"><div className="kpi-label">Total</div><div className="kpi-value">{kpiTotal}</div></div>
        <div className="kpi"><div className="kpi-label">Published</div><div className="kpi-value">{kpiPublished}</div></div>
        <div className="kpi"><div className="kpi-label">Drafts</div><div className="kpi-value">{kpiDrafts}</div></div>
      </div>

      {/* Search bar */}
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
            placeholder="Search by title…"
            style={{
              background: "none", border: 0, outline: 0, width: "100%",
              fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ background: "none", border: 0, cursor: "pointer", color: "var(--ink-4)", padding: 0, lineHeight: 1, fontSize: 16 }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {isSearchMode && !searching && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)" }}>
            {articles.length} result{articles.length !== 1 ? "s" : ""} for &ldquo;{debouncedQuery}&rdquo;
          </span>
        )}
      </div>

      {isLoading ? (
        <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14, paddingTop: 4 }}>
          {searching ? `Searching…` : `Loading…`}
        </p>
      ) : (
        <>
          <table className="dataset">
            <thead>
              <tr>
                <th>Title</th>
                <th
                  style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon active={sortKey === "status"} dir={sortDir} />
                </th>
                <th
                  style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  onClick={() => toggleSort("date")}
                >
                  Date <SortIcon active={sortKey === "date"} dir={sortDir} />
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedArticles.map((a) => (
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
                      onClick={() => setPendingDelete(a)}
                      style={{ color: "oklch(0.46 0.13 70)" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sortedArticles.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--ink-4)", fontFamily: "var(--font-sans)", fontSize: 13, padding: "24px 0" }}>
                    {isSearchMode ? `No articles match "${debouncedQuery}".` : "No articles found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination — hidden in search mode */}
          {!isSearchMode && totalPages > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rule-soft)",
              fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)",
            }}>
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Prev
                </button>
                <span style={{ color: "var(--ink-2)", fontWeight: 500, minWidth: 80, textAlign: "center" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setPendingDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3>Delete article?</h3>
            <p>
              &ldquo;{pendingDelete.title || "(Untitled)"}&rdquo; will be permanently removed.
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm"
                onClick={confirmDelete}
                disabled={deleting}
                style={{ background: "oklch(0.46 0.13 70)", color: "var(--paper)", borderColor: "transparent" }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
