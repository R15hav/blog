export default async function Home() {
  let articles = []
  let error = null

  try {
    const res = await fetch('http://localhost:8000/api/v1/get-articles')
    if (!res.ok) {
      error = `Failed to fetch articles: ${res.status} ${res.statusText}`
    } else {
      const data = await res.json()
      articles = (data && data.articles) ? data.articles : []
    }
  } catch (err) {
    error = err && err.message ? err.message : String(err)
  }

  const renderContent = (content) => {
    if (typeof content !== 'string') {
      try {
        return <pre>{JSON.stringify(content, null, 2)}</pre>
      } catch {
        return <pre>{String(content)}</pre>
      }
    }

    // try parsing JSON-encoded EditorJS content
    try {
      const parsed = JSON.parse(content)
      return <pre>{JSON.stringify(parsed, null, 2)}</pre>
    } catch {
      return <pre>{content}</pre>
    }
  }

  return (
    <div>
      <h1>Articles</h1>
      {error && <div role="alert">Error: {error}</div>}
      {!error && (!articles || articles.length === 0) && <p>No articles found.</p>}
      {!error && articles && articles.map((a, i) => (
        <article key={a.id || i}>
          <h2>{a.title || 'Untitled'}</h2>
          <div>Owner: {a.owner_id || 'unknown'}</div>
          <div>Published: {String(a.published === true || a.published === 'true')}</div>
          <div>Created: {a.created_date ? new Date(a.created_date).toLocaleString() : ''}</div>
          <div>{renderContent(a.content)}</div>
          <hr />
        </article>
      ))}
    </div>
  )
}
