"use client";
import { useState } from "react";

export default function ShareRailButton() {
  const [msg, setMsg] = useState("");

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMsg("Copied!");
    } catch {
      setMsg("Error");
    }
    setTimeout(() => setMsg(""), 2000);
  }

  return (
    <button className="rail-btn" aria-label="Share" title="Share" onClick={handleShare}>
      {msg ? (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{msg}</span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
    </button>
  );
}
