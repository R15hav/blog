import BackButton from "../../components/BackButton";

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
      if (!res.ok) {
        error = data?.detail ?? `Search failed (${res.status})`;
      } else {
        articles = data?.articles ?? [];
      }
    } catch (err) {
      error = err?.message ?? String(err);
    }
  }

  return (
    <div>
      <BackButton />
      <h1>Search</h1>
      <form action="/search-article" method="get">
        <input type="text" name="title" defaultValue={title ?? ""} placeholder="Article title..." />
        <button type="submit">Search</button>
      </form>
      {error && <p role="alert">Error: {error}</p>}
      {title && !error && articles.length === 0 && (
        <p>No articles found for &ldquo;{title}&rdquo;.</p>
      )}
      {articles.map((a, i) => (
        <article key={a.id ?? i}>
          <h2>
            <a href={`/article/${a.id}`}>{a.title || "(Untitled)"}</a>
          </h2>
          <hr />
        </article>
      ))}
    </div>
  );
}
