import BackButton from "../../../components/BackButton";

function renderBlock(block, i) {
  const { type, data } = block;

  if (type === "header") {
    const Tag = `h${data.level}`;
    return <Tag key={i} dangerouslySetInnerHTML={{ __html: data.text }} />;
  }

  if (type === "paragraph") {
    return <p key={i} dangerouslySetInnerHTML={{ __html: data.text }} />;
  }

  if (type === "list") {
    const Tag = data.style === "ordered" ? "ol" : "ul";
    // @editorjs/list v2 items are objects { content, items }, v1 are plain strings
    const itemText = (item) => (typeof item === "string" ? item : item?.content ?? "");
    return (
      <Tag key={i}>
        {data.items.map((item, j) => (
          <li key={j} dangerouslySetInnerHTML={{ __html: itemText(item) }} />
        ))}
      </Tag>
    );
  }

  if (type === "checklist") {
    return (
      <ul key={i} className="checklist">
        {data.items.map((item, j) => (
          <li key={j} className={item.checked ? "checklist-item checked" : "checklist-item"}>
            <input type="checkbox" checked={item.checked} readOnly />
            {" "}
            <span dangerouslySetInnerHTML={{ __html: item.text }} />
          </li>
        ))}
      </ul>
    );
  }

  if (type === "warning") {
    return (
      <div key={i} className="warning-block" role="alert">
        {data.title && <strong className="warning-title">{data.title}</strong>}
        <p className="warning-message">{data.message}</p>
      </div>
    );
  }

  if (type === "quote") {
    return (
      <blockquote key={i} className="quote-block">
        <p dangerouslySetInnerHTML={{ __html: data.text }} />
        {data.caption && <cite>{data.caption}</cite>}
      </blockquote>
    );
  }

  if (type === "code") {
    return <pre key={i}><code>{data.code}</code></pre>;
  }

  if (type === "delimiter") {
    return <hr key={i} className="delimiter" />;
  }

  if (type === "table") {
    const [head, ...rows] = data.withHeadings ? data.content : [null, ...data.content];
    return (
      <table key={i} className="editor-table">
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
    return <div key={i} dangerouslySetInnerHTML={{ __html: data.html }} />;
  }

  // Unknown block type — render nothing rather than leaking raw JSON
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

  let content = null;
  try {
    const parsed = JSON.parse(article.content);
    content = <div>{parsed.blocks?.map((block, i) => renderBlock(block, i))}</div>;
  } catch {
    content = <pre>{article.content}</pre>;
  }

  return (
    <article>
      <BackButton />
      <h1>{article.title || "(Untitled)"}</h1>
      <p>{article.created_date ? new Date(article.created_date).toLocaleDateString() : ""}</p>
      <div>{content}</div>
    </article>
  );
}
