"use client";
import { useEffect, useState } from "react";

export default function TableOfContents({ headings = [], wordCount = 0, createdDate = null }) {
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return <aside className="article-toc" />;

  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const dateStr = createdDate
    ? new Date(createdDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <aside className="article-toc">
      <h6>In this essay</h6>
      <ol>
        {headings.map((h) => (
          <li
            key={h.id}
            className={[activeId === h.id ? "active" : "", h.level >= 3 ? "sub" : ""].filter(Boolean).join(" ")}
            onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" })}
          >
            {h.text}
          </li>
        ))}
      </ol>
      <div className="toc-footer">
        <span className="meta-mono" style={{ display: "block", marginBottom: 5 }}>
          {readTime} MIN · {wordCount.toLocaleString()} WORDS
        </span>
        {dateStr && <span>Posted {dateStr}.</span>}
      </div>
    </aside>
  );
}
