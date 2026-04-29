import BackButton from "../../../components/BackButton";

export default async function ArticlePage({ params }) {
  const { articleId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  let article = null;
  let error = null;

  try {
    const res = await fetch(`${apiUrl}/api/v1/get-article/${articleId}`, {
      next: { revalidate: 30 },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      error = data?.detail ?? `Failed to fetch article (${res.status})`;
    } else {
      article = data?.article?.[0] ?? null;
    }
  } catch (err) {
    error = err?.message ?? String(err);
  }

  if (error) return <p role="alert">Error: {error}</p>;
  if (!article) return <p>Article not found.</p>;

  let content = null;
  try {
    const parsed = JSON.parse(article.content);
    content = (
      <div>
        {parsed.blocks?.map((block, i) => {
          if (block.type === "header") {
            const Tag = `h${block.data.level}`;
            return <Tag key={i} dangerouslySetInnerHTML={{ __html: block.data.text }} />;
          }
          if (block.type === "paragraph") {
            return <p key={i} dangerouslySetInnerHTML={{ __html: block.data.text }} />;
          }
          if (block.type === "list") {
            const Tag = block.data.style === "ordered" ? "ol" : "ul";
            // v2 list items are objects { content, items }, v1 items are plain strings
            const itemText = (item) => (typeof item === "string" ? item : item?.content ?? "");
            return (
              <Tag key={i}>
                {block.data.items.map((item, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: itemText(item) }} />
                ))}
              </Tag>
            );
          }
          if (block.type === "code") {
            return <pre key={i}><code>{block.data.code}</code></pre>;
          }
          return <pre key={i}>{JSON.stringify(block.data, null, 2)}</pre>;
        })}
      </div>
    );
  } catch {
    content = <pre>{article.content}</pre>;
  }

  return (
    <article>
      <BackButton />
      <h1>{article.title || "(Untitled)"}</h1>
      <p>
        {article.created_date ? new Date(article.created_date).toLocaleDateString() : ""}
      </p>
      <div>{content}</div>
    </article>
  );
}
