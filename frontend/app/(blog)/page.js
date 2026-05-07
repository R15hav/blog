import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSiteSettings } from "../_lib/api_callout";

const PAGE_SIZE = 20;
const LATEST_ANCHOR_COUNT = 30;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

function parsePage(raw) {
  if (raw === undefined || raw === null || raw === "") return { page: 1, kind: "default" };
  if (Array.isArray(raw)) raw = raw[0];
  if (raw === "1") return { page: 1, kind: "one" };
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || String(n) !== String(raw)) return { page: null, kind: "invalid" };
  return { page: n, kind: "n" };
}

async function fetchPage(page) {
  const skip = (page - 1) * PAGE_SIZE;
  const params = new URLSearchParams({ skip: String(skip), limit: String(PAGE_SIZE) });
  const res = await fetch(`${API}/api/v1/get-articles?${params}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to fetch articles (HTTP ${res.status})`);
  const data = await res.json();
  return { articles: data?.articles ?? [], total: data?.total ?? 0 };
}

async function fetchLatestForCrawl() {
  const res = await fetch(`${API}/api/v1/get-articles?skip=0&limit=${LATEST_ANCHOR_COUNT}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return data?.articles ?? [];
}

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const { page, kind } = parsePage(sp?.page);

  let siteName = "Blog";
  let baseUrl = APP_URL;
  try {
    const { success, detail } = await getSiteSettings();
    if (success && detail) {
      siteName = detail.site_name || siteName;
      baseUrl = detail.site_url || APP_URL;
    }
  } catch {}

  if (kind === "default" || kind === "one") {
    return {
      title: siteName,
      alternates: { canonical: `${baseUrl}/` },
      robots: { index: true, follow: true },
    };
  }
  if (kind === "invalid" || page === null) {
    return { title: `Not Found | ${siteName}`, robots: { index: false, follow: false } };
  }
  return {
    title: `Page ${page} | ${siteName}`,
    alternates: { canonical: `${baseUrl}/?page=${page}` },
    robots: { index: true, follow: true },
  };
}

function Pagination({ page, totalPages }) {
  if (totalPages <= 1) return null;

  const window = new Set([1, totalPages, page, page - 1, page + 1, page - 2, page + 2]);
  const nums = [...window].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const items = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) items.push({ type: "gap", key: `gap-${n}` });
    items.push({ type: "num", key: `n-${n}`, n });
    prev = n;
  }

  const hrefFor = (n) => (n === 1 ? "/" : `/?page=${n}`);

  return (
    <nav className="pagination" aria-label="Pagination">
      <ul className="pagination-list">
        <li>
          {page > 1 ? (
            <Link className="pagination-link" rel="prev" href={hrefFor(page - 1)}>
              ← Previous
            </Link>
          ) : (
            <span className="pagination-link is-disabled" aria-disabled="true">← Previous</span>
          )}
        </li>
        {items.map((it) =>
          it.type === "gap" ? (
            <li key={it.key} className="pagination-gap" aria-hidden="true">…</li>
          ) : it.n === page ? (
            <li key={it.key}>
              <span className="pagination-link is-current" aria-current="page">{it.n}</span>
            </li>
          ) : (
            <li key={it.key}>
              <Link className="pagination-link" href={hrefFor(it.n)}>{it.n}</Link>
            </li>
          )
        )}
        <li>
          {page < totalPages ? (
            <Link className="pagination-link" rel="next" href={hrefFor(page + 1)}>
              Next →
            </Link>
          ) : (
            <span className="pagination-link is-disabled" aria-disabled="true">Next →</span>
          )}
        </li>
      </ul>
    </nav>
  );
}

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const { page, kind } = parsePage(sp?.page);

  if (kind === "one") redirect("/");
  if (kind === "invalid" || page === null) notFound();

  let feed;
  try {
    if (page === 1) {
      const [pageData, latest] = await Promise.all([fetchPage(1), fetchLatestForCrawl()]);
      feed = { ...pageData, latest };
    } else {
      feed = await fetchPage(page);
    }
  } catch (err) {
    return (
      <div className="feed">
        <p role="alert">Error: {err?.message ?? "Failed to load articles."}</p>
      </div>
    );
  }

  const { articles, total } = feed;
  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));

  if (total > 0 && page > totalPages) notFound();

  if (articles.length === 0) {
    return (
      <div className="feed">
        <p>No articles yet.</p>
      </div>
    );
  }

  const isFirst = page === 1;
  const featured = isFirst ? articles[0] ?? null : null;
  const sidePeek = isFirst ? articles.slice(1, 4) : [];
  const list = isFirst ? articles.slice(4) : articles;
  const listOffset = isFirst ? 4 : 0;

  return (
    <div className="feed">
      {featured && (
        <div className="hero">
          <div>
            <span className="tag">Featured</span>
            <h1 className="hero-title">
              <Link href={`/article/${featured.id}`}>{featured.title || "(Untitled)"}</Link>
            </h1>
            <p className="hero-deck">
              {getFirstParagraph(featured.content).slice(0, 280) || " "}
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
                  <h5><Link href={`/article/${a.id}`}>{a.title || "(Untitled)"}</Link></h5>
                  <span className="meta">
                    By {a.author_name ?? "Unknown"} · {getReadTime(a.content)} min
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {list.length > 0 && (
        <>
          <div className="section-eyebrow">{isFirst ? "Latest" : `Page ${page}`}</div>
          <div className="list">
            {list.map((a, i) => (
              <article className="list-item" key={a.id ?? i}>
                <span className="list-num">{pad(i + 1 + listOffset + (page - 1) * PAGE_SIZE)}</span>
                <div>
                  <h2 className="list-title">
                    <Link href={`/article/${a.id}`}>{a.title || "(Untitled)"}</Link>
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

      <Pagination page={page} totalPages={totalPages} />

      {isFirst && Array.isArray(feed.latest) && feed.latest.length > 0 && (
        <nav
          aria-label="Recent articles"
          className="recent-anchors"
          style={{
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--border, #e5e5e5)",
            fontSize: "0.85rem",
            color: "var(--ink-2, #666)",
          }}
        >
          <h2 style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
            Recent articles
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.35rem" }}>
            {feed.latest.map((a) => (
              <li key={a.id}>
                <Link href={`/article/${a.id}`}>{a.title || "(Untitled)"}</Link>
                {a.created_date && (
                  <span style={{ marginLeft: "0.5rem", color: "var(--ink-3, #999)", fontSize: "0.75rem" }}>
                    {fmt(a.created_date, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
