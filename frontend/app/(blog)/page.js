export default async function Home() {
  let articles = [];
  let error = null;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/v1/get-articles`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      error = `Failed to fetch articles: ${res.status} ${res.statusText}`;
    } else {
      const data = await res.json();
      articles = data?.articles ?? [];
    }
  } catch (err) {
    error = err?.message ?? String(err);
  }

  return (
    <div>
      <h1>Articles</h1>
      <form action="/search-article" method="get">
        <input type="text" name="title" placeholder="Search articles..." />
        <button type="submit">Search</button>
      </form>
      {error && <p role="alert">Error: {error}</p>}
      {!error && articles.length === 0 && <p>No articles yet.</p>}
      {articles.map((a, i) => (
        <article key={a.id ?? i}>
          <h2>
            <a href={`/article/${a.id}`}>{a.title || "(Untitled)"}</a>
          </h2>
          <p>
            Published: {String(a.published === true || a.published === "true")}
            {" · "}
            {a.created_date ? new Date(a.created_date).toLocaleDateString() : ""}
          </p>
          <hr />
        </article>
      ))}
    </div>
  );
}
