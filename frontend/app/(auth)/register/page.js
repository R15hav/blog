"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Register() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(
                    (data && (data.detail || JSON.stringify(data))) ||
                    `Registration failed (${res.status})`
                );
                return;
            }
            setDone(true);
        } catch (err) {
            setError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    }

    if (done) {
        return (
            <div>
                <h2>Registration successful</h2>
                <p>
                    Your account is pending approval. An admin will activate it before
                    you can log in.
                </p>
                <a href="/login">Back to Login</a>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <h2>Register</h2>
            <div>
                <label>
                    Email:
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>
            </div>
            <div>
                <label>
                    Password:
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </label>
            </div>
            <div>
                <label>
                    Confirm password:
                    <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                    />
                </label>
            </div>
            <button type="submit" disabled={loading}>
                {loading ? "Registering…" : "Register"}
            </button>
            {error && <p role="alert" style={{ color: "red" }}>{String(error)}</p>}
            <p>
                Already have an account? <a href="/login">Login</a>
            </p>
        </form>
    );
}
