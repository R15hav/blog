"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getArticle } from "../../../_lib/api_callout";

const DynamicEditorjs = dynamic(() => import("../../../components/Editorjs"), { ssr: false });

export default function UpdateArticlePage({ params }) {
    const [articleId, setArticleId] = useState(null);
    const [articleData, setArticleData] = useState(null);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        params.then((res) => setArticleId(res.articleId));
    }, [params]);

    useEffect(() => {
        if (!articleId) return;
        getArticle(articleId)
            .then(({ success, detail }) => {
                const article = detail?.article?.[0];
                if (success && article) setArticleData(article);
                else setLoadError("Article not found.");
            })
            .catch(() => setLoadError("Failed to load article."));
    }, [articleId]);

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
