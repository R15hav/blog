"use client";
import { useState } from "react";

export default function BookmarkRailButton() {
  const [saved, setSaved] = useState(false);
  return (
    <button
      className="rail-btn"
      aria-label={saved ? "Bookmarked" : "Bookmark"}
      title={saved ? "Bookmarked" : "Bookmark"}
      onClick={() => setSaved((v) => !v)}
      style={saved ? { borderColor: "var(--accent)", color: "var(--accent-ink)" } : {}}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
