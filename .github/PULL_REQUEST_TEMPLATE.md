<!--
Thanks for opening a PR! Please fill in the sections below.
The "How to test" section is the single most useful one — please don't skip it.
-->

## Summary

<!-- What changed, in 1–3 sentences. -->

## Why

<!-- Motivation. Link the issue if there is one: "Closes #123" / "Refs #123". -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behaviour change)
- [ ] Docs
- [ ] Build / CI / tooling

## Testing

- [ ] Tested locally (steps below)
- [ ] `cd frontend && npm run lint` passes
- [ ] `cd backend && uv run alembic upgrade head` applies cleanly on a fresh DB
- [ ] For UI changes: clicked through the affected pages in a browser

### How to test

<!--
Step-by-step click path or curl commands a reviewer can run locally.
Be specific: "GET /api/v1/articles?published=true should return only published rows" beats "test the article list".
-->

## Screenshots / recordings

<!-- For any UI change. Drag-and-drop images here. -->

## Breaking changes

<!-- "None" or describe what callers / operators need to update. -->

## Checklist

- [ ] Code follows existing patterns (route → service → db, ownership rechecked in services, etc.)
- [ ] Updated docs (`/user-manual/` or `CLAUDE.md`) if behaviour changed
- [ ] No secrets, credentials, or `.env` files committed
- [ ] Migration written for any schema change (and tested against both SQLite and Postgres)
