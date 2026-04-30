"use client";

import BackButton from "../../components/BackButton";

export default function AuthNav() {
  return (
    <nav>
      <BackButton />
      {" | "}
      <a className="nav-home" href="/">Home</a>
    </nav>
  );
}
