"use client";
import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 20;

function getReadTime(content) {
  try {
    const { blocks = [] } = JSON.parse(content);
    let words = 0;
    for (const b of blocks) {
      if (b.type === "paragraph" || b.type === "header")
        words += (b.data?.text ?? "").replace(/<[^>]+>/g, "").trim().split(/\s+/).filter(Boolean).length;
      if (b.type === "list")
        for (const item of b.data?.items ?? []) {
          const t = (typeof item === "string" ? item : item?.content ?? "").replace(/<[^>]+>/g, "");
          words += t.trim().split(/\s+/).filter(Boolean).length;
        }
    }
    return Math.max(1, Math.ceil(words / 200));
  } catch {
    return 1;
  }
}

function getFirstParagraph(content) {
  try {
    const { blocks = [] } = JSON.parse(content);
    const p = blocks.find((b) => b.type === "paragraph");
    return p?.data?.text?.replace(/<[^>]+>/g, "") ?? "";
  } catch {
    return "";
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmt(dateStr, opts = { month: "short", day: "numeric", year: "numeric" }) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", opts);
}

function AuthorInitial(name) {
  return name?.[0]?.toUpperCase() ?? "?";
}

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
      const res = await fetch(`${API}/api/v1/get-articles?skip=${skipRef.current}&limit=${PAGE_SIZE}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.detail ?? "Failed to fetch"); return; }
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

  useEffect(() => { fetchPage(); }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchPage(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [total]);

  if (error) return <div className="feed"><p role="alert">Error: {error}</p></div>;
  if (!loading && articles.length === 0) return <div className="feed"><p>No articles yet.</p></div>;

  const featured = articles[0] ?? null;
  const sidePeek = articles.slice(1, 4);
  const list = articles.slice(4);
  const hasMore = total === null || skipRef.current < total;

  return (
    <div className="feed">
      {/* ── Hero ── */}
      {featured && (
        <div className="hero">
          <div>
            <span className="tag">Featured</span>
            <h1 className="hero-title">
              <a href={`/article/${featured.id}`}>{featured.title || "(Untitled)"}</a>
            </h1>
            <p className="hero-deck">
              {getFirstParagraph(featured.content).slice(0, 280) || " "}
            </p>
            <div className="hero-meta">
              <div className="avatar">{AuthorInitial(featured.author_name)}</div>
              <div>
                <div className="byline-name">{featured.author_name ?? "Unknown"}</div>
                <div className="byline-meta">
                  <span>{getReadTime(featured.content)} min read</span>
                  {featured.created_date && (
                    <>
                      <span className="dot-sep" />
                      <span>{fmt(featured.created_date)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {sidePeek.length > 0 && (
            <div className="hero-side">
              <h4>Also worth your time</h4>
              {sidePeek.map((a) => (
                <div key={a.id} className="side-item">
                  {a.created_date && (
                    <span className="meta-mono">
                      {fmt(a.created_date, { month: "short", day: "numeric" }).toUpperCase()}
                    </span>
                  )}
                  <h5><a href={`/article/${a.id}`}>{a.title || "(Untitled)"}</a></h5>
                  <span className="meta">
                    By {a.author_name ?? "Unknown"} · {getReadTime(a.content)} min
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Latest list ── */}
      {list.length > 0 && (
        <>
          <div className="section-eyebrow">Latest</div>
          <div className="list">
            {list.map((a, i) => (
              <article className="list-item" key={a.id ?? i}>
                <span className="list-num">{pad(i + 1)}</span>
                <div>
                  <h2 className="list-title">
                    <a href={`/article/${a.id}`}>{a.title || "(Untitled)"}</a>
                  </h2>
                  <p className="list-deck">
                    {getFirstParagraph(a.content).slice(0, 200)}
                  </p>
                  <div className="list-meta">
                    <div className="avatar sm">{AuthorInitial(a.author_name)}</div>
                    <div className="byline-meta">
                      <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>
                        {a.author_name ?? "Unknown"}
                      </span>
                      {a.created_date && (
                        <>
                          <span className="dot-sep" />
                          <span>{fmt(a.created_date, { month: "short", day: "numeric" })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="list-aside">
                  <div>{getReadTime(a.content)} MIN</div>
                  {a.created_date && (
                    <div style={{ marginTop: 4 }}>
                      {fmt(a.created_date, { month: "short", day: "numeric" }).toUpperCase()}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {loading && <p className="loading-indicator" aria-live="polite">Loading…</p>}
      {!hasMore && articles.length > 0 && <p className="end-of-feed">No more articles.</p>}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
    </div>
  );
}
