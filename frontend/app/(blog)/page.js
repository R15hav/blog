"use client";
import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 10;

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const skipRef = useRef(0);
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);

  async function fetchPage() {
    if (loadingRef.current) return;
    if (total !== null && skipRef.current >= total) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/v1/get-articles?skip=${skipRef.current}&limit=${PAGE_SIZE}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail ?? "Failed to fetch articles");
        return;
      }
      const fetched = data?.articles ?? [];
      setArticles((prev) => [...prev, ...fetched]);
      setTotal(data?.total ?? 0);
      skipRef.current += fetched.length;
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPage();
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchPage();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [total]);

  const hasMore = total === null || skipRef.current < total;

  function getReadTime(content) {
    try {
      const { blocks = [] } = JSON.parse(content);
      let words = 0;
      for (const b of blocks) {
        if (b.type === "paragraph" || b.type === "header") {
          words += (b.data?.text ?? "").replace(/<[^>]+>/g, "").trim().split(/\s+/).filter(Boolean).length;
        }
        if (b.type === "list") {
          for (const item of b.data?.items ?? []) {
            const t = (typeof item === "string" ? item : item?.content ?? "").replace(/<[^>]+>/g, "");
            words += t.trim().split(/\s+/).filter(Boolean).length;
          }
        }
      }
      return Math.max(1, Math.ceil(words / 200));
    } catch {
      return 1;
    }
  }

  return (
    <div className="home-feed">
      <h1>Articles</h1>
      {error && <p role="alert">Error: {error}</p>}
      {!error && articles.length === 0 && !loading && <p>No articles yet.</p>}
      {articles.map((a, i) => (
        <article key={a.id ?? i}>
          <h2>
            <a href={`/article/${a.id}`}>{a.title || "(Untitled)"}</a>
          </h2>
          <p>
            {a.author_email && <span className="card-author">{a.author_email}</span>}
            {a.author_email && <span> · </span>}
            <span>{getReadTime(a.content)} min read</span>
            {a.created_date && <span> · {new Date(a.created_date).toLocaleDateString()}</span>}
          </p>
          <hr />
        </article>
      ))}
      {loading && <p className="loading-indicator" aria-live="polite">Loading…</p>}
      {!hasMore && articles.length > 0 && (
        <p className="end-of-feed">No more articles.</p>
      )}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
    </div>
  );
}
