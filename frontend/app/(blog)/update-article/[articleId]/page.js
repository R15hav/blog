"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getArticle } from "../../../_lib/api_callout";
import { getTokenFromLocalStorage } from "../../../_lib/utility";
import { useAuth } from "../../../context/AuthContext";

const DynamicEditorjs = dynamic(() => import("../../../components/Editorjs"), { ssr: false });

export default function UpdateArticlePage({ params }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [articleId, setArticleId] = useState(null);
    const [articleData, setArticleData] = useState(null);
    const [loadError, setLoadError] = useState(null);

    const allowed = user?.is_superuser || ["author", "admin"].includes(user?.role);

    useEffect(() => {
        if (loading) return;
        if (!user || !allowed) router.replace("/login");
    }, [user, loading, allowed, router]);

    useEffect(() => {
        params.then((res) => setArticleId(res.articleId));
    }, [params]);

    useEffect(() => {
        if (!articleId || !allowed) return;
        // Send the owner's token so their own drafts can be loaded for editing.
        const { token } = getTokenFromLocalStorage();
        getArticle(articleId, token)
            .then(({ success, detail }) => {
                const article = detail?.article?.[0];
                if (!success || !article) {
                    setLoadError("Article not found.");
                } else if (!user.is_superuser && article.owner_id !== user.id) {
                    // Client-side convenience only; the backend enforces ownership on save.
                    setLoadError("You can only edit your own articles.");
                } else {
                    setArticleData(article);
                }
            })
            .catch(() => setLoadError("Failed to load article."));
    }, [articleId, allowed, user]);

    if (loading || !user || !allowed) return null;

    if (loadError) return (
        <div className="editor-shell">
            <p style={{ fontFamily: "var(--font-sans)", color: "oklch(0.46 0.13 70)", fontSize: 14 }} role="alert">
                {loadError}
            </p>
        </div>
    );

    if (!articleData) return (
        <div className="editor-shell">
            <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14 }}>Loading…</p>
        </div>
    );

    let initialData = null;
    try { initialData = JSON.parse(articleData.content); } catch { initialData = null; }

    return (
        <DynamicEditorjs
            id={articleId}
            initialData={initialData}
            initialTitle={articleData.title ?? ""}
            initialPublished={articleData.published === true || articleData.published === "true"}
        />
    );
}
