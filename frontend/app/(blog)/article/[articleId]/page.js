import ArticleInteractions from "../../components/ArticleInteractions";

function renderBlock(block, i) {
  const { type, data } = block;

  if (type === "header") {
    const Tag = `h${data.level}`;
    return <Tag key={i} className="formatting-header" dangerouslySetInnerHTML={{ __html: data.text }} />;
  }

  if (type === "paragraph") {
    return <p key={i} className="formatting-paragraph" dangerouslySetInnerHTML={{ __html: data.text }} />;
  }

  if (type === "list") {
    const Tag = data.style === "ordered" ? "ol" : "ul";
    const cls = data.style === "ordered" ? "formatting-list-ordered" : "formatting-list-unordered";
    const itemText = (item) => (typeof item === "string" ? item : item?.content ?? "");
    return (
      <Tag key={i} className={cls}>
        {data.items.map((item, j) => (
          <li key={j} dangerouslySetInnerHTML={{ __html: itemText(item) }} />
        ))}
      </Tag>
    );
  }

  if (type === "checklist") {
    return (
      <ul key={i} className="formatting-checklist">
        {data.items.map((item, j) => (
          <li key={j} className={item.checked ? "formatting-checklist-item checked" : "formatting-checklist-item"}>
            <input type="checkbox" checked={item.checked} readOnly />
            <span dangerouslySetInnerHTML={{ __html: item.text }} />
          </li>
        ))}
      </ul>
    );
  }

  if (type === "warning") {
    return (
      <div key={i} className="formatting-warning" role="alert">
        {data.title && <strong>{data.title}</strong>}
        <p>{data.message}</p>
      </div>
    );
  }

  if (type === "quote") {
    return (
      <blockquote key={i} className="formatting-quote">
        <p dangerouslySetInnerHTML={{ __html: data.text }} />
        {data.caption && <cite>{data.caption}</cite>}
      </blockquote>
    );
  }

  if (type === "code") {
    return (
      <pre key={i} className="formatting-code">
        <code>{data.code}</code>
      </pre>
    );
  }

  if (type === "delimiter") {
    return <hr key={i} className="formatting-delimiter" />;
  }

  if (type === "table") {
    const [head, ...rows] = data.withHeadings ? data.content : [null, ...data.content];
    return (
      <table key={i} className="formatting-table">
        {head && (
          <thead>
            <tr>{head.map((cell, j) => <th key={j} dangerouslySetInnerHTML={{ __html: cell }} />)}</tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, j) => (
            <tr key={j}>
              {row.map((cell, k) => <td key={k} dangerouslySetInnerHTML={{ __html: cell }} />)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === "embed") {
    return (
      <figure key={i} className="embed-block">
        <iframe
          src={data.embed}
          width={data.width}
          height={data.height}
          allowFullScreen
          title={data.caption ?? "Embedded content"}
        />
        {data.caption && <figcaption>{data.caption}</figcaption>}
      </figure>
    );
  }

  if (type === "simpleImage") {
    return (
      <figure key={i} className="image-block">
        <img src={data.url} alt={data.caption ?? ""} />
        {data.caption && <figcaption>{data.caption}</figcaption>}
      </figure>
    );
  }

  if (type === "raw") {
    return <div key={i} className="formatting-raw" dangerouslySetInnerHTML={{ __html: data.html }} />;
  }

  return null;
}

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

  let blocks = null;
  let rawContent = null;
  try {
    const parsed = JSON.parse(article.content);
    blocks = parsed.blocks ?? [];
  } catch {
    rawContent = article.content;
  }

  return (
    <article className="article-page">
      <h1>{article.title || "(Untitled)"}</h1>
      <ArticleInteractions
        articleId={articleId}
        authorEmail={article.author_email ?? null}
        blocks={blocks}
        createdDate={article.created_date ?? null}
      />
      <div className="article-body">
        {blocks ? blocks.map((block, i) => renderBlock(block, i)) : <pre>{rawContent}</pre>}
      </div>
    </article>
  );
}
