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

  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const dateStr = createdDate
    ? new Date(createdDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <aside className="article-toc">
      {headings.length > 0 && (
        <div className="toc-wrap">
          <div className="toc-tab" aria-label="Table of contents">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </div>
          <div className="toc-panel">
            <p className="toc-panel-title">In this essay</p>
            <ol className="toc-list">
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
              <span style={{ display: "block", marginBottom: 3, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {readTime} min · {wordCount.toLocaleString()} words
              </span>
              {dateStr && <span>Posted {dateStr}</span>}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
