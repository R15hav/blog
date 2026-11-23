// Verifies that the bundled theme (public/themes/default.css) restates exactly
// the built-in CSS variables, and that the three route-group globals.css files
// agree with each other. Dependency-free; run from frontend/ via
// `npm run check:theme`.
//
// Only the first `:root { ... }` block of each file is read. Values contain no
// `;`, `{` or `}`, so simple string parsing is sufficient.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const norm = (s) => s.trim().replace(/\s+/g, " ");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/^﻿/, "");
}

function extractRoot(css, label) {
  const text = stripComments(css);
  const m = /:root\s*\{/.exec(text);
  if (!m) {
    errors.push(`${label}: no :root { ... } block found`);
    return null;
  }
  const bodyStart = m.index + m[0].length;
  const close = text.indexOf("}", bodyStart);
  if (close === -1) {
    errors.push(`${label}: no :root { ... } block found (missing closing brace)`);
    return null;
  }
  return {
    text,
    body: text.slice(bodyStart, close),
    start: m.index,
    end: close + 1,
  };
}

function parseDecls(body, label) {
  const map = new Map();
  for (const raw of body.split(";")) {
    const piece = raw.trim();
    if (!piece) continue;
    const m = /^(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+)$/.exec(piece);
    if (!m) {
      errors.push(`${label}: unexpected content in :root: "${norm(piece)}"`);
      continue;
    }
    if (map.has(m[1])) {
      errors.push(`${label}: duplicate variable ${m[1]}`);
      continue;
    }
    map.set(m[1], norm(m[2]));
  }
  return map;
}

function load(rel, label) {
  const css = read(rel);
  const r = extractRoot(css, label);
  return { css, root: r, map: r ? parseDecls(r.body, label) : new Map() };
}

const blog = load("app/(blog)/globals.css", "(blog)/globals.css");
const globals = [
  ["(auth)", load("app/(auth)/globals.css", "(auth)/globals.css")],
  ["(admin)", load("app/(admin)/globals.css", "(admin)/globals.css")],
];

// (a) the three globals.css files must agree.
for (const [name, g] of globals) {
  const missing = [...blog.map.keys()].filter((k) => !g.map.has(k));
  const extra = [...g.map.keys()].filter((k) => !blog.map.has(k));
  if (missing.length) {
    errors.push(`globals.css files differ: ${name} is missing ${missing.join(", ")}`);
  }
  if (extra.length) {
    errors.push(`globals.css files differ: ${name} has extra ${extra.join(", ")}`);
  }
  for (const [k, v] of g.map) {
    if (blog.map.has(k) && blog.map.get(k) !== v) {
      errors.push(
        `globals.css files differ: ${k} is "${blog.map.get(k)}" in (blog) but "${v}" in ${name}`,
      );
    }
  }
}

const theme = load("public/themes/default.css", "default.css");

// (b) names
{
  const missing = [...blog.map.keys()].filter((k) => !theme.map.has(k));
  const extra = [...theme.map.keys()].filter((k) => !blog.map.has(k));
  if (missing.length) errors.push(`default.css is missing variables: ${missing.join(", ")}`);
  if (extra.length) errors.push(`default.css has extra variables: ${extra.join(", ")}`);
}

// (c) values
for (const [k, v] of theme.map) {
  if (blog.map.has(k) && blog.map.get(k) !== v) {
    errors.push(`default.css value differs for ${k}: expected "${blog.map.get(k)}", got "${v}"`);
  }
  if (/!important/i.test(v)) {
    errors.push(`default.css: ${k} must not use !important`);
  }
}

// (d) nothing but @charset, comments and the single :root block
if (theme.root) {
  const before = theme.root.text.slice(0, theme.root.start).replace(/^\s*@charset\s+"[^"]*"\s*;/, "");
  const after = theme.root.text.slice(theme.root.end);
  for (const rest of [before, after]) {
    if (rest.trim()) {
      errors.push(
        `default.css must contain only @charset, comments and one :root block; found extra content: "${norm(rest).slice(0, 80)}"`,
      );
    }
  }
}

if (errors.length) {
  console.error("Theme variable check failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`theme variables OK (${blog.map.size})`);
}
