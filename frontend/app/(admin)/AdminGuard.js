"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import BackButton from "../components/BackButton";

export default function AdminGuard({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || !user.is_superuser)) {
            router.replace("/login");
        }
    }, [user, loading, router]);

    if (loading) return <p>Loading…</p>;
    if (!user || !user.is_superuser) return null;

    return (
        <>
            <nav>
                <BackButton />
                {" | "}
                <strong>Admin</strong>
                {" | "}
                <a href="/admin">Dashboard</a>
                {" | "}
                <a href="/admin/users">Users</a>
                {" | "}
                <a href="/admin/articles">Articles</a>
                {" | "}
                <a href="/admin/theme">Theme</a>
                {" | "}
                <a href="/">View Site</a>
            </nav>
            <main>{children}</main>
        </>
    );
}
