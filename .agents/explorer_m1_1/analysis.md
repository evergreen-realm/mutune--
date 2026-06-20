# Analysis: Vercel Production Deployment Gap & Pipeline Setup

## Executive Summary
The production URL (https://mutunerent-web-mishael-s-alpha.vercel.app/) is not serving the latest local codebase (commit 1384261) due to two major integration issues:
1. **Directory Mismatch in GitHub Actions**: The Vercel CLI commands in `.github/workflows/deploy.yml` are executed from within the `frontend/` subdirectory instead of the repository root. Since the Vercel project settings on the dashboard has `rootDirectory: "frontend"`, this subdirectory execution causes Vercel CLI to search for `frontend/frontend` or output files in misaligned paths, causing the deployment to fail or deploy outdated build outputs.
2. **Environment Variable Overrides**: The pulled `.env.production.local` contains `VITE_API_URL=""`, which overrides the environment variables provided in the GitHub Actions runner step's environment block. This leads to broken API requests even if the frontend deploys.

---

## Detailed Observations

### 1. Vercel Configuration Discrepancy
There are two `.vercel` configuration directories in the project:
* **Repository Root (`.vercel/project.json`)**:
  ```json
  {
    "projectId": "prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt",
    "orgId": "team_R6Kqhq8YeE61SwWGEdZ9vUJI",
    "projectName": "mutunerent-web",
    "settings": {
      "framework": "vite",
      "rootDirectory": "frontend",
      ...
    }
  }
  ```
* **Frontend Directory (`frontend/.vercel/project.json`)**:
  ```json
  {
    "projectId": "prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt",
    "orgId": "team_R6Kqhq8YeE61SwWGEdZ9vUJI",
    "projectName": "mutunerent-web",
    "settings": {
      "rootDirectory": null,
      ...
    }
  }
  ```

### 2. GitHub Actions Deployment Script Breakdown
In `.github/workflows/deploy.yml` under `deploy-frontend` job:
```yaml
      # Pull Vercel project settings (does NOT overwrite .env.production)
      - name: Pull Vercel project settings
        run: cd frontend && vercel pull --yes --environment production --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      # Copy Vercel env to root so Vite loads them during local/CI build
      - name: Copy Vercel env to root
        run: cp frontend/.vercel/.env.production.local frontend/.env.production.local

      # Build locally — uses committed frontend/.env.production for VITE_* vars
      - name: Build with Vercel
        run: cd frontend && vercel build --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
        ...
      # Deploy prebuilt output — no remote build, no dashboard env var override
      - name: Deploy prebuilt to Vercel
        run: cd frontend && vercel deploy --prebuilt --prod --yes --no-wait --token=${{ secrets.VERCEL_TOKEN }}
```

**Issues with this configuration**:
1. Running `vercel pull` and `vercel build` inside `frontend/` while the Vercel remote dashboard has `rootDirectory: "frontend"` causes a mismatch. In a monorepo, Vercel CLI commands should be executed from the **repository root**. Executing from the root makes Vercel CLI read the root `.vercel/project.json`, recognize `"rootDirectory": "frontend"`, execute the build inside the `frontend` folder, and write the build output to `.vercel/output` in the root.
2. In the current setup, `vercel build` inside `frontend/` output files go into `frontend/.vercel/output` (or fail completely), whereas the next step is expecting a successful prebuilt structure.
3. The pulled `.env.production.local` defines `VITE_API_URL=""`. During `vercel build`, Vercel CLI injects this value, overriding the shell environment variable `VITE_API_URL` set in the GitHub Actions file, rendering the app unable to connect to the backend API.

---

## Fix Strategy

To resolve the deployment gap and ensure robust auto-deploys:

### Step 1: Align Environment Variables on Vercel
1. Go to the Vercel Dashboard -> `mutunerent-web` Project -> Settings -> Environment Variables.
2. Add/update the following environment variables for the Production environment:
   * `VITE_API_URL` = `https://mutunerent-api.onrender.com/api/v1`
   * `VITE_CLERK_PUBLISHABLE_KEY` = `pk_test_Y29zbWljLWtvYWxhLTgwLmNsZXJrLmFjY291bnRzLmRldiQ`

### Step 2: Refactor GitHub Actions Deployment Workflow
Modify `.github/workflows/deploy.yml` to run Vercel CLI commands from the repository root. This aligns with standard Vercel monorepo practices:

```yaml
  deploy-frontend:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install Vercel CLI
        run: npm install --global vercel@latest
      - name: Install frontend deps
        run: cd frontend && npm install --legacy-peer-deps

      # Pull Vercel project settings at repo root
      - name: Pull Vercel project settings
        run: vercel pull --yes --environment production --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      # Copy Vercel env to frontend directory so Vite loads them
      - name: Copy Vercel env to frontend
        run: cp .vercel/.env.production.local frontend/.env.production.local

      # Build at repo root (uses root .vercel/project.json which defines rootDirectory: frontend)
      - name: Build with Vercel
        run: vercel build --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VITE_API_URL: https://mutunerent-api.onrender.com/api/v1
          VITE_CLERK_PUBLISHABLE_KEY: pk_test_Y29zbWljLWtvYWxhLTgwLmNsZXJrLmFjY291bnRzLmRldiQ

      # Deploy prebuilt output from repo root
      - name: Deploy prebuilt to Vercel
        run: vercel deploy --prebuilt --prod --yes --no-wait --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Step 3: Avoid Deployment Overlaps
Ensure Vercel's automatic Git Integration does not deploy untested code on every commit push. 
1. In Vercel Project Settings -> Git -> Ignored Builds Step.
2. Set the command to: `[[ "$VERCEL_ENV" == "production" ]] && exit 0 || exit 1`
This prevents Vercel Git Integration from deploying `main` automatically, forcing all production deployments to flow through GitHub Actions (which runs tests and linting first).

### Step 4: Verification of JS Hash Changes
Once the deployment executes:
1. Note the hash of the main JS bundle in the local build output under `frontend/dist/assets/index-[hash].js` or `.vercel/output/static/assets/index-[hash].js`.
2. Inspect the production HTML:
   `curl -s https://mutunerent-web-mishael-s-alpha.vercel.app/ | grep -oE "index-[a-zA-Z0-9_-]+\.js"`
3. Confirm that the hash served on the production URL matches the hash of the newly built local/CI JS bundle.
