# Deploying the User Manual to GitHub Pages

The `user-manual/` site is plain HTML/CSS/JS — no build step required. GitHub Pages serves it directly from the repository using a GitHub Actions workflow.

Once deployed, the site is available at:

```
https://r15hav.github.io/blog/
```

---

## Step 1 — Create the GitHub Actions workflow

Create the file `.github/workflows/deploy-docs.yml` in the **repository root** (not inside `user-manual/`):

```yaml
name: Deploy user-manual to GitHub Pages

on:
  push:
    branches:
      - master
    paths:
      - "user-manual/**"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: user-manual

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

> **What this does:** on every push to `master` that touches a file inside `user-manual/`, GitHub uploads that folder as a Pages artifact and deploys it. The `workflow_dispatch` trigger lets you also deploy manually from the Actions tab.

---

## Step 2 — Enable GitHub Pages in the repository settings

1. Go to your repository on GitHub: `https://github.com/R15hav/blog`
2. Click **Settings** → scroll to **Pages** in the left sidebar.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Click **Save**.

> You do **not** need to pick a branch or folder here — the workflow handles publishing via the `actions/deploy-pages` action.

---

## Step 3 — Commit and push the workflow file

```bash
git add .github/workflows/deploy-docs.yml
git commit -m "ci: add GitHub Pages deploy workflow for user-manual"
git push origin master
```

GitHub Actions will trigger automatically. Watch the run at:

```
https://github.com/R15hav/blog/actions
```

---

## Step 4 — Verify the deployment

1. Go to **Settings → Pages** in your repository.
2. Once the workflow completes, a green banner shows the live URL:
   ```
   https://r15hav.github.io/blog/
   ```
3. Open the URL. You should see the marketing landing page (`index.html`).
4. Navigate to `/blog/guide.html` for the user manual.

> **First deploy takes ~1–2 minutes.** Subsequent pushes are faster.

---

## Updating the site

Any push to `master` that modifies a file inside `user-manual/` triggers an automatic redeploy. There is nothing else to do — edit the HTML/CSS/JS files, commit, and push.

To trigger a manual redeploy without changing files:

1. Go to **Actions → Deploy user-manual to GitHub Pages**.
2. Click **Run workflow** → **Run workflow**.

---

## Custom domain (optional)

1. In **Settings → Pages**, enter your domain under **Custom domain** and click **Save**.
2. Add a `CNAME` file inside `user-manual/` containing only your domain:

   ```
   docs.yourdomain.com
   ```

3. At your DNS provider, add a `CNAME` record pointing to `r15hav.github.io`.
4. Wait for DNS propagation (~5–30 minutes), then enable **Enforce HTTPS** in the Pages settings.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Workflow fails with `pages not enabled` | Complete Step 2 — set Pages source to **GitHub Actions** |
| 404 on the live URL | Check the workflow completed successfully in the **Actions** tab |
| CSS / JS not loading | All paths in HTML are relative (`style.css`, `script.js`) — they work as-is |
| Changes not showing after push | Hard-refresh the browser (`Ctrl+Shift+R`) to bypass cached assets |
| Workflow not triggering | Confirm you pushed to `master` (not a feature branch) and the file is under `user-manual/` |
