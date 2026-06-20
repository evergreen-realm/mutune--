# Handoff Report: Milestone 1 - Vercel Production Deployment Gap & Pipeline Setup

## 1. Observation
* **Repository configuration files:**
  * **Root `.vercel/project.json`** contains:
    ```json
    "projectName": "mutunerent-web",
    "settings": {
      "framework": "vite",
      "rootDirectory": "frontend",
      ...
    }
    ```
  * **Frontend `frontend/.vercel/project.json`** contains:
    ```json
    "projectName": "mutunerent-web",
    "settings": {
      "rootDirectory": null,
      ...
    }
    ```
  * **Frontend `frontend/.env.production.local`** (pulled environment variable overrides) contains:
    ```bash
    VITE_API_URL=""
    VITE_CLERK_PUBLISHABLE_KEY="pk_test_Y29zbWljLWtvYWxhLTgwLmNsZXJrLmFjY291bnRzLmRldiQ"
    ```
  * **GitHub Actions Workflow `.github/workflows/deploy.yml`** steps for Vercel CLI execution:
    ```yaml
    - name: Pull Vercel project settings
      run: cd frontend && vercel pull --yes --environment production --token=${{ secrets.VERCEL_TOKEN }}
    ...
    - name: Build with Vercel
      run: cd frontend && vercel build --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
    ...
    - name: Deploy prebuilt to Vercel
      run: cd frontend && vercel deploy --prebuilt --prod --yes --no-wait --token=${{ secrets.VERCEL_TOKEN }}
    ```

---

## 2. Logic Chain
1. The GitHub Actions configuration executes Vercel CLI commands inside the `frontend/` subdirectory (`run: cd frontend && vercel ...`).
2. When `vercel pull` runs inside `frontend/`, it creates `frontend/.vercel/project.json` with configuration from Vercel's API.
3. If the Vercel dashboard is set up with `rootDirectory: "frontend"`, running `vercel build` inside `frontend/` causes Vercel CLI to search for the source code at `frontend/frontend/`. This fails because the path doesn't exist, preventing a successful output from being created at `frontend/.vercel/output`.
4. As a result, the subsequent prebuilt deployment step `vercel deploy --prebuilt` either fails or deploys an old/empty version of the directory, explaining why the latest codebase changes (like commit `1384261`) are not reflected in production.
5. In addition, Vercel CLI injects the pulled environment variables (`VITE_API_URL=""` from `frontend/.env.production.local`) into the build command, overriding any process/shell variables set in the action step's `env` section. This breaks backend connectivity by building the app with an empty base API URL.

---

## 3. Caveats
* Since this is a read-only investigation with restricted internet access, we cannot:
  * Inspect the build logs or run history of GitHub Actions or the Vercel Dashboard directly.
  * Check the current environment variables set in the Vercel project settings UI.
  * Confirm whether the Vercel Git Integration is currently active and failing or disabled.
* We assume that `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets are correctly set on GitHub.

---

## 4. Conclusion
The production deployment gap is caused by:
1. Directory execution mismatches for Vercel CLI in `.github/workflows/deploy.yml` (running from `frontend` instead of the monorepo root).
2. Environment variable overrides where `VITE_API_URL=""` is pulled from the dashboard and overrides pipeline variables.

The strategy to fix this is:
* Align Vercel dashboard environment variables (`VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY`).
* Refactor `.github/workflows/deploy.yml` to run Vercel CLI commands (`pull`, `build`, `deploy`) from the repository root.
* Ensure Git Integration build step rules in Vercel ignore automatic builds for `production` branch to ensure only CI-tested builds from GitHub Actions are deployed.

---

## 5. Verification Method
1. Inspect `.github/workflows/deploy.yml` to ensure all `cd frontend` commands have been removed from the Vercel CLI steps.
2. Trigger the GitHub Action by pushing a commit or manually running `workflow_dispatch`.
3. Check the hash of the main built JS bundle file in the output (e.g. `dist/assets/index-[hash].js`).
4. Retrieve the index.html from the production URL:
   `curl -s https://mutunerent-web-mishael-s-alpha.vercel.app/ | grep -oE "index-[a-zA-Z0-9_-]+\.js"`
5. Confirm the hashes match.
