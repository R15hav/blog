"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getUsers, activateUser, deactivateUser } from "../../_lib/api_callout";

export default function UsersPage() {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setError(null);
        const { success, detail } = await getUsers(token);
        if (!success) {
            setError(detail?.detail ?? "Failed to load users.");
        } else {
            setUsers(detail?.users ?? []);
        }
        setLoading(false);
    }

    useEffect(() => {
        if (token) load();
    }, [token]);

    async function toggle(userId, currentlyActive) {
        const fn = currentlyActive ? deactivateUser : activateUser;
        const { success, detail } = await fn(userId, token);
        if (!success) {
            setError(detail?.detail ?? "Action failed.");
            return;
        }
        setUsers((prev) =>
            prev.map((u) =>
                u.id === userId ? { ...u, is_active: !currentlyActive } : u
            )
        );
    }

    if (loading) return <p>Loading users…</p>;

    return (
        <div>
            <h1>User Management</h1>
            {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
            <table>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Active</th>
                        <th>Admin</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.id}>
                            <td>{u.email}</td>
                            <td>{u.is_active ? "Yes" : "No"}</td>
                            <td>{u.is_superuser ? "Yes" : "—"}</td>
                            <td>
                                <button onClick={() => toggle(u.id, u.is_active)}>
                                    {u.is_active ? "Deactivate" : "Activate"}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
