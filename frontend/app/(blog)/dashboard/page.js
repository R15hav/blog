"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  getAuthorArticles,
  getAuthorStats,
  getAuthorComments,
  deleteArticle,
  getMyProfile,
} from "../../_lib/api_callout";

const PAGE_SIZE = 20;

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isPublished(val) {
  return val === true || val === "true";
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--ink-4)" }}>
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SortIcon({ active, dir }) {
  const up   = active && dir === "asc";
  const down = active && dir === "desc";
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 1, marginLeft: 4, verticalAlign: "middle", lineHeight: 1 }}>
      <svg width="7" height="4" viewBox="0 0 8 5" style={{ opacity: up ? 1 : 0.25 }}>
        <path d="M4 0L8 5H0z" fill="currentColor" />
      </svg>
      <svg width="7" height="4" viewBox="0 0 8 5" style={{ opacity: down ? 1 : 0.25 }}>
        <path d="M4 5L0 0H8z" fill="currentColor" />
      </svg>
    </span>
  );
}

// ── Delete modal ───────────────────────────────────────────────────────────────

function DeleteModal({ article, onConfirm, onCancel, deleting }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="profile-modal-overlay" onClick={onCancel}>
      <div className="profile-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <p className="profile-modal-title">Delete article?</p>
          <button className="profile-modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="profile-modal-body">
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--ink-2)", margin: "0 0 4px" }}>
            &ldquo;{article.title || "(Untitled)"}&rdquo;
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
            This action cannot be undone.
          </p>
        </div>
        <div className="profile-modal-footer">
          <button
            className="btn btn-primary btn-sm"
            style={{ background: "oklch(0.46 0.13 25)", borderColor: "oklch(0.46 0.13 25)" }}
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Articles ──────────────────────────────────────────────────────────────

function ArticlesTab({ token }) {
  const [articles, setArticles]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [stats, setStats]             = useState(null);
  const [page, setPage]               = useState(1);
  const [query, setQuery]             = useState("");
  const [debounced, setDebounced]     = useState("");
  const [loading, setLoading]         = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [sortKey, setSortKey]         = useState(null);
  const [sortDir, setSortDir]         = useState("desc");

  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isSearchMode = debounced.trim().length > 0;

  // Fetch accurate whole-collection stats once
  useEffect(() => {
    if (!token) return;
    getAuthorStats(token).then(({ success, detail }) => {
      if (success) setStats(detail);
    });
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAuthorArticles(token, { skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, search: debounced })
      .then(({ success, detail }) => {
        setLoading(false);
        if (success) { setArticles(detail.articles); setTotal(detail.total); }
      });
  }, [token, page, debounced]);

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
      } else if (sortKey === "date") {
        av = a.created_date ? new Date(a.created_date).getTime() : 0;
        bv = b.created_date ? new Date(b.created_date).getTime() : 0;
      } else if (sortKey === "likes") {
        av = a.like_count ?? 0;
        bv = b.like_count ?? 0;
      } else {
        av = a.comment_count ?? 0;
        bv = b.comment_count ?? 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [articles, sortKey, sortDir]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    await deleteArticle(pendingDelete.id, token);
    setDeleting(false);
    setPendingDelete(null);
    setArticles((prev) => prev.filter((a) => a.id !== pendingDelete.id));
    setTotal((t) => t - 1);
    setStats((s) => s ? {
      ...s,
      total: s.total - 1,
      ...(isPublished(pendingDelete.published)
        ? { published: s.published - 1 }
        : { draft: s.draft - 1 }),
    } : s);
  }

  const thStyle = { cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };

  return (
    <>
      {/* KPI cards */}
      <div className="dash-kpi-row">
        <div className="dash-kpi">
          <div className="dash-kpi-label">Total</div>
          <div className="dash-kpi-value">{stats ? stats.total : "—"}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-label">Published</div>
          <div className="dash-kpi-value">{stats ? stats.published : "—"}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-label">Drafts</div>
          <div className="dash-kpi-value">{stats ? stats.draft : "—"}</div>
        </div>
      </div>

      {/* Search */}
      <div className="dash-search-row">
        <div className="dash-search-wrap">
          <SearchIcon />
          <input
            placeholder="Search your articles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="dash-search-clear" onClick={() => setQuery("")} aria-label="Clear">×</button>
          )}
        </div>
        {isSearchMode && !loading && (
          <span className="dash-search-hint">
            {total} result{total !== 1 ? "s" : ""} for &ldquo;{debounced}&rdquo;
          </span>
        )}
      </div>

      {loading ? (
        <p className="loading-indicator">Loading…</p>
      ) : articles.length === 0 ? (
        <div className="dashboard-empty">
          <span className="dashboard-empty-title">
            {isSearchMode ? `No articles match "${debounced}".` : "No articles yet."}
          </span>
          {!isSearchMode && (
            <a className="btn btn-primary btn-sm" href="/create-article">Write your first article</a>
          )}
        </div>
      ) : (
        <>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Title</th>
                <th style={thStyle} onClick={() => toggleSort("status")}>
                  Status <SortIcon active={sortKey === "status"} dir={sortDir} />
                </th>
                <th style={thStyle} onClick={() => toggleSort("date")}>
                  Date <SortIcon active={sortKey === "date"} dir={sortDir} />
                </th>
                <th style={thStyle} onClick={() => toggleSort("likes")}>
                  Likes <SortIcon active={sortKey === "likes"} dir={sortDir} />
                </th>
                <th style={thStyle} onClick={() => toggleSort("comments")}>
                  Comments <SortIcon active={sortKey === "comments"} dir={sortDir} />
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedArticles.map((a) => (
                <tr key={a.id}>
                  <td className="td-title">
                    <a href={`/article/${a.id}`}>{a.title || "(Untitled)"}</a>
                  </td>
                  <td>
                    <span className={`dash-badge ${isPublished(a.published) ? "published" : "draft"}`}>
                      {isPublished(a.published) ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="td-mono">{fmt(a.created_date)}</td>
                  <td className="td-mono">{a.like_count ?? 0}</td>
                  <td className="td-mono">{a.comment_count ?? 0}</td>
                  <td>
                    <div className="td-actions">
                      <a className="btn btn-ghost btn-sm" href={`/update-article/${a.id}`}>Edit</a>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "oklch(0.46 0.13 70)" }}
                        onClick={() => setPendingDelete(a)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination — always visible when there are articles */}
          <div className="dashboard-pagination">
            <span className="dashboard-pagination-info">
              {total === 0 ? "0 articles" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            </span>
            <div className="dashboard-pagination-controls">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>Next →</button>
            </div>
          </div>
        </>
      )}

      {pendingDelete && (
        <DeleteModal
          article={pendingDelete}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
          deleting={deleting}
        />
      )}
    </>
  );
}

// ── Tab: Comments ──────────────────────────────────────────────────────────────

function CommentsTab({ token }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!token) return;
    getAuthorComments(token).then(({ success, detail }) => {
      setLoading(false);
      if (success) setComments(detail.comments);
    });
  }, [token]);

  if (loading) return <p className="loading-indicator">Loading…</p>;

  if (comments.length === 0) {
    return (
      <div className="dashboard-empty">
        <span className="dashboard-empty-title">No comments on your articles yet.</span>
        <span>Readers will appear here once they comment.</span>
      </div>
    );
  }

  return (
    <>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", marginBottom: 20, marginTop: 0 }}>
        {comments.length} comment{comments.length !== 1 ? "s" : ""} across your articles
      </p>
      <div className="comment-list">
        {comments.map((c) => (
          <div key={c.id} className="comment-card">
            <div className="comment-card-meta">
              <span className="comment-card-author">{c.author_email}</span>
              <span className="comment-card-dot">·</span>
              <a className="comment-card-article" href={`/article/${c.post_id}`}>
                {c.post_title || "Article"}
              </a>
              <span className="comment-card-date">{fmt(c.created_at)}</span>
            </div>
            <p className="comment-card-body">{c.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Tab: Profile ───────────────────────────────────────────────────────────────

function ProfileTab({ user, token }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!token) return;
    getMyProfile(token).then(({ success, detail }) => { if (success) setProfile(detail); });
  }, [token]);

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email;
  const initials = (() => {
    if (user?.first_name && user?.last_name) return (user.first_name[0] + user.last_name[0]).toUpperCase();
    if (user?.email) return user.email.slice(0, 2).toUpperCase();
    return "??";
  })();

  return (
    <div className="profile-summary-card">
      <div className="profile-summary-hero">
        <div className="avatar lg">{initials}</div>
        <div className="profile-summary-identity">
          <span className="profile-summary-name">{displayName}</span>
          {profile?.profile?.headline && (
            <span className="profile-summary-headline">{profile.profile.headline}</span>
          )}
          <span className="profile-summary-email">{user?.email}</span>
        </div>
      </div>

      {profile && (profile.profile?.location || profile.profile?.contact ||
        profile.experiences?.length > 0 || profile.qualifications?.length > 0) && (
        <div className="profile-summary-fields">
          {profile.profile?.location && (
            <div className="profile-summary-field">
              <label>Location</label>
              <span>{profile.profile.location}</span>
            </div>
          )}
          {profile.profile?.contact && (
            <div className="profile-summary-field">
              <label>Contact</label>
              <span>{profile.profile.contact}</span>
            </div>
          )}
          {profile.experiences?.length > 0 && (
            <div className="profile-summary-field">
              <label>Experience</label>
              <span>{profile.experiences.length} position{profile.experiences.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          {profile.qualifications?.length > 0 && (
            <div className="profile-summary-field">
              <label>Qualifications</label>
              <span>{profile.qualifications.length} listed</span>
            </div>
          )}
        </div>
      )}

      <div>
        <a className="btn btn-primary btn-sm" href="/profile">Edit full profile →</a>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TABS = ["Articles", "Comments", "Profile"];

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Articles");

  const canWrite = user?.is_superuser || ["author", "admin"].includes(user?.role ?? "");

  useEffect(() => {
    if (!authLoading && (!token || !canWrite)) router.push("/login");
  }, [authLoading, token, canWrite, router]);

  if (authLoading) return <div className="dashboard-page"><p className="loading-indicator">Loading…</p></div>;
  if (!token || !canWrite) return null;

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-header-text">
          <h1>Dashboard</h1>
          <p>Welcome back, {displayName}</p>
        </div>
        <a className="btn btn-primary btn-sm" href="/create-article">New article</a>
      </div>

      <div className="dashboard-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`dashboard-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Articles"  && <ArticlesTab token={token} />}
      {activeTab === "Comments"  && <CommentsTab token={token} />}
      {activeTab === "Profile"   && <ProfileTab user={user} token={token} />}
    </div>
  );
}
