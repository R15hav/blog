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

  return (
    <div>
      <h1>Articles</h1>
      <form action="/search-article" method="get">
        <input type="text" name="title" placeholder="Search articles…" />
        <button type="submit">Search</button>
      </form>
      {error && <p role="alert">Error: {error}</p>}
      {!error && articles.length === 0 && !loading && <p>No articles yet.</p>}
      {articles.map((a, i) => (
        <article key={a.id ?? i}>
          <h2>
            <a href={`/article/${a.id}`}>{a.title || "(Untitled)"}</a>
          </h2>
          <p>
            {a.created_date ? new Date(a.created_date).toLocaleDateString() : ""}
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
