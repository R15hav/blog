"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyToken } from "../../_lib/api_callout";
import BackButton from "../../components/BackButton";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const body = new URLSearchParams();
            body.append("username", email);
            body.append("password", password);

            const res = await fetch(`${API}/auth/jwt/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError((data && (data.detail || JSON.stringify(data))) || `Login failed (${res.status})`);
                return;
            }
            const token = data?.access_token ?? data?.token;
            if (!token) {
                setError("No access token returned by server.");
                return;
            }
            // Fetch the user profile so AuthContext has the full user object
            const { valid, detail: userData } = await verifyToken(token);
            if (!valid) {
                setError("Token verification failed. Please try again.");
                return;
            }
            // Store token — the destination page's AuthProvider reads it from localStorage
            localStorage.setItem("access_token", token);
            router.push(userData?.is_superuser ? "/admin/users" : "/");
        } catch (err) {
            setError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <BackButton />
            <h2>Login</h2>
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
            <button type="submit" disabled={loading}>
                {loading ? "Logging in…" : "Login"}
            </button>
            {error && <p role="alert" style={{ color: "red" }}>{String(error)}</p>}
            <p>
                No account? <a href="/register">Register</a>
            </p>
        </form>
    );
}
