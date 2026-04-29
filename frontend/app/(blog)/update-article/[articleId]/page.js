"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import BackButton from "../../../components/BackButton";
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
                if (success && article) {
                    setArticleData(article);
                } else {
                    setLoadError("Article not found.");
                }
            })
            .catch(() => setLoadError("Failed to load article."));
    }, [articleId]);

    if (loadError) return <p role="alert">{loadError}</p>;
    if (!articleData) return <p>Loading…</p>;

    let initialData = null;
    try { initialData = JSON.parse(articleData.content); } catch { initialData = null; }

    return (
        <div>
            <BackButton />
            <DynamicEditorjs
                id={articleId}
                initialData={initialData}
                initialTitle={articleData.title ?? ""}
                initialPublished={articleData.published === true || articleData.published === "true"}
            />
        </div>
    );
}
