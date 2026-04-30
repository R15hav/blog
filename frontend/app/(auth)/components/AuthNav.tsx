"use client";

import BackButton from "../../components/BackButton";

export default function AuthNav({ siteName = "Blog" }: { siteName?: string }) {
  const initial = siteName.trim()[0]?.toUpperCase() ?? "B";
  return (
    <nav>
      <BackButton />
      {" | "}
      <a className="nav-home" href="/" data-initial={initial}>{siteName}</a>
    </nav>
  );
}
