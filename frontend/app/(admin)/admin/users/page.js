"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { getUsers, activateUser, deactivateUser } from "../../../_lib/api_callout";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    const { success, detail } = await getUsers(token);
    if (!success) setError(detail?.detail ?? "Failed to load users.");
    else setUsers(detail?.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function toggle(userId, currentlyActive) {
    const fn = currentlyActive ? deactivateUser : activateUser;
    const { success, detail } = await fn(userId, token);
    if (!success) { setError(detail?.detail ?? "Action failed."); return; }
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !currentlyActive } : u));
  }

  const total = users.length;
  const active = users.filter((u) => u.is_active).length;
  const pending = users.filter((u) => !u.is_active).length;
  const admins = users.filter((u) => u.is_superuser).length;

  if (loading) return (
    <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14, paddingTop: 24 }}>Loading users…</p>
  );

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
        <div className="kpi"><div className="kpi-label">Total</div><div className="kpi-value">{total}</div></div>
        <div className="kpi"><div className="kpi-label">Active</div><div className="kpi-value">{active}</div></div>
        <div className="kpi"><div className="kpi-label">Pending</div><div className="kpi-value">{pending}</div></div>
        <div className="kpi"><div className="kpi-label">Admins</div><div className="kpi-value">{admins}</div></div>
      </div>

      <table className="dataset">
        <thead>
          <tr>
            <th>Email</th>
            <th>Status</th>
            <th>Role</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
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
        </tbody>
      </table>
    </>
  );
}
