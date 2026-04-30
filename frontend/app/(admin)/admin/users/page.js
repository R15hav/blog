"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { getUsers, activateUser, deactivateUser, getAdminStats } from "../../../_lib/api_callout";

const PAGE_SIZE = 20;

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

export default function UsersPage() {
  const { token } = useAuth();

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const [sortKey, setSortKey] = useState(null); // "status" | "role" | null
  const [sortDir, setSortDir] = useState("desc");

  const isSearchMode = debouncedQuery.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch users
  async function loadUsers(p, search = "") {
    if (!token) return;
    search ? setSearching(true) : setLoading(true);
    setError(null);
    const { success, detail } = await getUsers(token, {
      skip: (p - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search,
    });
    if (!success) setError(detail?.detail ?? "Failed to load users.");
    else {
      setUsers(detail?.users ?? []);
      setTotal(detail?.total ?? 0);
    }
    setLoading(false);
    setSearching(false);
  }

  useEffect(() => {
    if (!token) return;
    if (isSearchMode) return;
    loadUsers(page, "");
  }, [page, token, isSearchMode]);

  useEffect(() => {
    if (!token) return;
    if (!isSearchMode) return;
    loadUsers(1, debouncedQuery.trim());
  }, [debouncedQuery, token]);

  // Reset page + sort when switching modes
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

  const sortedUsers = useMemo(() => {
    if (!sortKey) return users;
    return [...users].sort((a, b) => {
      const av = sortKey === "status" ? (a.is_active ? 1 : 0) : (a.is_superuser ? 1 : 0);
      const bv = sortKey === "status" ? (b.is_active ? 1 : 0) : (b.is_superuser ? 1 : 0);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [users, sortKey, sortDir]);

  async function toggle(userId, currentlyActive) {
    const fn = currentlyActive ? deactivateUser : activateUser;
    const { success, detail } = await fn(userId, token);
    if (!success) { setError(detail?.detail ?? "Action failed."); return; }
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !currentlyActive } : u));
  }

  const kpiTotal   = stats?.users?.total  ?? total;
  const kpiActive  = stats?.users?.active ?? "—";
  const kpiPending = stats?.users?.total != null ? stats.users.total - stats.users.active : "—";
  const kpiAdmins  = users.filter((u) => u.is_superuser).length || "—";
  const isLoading  = loading || searching;

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Users</h1>
          <p>Manage user accounts and access</p>
        </div>
      </div>

      {error && <p className="msg-error" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Total</div><div className="kpi-value">{kpiTotal}</div></div>
        <div className="kpi"><div className="kpi-label">Active</div><div className="kpi-value">{kpiActive}</div></div>
        <div className="kpi"><div className="kpi-label">Pending</div><div className="kpi-value">{kpiPending}</div></div>
        <div className="kpi"><div className="kpi-label">Admins</div><div className="kpi-value">{kpiAdmins}</div></div>
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
            placeholder="Search by email…"
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
            {total} result{total !== 1 ? "s" : ""} for &ldquo;{debouncedQuery}&rdquo;
          </span>
        )}
      </div>

      {isLoading ? (
        <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14, paddingTop: 4 }}>
          {searching ? "Searching…" : "Loading…"}
        </p>
      ) : (
        <>
          <table className="dataset">
            <thead>
              <tr>
                <th>Email</th>
                <th
                  style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon active={sortKey === "status"} dir={sortDir} />
                </th>
                <th
                  style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  onClick={() => toggleSort("role")}
                >
                  Role <SortIcon active={sortKey === "role"} dir={sortDir} />
                </th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{u.email}</td>
                  <td>
                    {u.is_active ? (
                      <span className="status ok"><span className="dot" />Active</span>
                    ) : (
                      <span className="status warn"><span className="dot" />Pending</span>
                    )}
                  </td>
                  <td>
                    {u.is_superuser ? (
                      <span className="status accent">Admin</span>
                    ) : (
                      <span style={{ color: "var(--ink-4)", fontFamily: "var(--font-sans)", fontSize: 13 }}>Writer</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggle(u.id, u.is_active)}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {sortedUsers.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--ink-4)", fontFamily: "var(--font-sans)", fontSize: 13, padding: "24px 0" }}>
                    {isSearchMode ? `No users match "${debouncedQuery}".` : "No users found."}
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
    </>
  );
}
