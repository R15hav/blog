"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { getArticles, deleteArticle } from "../../../_lib/api_callout";
import BackButton from "../../../components/BackButton";

export default function AdminArticlesPage() {
    const { token } = useAuth();
    const router = useRouter();
    const [articles, setArticles] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setError(null);
        const { success, detail } = await getArticles();
        if (!success) {
            setError("Failed to load articles.");
        } else {
            setArticles(detail?.articles ?? []);
        }
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, []);

    async function handleDelete(articleId) {
        if (!confirm("Delete this article?")) return;
        const { success, detail } = await deleteArticle(articleId, token);
        if (!success) {
            setError(detail?.detail ?? "Delete failed.");
            return;
        }
        setArticles((prev) => prev.filter((a) => a.id !== articleId));
    }

    if (loading) return <p>Loading articles…</p>;

    return (
        <div>
            <BackButton />
            <h1>All Articles</h1>
            {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Published</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {articles.map((a) => (
                        <tr key={a.id}>
                            <td>{a.title || "(Untitled)"}</td>
                            <td>{String(a.published === true || a.published === "true")}</td>
                            <td>{a.created_date ? new Date(a.created_date).toLocaleDateString() : ""}</td>
                            <td>
                                <button onClick={() => router.push(`/update-article/${a.id}`)}>
                                    Edit
                                </button>
                                {" "}
                                <button onClick={() => handleDelete(a.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
