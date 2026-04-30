function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

export default async function SearchPage({ searchParams }) {
  const { title } = await searchParams;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  let articles = [];
  let error = null;

  if (title) {
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/search-articles?title=${encodeURIComponent(title)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) error = data?.detail ?? `Search failed (${res.status})`;
      else articles = data?.articles ?? [];
    } catch (err) {
      error = err?.message ?? String(err);
    }
  }

  return (
    <div className="search-page">
      <h1>Search</h1>

      <form action="/search-article" method="get">
        <input
          type="text"
          name="title"
          defaultValue={title ?? ""}
          placeholder="Search articles by title…"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {error && <p role="alert" style={{ color: "oklch(0.46 0.13 70)", fontFamily: "var(--font-sans)", fontSize: 14 }}>Error: {error}</p>}

      {title && !error && articles.length === 0 && (
        <p style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14 }}>
          No articles found for &ldquo;{title}&rdquo;.
        </p>
      )}

      {articles.map((a, i) => {
        const excerpt = getFirstParagraph(a.content).slice(0, 220);
        const date = fmt(a.created_date);
        return (
          <article key={a.id ?? i} className="search-result">
            <h2><a href={`/article/${a.id}`}>{a.title || "(Untitled)"}</a></h2>
            {excerpt && (
              <p style={{ fontFamily: "var(--font-serif)", fontSize: 15.5, lineHeight: 1.55, color: "var(--ink-2)", margin: "6px 0 8px" }}>
                {excerpt}
              </p>
            )}
            <div className="byline-meta">
              {a.author_email && <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{a.author_email}</span>}
              {a.author_email && date && <span className="dot-sep" />}
              {date && <span>{date}</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
