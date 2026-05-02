import ReadingProgress from "../../components/ReadingProgress";
import TableOfContents from "../../components/TableOfContents";
import ArticleInteractions from "../../components/ArticleInteractions";
import BookmarkRailButton from "../../components/BookmarkRailButton";
import ShareRailButton from "../../components/ShareRailButton";

const _API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const _APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function _fetchArticleForMeta(articleId) {
  try {
    const res = await fetch(`${_API}/api/v1/get-article/${articleId}`, { next: { revalidate: 30 } });
    const data = await res.json().catch(() => null);
    return res.ok ? (data?.article?.[0] ?? null) : null;
  } catch {
    return null;
  }
}

async function _fetchSiteSettings() {
  try {
    const res = await fetch(`${_API}/api/v1/settings`, { next: { revalidate: 60 } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function _firstParagraphText(blocks) {
  if (!blocks) return "";
  const b = blocks.find((b) => b.type === "paragraph");
  return (b?.data?.text ?? "").replace(/<[^>]+>/g, "").slice(0, 160);
}

function _firstImageUrl(blocks) {
  if (!blocks) return null;
  return blocks.find((b) => b.type === "simpleImage")?.data?.url ?? null;
}

export async function generateMetadata({ params }) {
  const { articleId } = await params;
  const [article, settings] = await Promise.all([
    _fetchArticleForMeta(articleId),
    _fetchSiteSettings(),
  ]);

  if (!article) return { title: "Article Not Found" };

  let blocks = null;
  try { blocks = JSON.parse(article.content)?.blocks ?? []; } catch {}

  const title = article.title || "Untitled";
  const description = _firstParagraphText(blocks);
  const siteUrl = settings?.site_url || _APP_URL;
  const logoUrl = settings?.logo_url ?? null;
  const absoluteLogoUrl = logoUrl
    ? (logoUrl.startsWith("http") ? logoUrl : `${_API}${logoUrl}`)
    : null;
  const ogImage = _firstImageUrl(blocks) ?? absoluteLogoUrl;
  const canonicalUrl = `${siteUrl}/article/${articleId}`;
  const authorDisplay = article.author_name ?? article.author_email ?? null;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title,
      description,
      ...(article.created_date ? { publishedTime: article.created_date } : {}),
      ...(authorDisplay ? { authors: [authorDisplay] } : {}),
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/* ── Helpers ──────────────────────────────────────── */

function slugify(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function countWords(blocks) {
  if (!blocks) return 0;
  let n = 0;
  for (const b of blocks) {
    if (b.type === "paragraph" || b.type === "header")
      n += (b.data?.text ?? "").replace(/<[^>]+>/g, "").trim().split(/\s+/).filter(Boolean).length;
    if (b.type === "list")
      for (const item of b.data?.items ?? []) {
        const t = (typeof item === "string" ? item : item?.content ?? "").replace(/<[^>]+>/g, "");
        n += t.trim().split(/\s+/).filter(Boolean).length;
      }
  }
  return n;
}

function extractHeadings(blocks) {
  if (!blocks) return [];
  return blocks
    .map((b, i) => ({ ...b, idx: i }))
    .filter((b) => b.type === "header")
    .map((b) => ({
      id: `h-${slugify(b.data.text)}-${b.idx}`,
      text: b.data.text.replace(/<[^>]+>/g, ""),
      level: b.data.level,
    }));
}

/* ── Block renderer ───────────────────────────────── */

function renderBlock(block, i) {
  const { type, data } = block;

  if (type === "header") {
    const Tag = `h${data.level}`;
    const id = `h-${slugify(data.text)}-${i}`;
    return <Tag key={i} id={id} className="formatting-header" dangerouslySetInnerHTML={{ __html: data.text }} />;
  }

  if (type === "paragraph")
    return <p key={i} className="formatting-paragraph" dangerouslySetInnerHTML={{ __html: data.text }} />;

  if (type === "list") {
    const ordered = data.style === "ordered";
    const Tag = ordered ? "ol" : "ul";
    const cls = ordered ? "formatting-list-ordered" : "formatting-list-unordered";
    const itemText = (item) => (typeof item === "string" ? item : item?.content ?? "");
    return (
      <Tag key={i} className={cls}>
        {data.items.map((item, j) => (
          <li key={j} dangerouslySetInnerHTML={{ __html: itemText(item) }} />
        ))}
      </Tag>
    );
  }

  if (type === "checklist")
    return (
      <ul key={i} className="formatting-checklist">
        {data.items.map((item, j) => (
          <li key={j} className={`formatting-checklist-item${item.checked ? " checked" : ""}`}>
            <input type="checkbox" checked={item.checked} readOnly />
            <span dangerouslySetInnerHTML={{ __html: item.text }} />
          </li>
        ))}
      </ul>
    );

  if (type === "quote")
    return (
      <blockquote key={i} className="formatting-quote">
        <p dangerouslySetInnerHTML={{ __html: data.text }} />
        {data.caption && <cite>{data.caption}</cite>}
      </blockquote>
    );

  if (type === "code")
    return <pre key={i} className="formatting-code"><code>{data.code}</code></pre>;

  if (type === "delimiter")
    return <hr key={i} className="formatting-delimiter" />;

  if (type === "warning")
    return (
      <div key={i} role="alert" className="formatting-warning">
        {data.title && <strong dangerouslySetInnerHTML={{ __html: data.title }} />}
        <p dangerouslySetInnerHTML={{ __html: data.message }} />
      </div>
    );

  if (type === "alert")
    return (
      <div key={i} role="alert"
        className={`formatting-alert formatting-alert--${data.type ?? "info"}`}
        style={{ textAlign: data.align ?? "left" }}
        dangerouslySetInnerHTML={{ __html: data.message }} />
    );

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
            <tr key={j}>{row.map((cell, k) => <td key={k} dangerouslySetInnerHTML={{ __html: cell }} />)}</tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === "embed")
    return (
      <figure key={i} className="embed-block">
        <iframe src={data.embed} width={data.width} height={data.height} allowFullScreen title={data.caption ?? "Embedded content"} />
        {data.caption && <figcaption>{data.caption}</figcaption>}
      </figure>
    );

  if (type === "simpleImage")
    return (
      <figure key={i} className="image-block">
        <img src={data.url} alt={data.caption ?? ""} />
        {data.caption && <figcaption>{data.caption}</figcaption>}
      </figure>
    );

  if (type === "raw")
    return <div key={i} className="formatting-raw" dangerouslySetInnerHTML={{ __html: data.html }} />;

  return null;
}

/* ── Page ─────────────────────────────────────────── */

export default async function ArticlePage({ params }) {
  const { articleId } = await params;
  const apiUrl = _API;

  let article = null;
  let fetchError = null;

  try {
    const res = await fetch(`${apiUrl}/api/v1/get-article/${articleId}`, { next: { revalidate: 30 } });
    const data = await res.json().catch(() => null);
    if (!res.ok) fetchError = data?.detail ?? `Failed to fetch article (${res.status})`;
    else article = data?.article?.[0] ?? null;
  } catch (err) {
    fetchError = err?.message ?? String(err);
  }

  if (fetchError) return <p role="alert" style={{ padding: "2rem" }}>Error: {fetchError}</p>;
  if (!article) return <p style={{ padding: "2rem" }}>Article not found.</p>;

  let blocks = null;
  let rawContent = null;
  try {
    blocks = JSON.parse(article.content)?.blocks ?? [];
  } catch {
    rawContent = article.content;
  }

  const headings = extractHeadings(blocks);
  const wordCount = countWords(blocks);
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const dateStr = article.created_date
    ? new Date(article.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  const authorDisplay = article.author_name ?? article.author_email ?? "Unknown";
  const authorInitials = authorDisplay.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const settings = await _fetchSiteSettings();
  const siteUrl = settings?.site_url || _APP_URL;
  const canonicalUrl = `${siteUrl}/article/${articleId}`;
  const firstParaText = _firstParagraphText(blocks);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title || "Untitled",
    description: firstParaText,
    author: { "@type": "Person", name: authorDisplay },
    datePublished: article.created_date ?? undefined,
    url: canonicalUrl,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ReadingProgress />

      <div className="article-shell">
        {/* Left — Table of contents */}
        <TableOfContents headings={headings} wordCount={wordCount} createdDate={article.created_date} />

        {/* Centre — Article body */}
        <article className="article-body">
          <div className="article-eyebrow">Essay</div>
          <h1 className="article-title">{article.title || "(Untitled)"}</h1>

          {/* Byline */}
          <div className="byline">
            <div className="avatar lg">{authorInitials}</div>
            <div className="byline-text">
              <span className="byline-name">{authorDisplay}</span>
              <div className="byline-meta">
                {dateStr && <span>{dateStr}</span>}
                {dateStr && <span className="dot-sep" />}
                <span>{readTime} min read</span>
                {wordCount > 0 && (
                  <>
                    <span className="dot-sep" />
                    <span>{wordCount.toLocaleString()} words</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Content blocks */}
          {blocks ? blocks.map((block, i) => renderBlock(block, i)) : <pre>{rawContent}</pre>}

          {/* Reactions + comments */}
          <ArticleInteractions
            articleId={articleId}
            authorEmail={article.author_email ?? null}
            blocks={blocks}
            createdDate={article.created_date ?? null}
            hideByline={true}
          />
        </article>

        {/* Right — Action rail */}
        <aside className="article-rail">
          <BookmarkRailButton />
          <ShareRailButton />
          <div className="rail-divider" />
          <div className="rail-read">{readTime}<br />MIN</div>
        </aside>
      </div>
    </>
  );
}
