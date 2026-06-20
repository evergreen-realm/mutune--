# Milestone 1 Analysis: Vercel Production Deployment Gap & Pipeline Setup

## Executive Summary
The Vercel production deployment gap is caused by a structural mismatch between the local deployment script (`scripts/deploy.js`) and Vercel's remote project configuration (`rootDirectory: "frontend"`). Running `npx vercel --prod` from the `frontend/` directory uploads only its contents, which causes the remote build to fail immediately because it expects a `frontend/` subdirectory; additionally, environment variable overrides from Vercel override the API endpoint configuration during builds.

---

## Root Cause Analysis

### 1. Root Directory Configuration Conflict
There is a conflict between where Vercel CLI commands are executed and how the project is configured on Vercel:
* **Root Configuration** (`.vercel/project.json`): Specifies `"rootDirectory": "frontend"`.
* **Frontend Configuration** (`frontend/.vercel/project.json`): Specifies `"rootDirectory": null`.
* **Vercel Dashboard Setting**: Configured with `"rootDirectory": "frontend"`.

When a developer runs `scripts/deploy.js` locally, the script runs `npx vercel --prod --yes` inside `frontend/`. This uploads only the contents of the `frontend/` directory as the deployment root. On Vercel, the builder reads the dashboard setting (`rootDirectory: "frontend"`) and searches for a `frontend/` subdirectory inside the upload. Since it does not exist, the remote build fails immediately (typically in ~6 seconds).

### 2. Pipeline Deployment Mismatch (Prebuilt vs Remote Build)
* **Local Deploy Script** (`scripts/deploy.js`): Uses a remote-build strategy by running `npx vercel --prod` directly. This requires Vercel's remote builders to successfully compile the app.
* **CI/CD Pipeline** (`.github/workflows/deploy.yml`): Uses a local prebuilt strategy:
  1. `vercel pull` inside `frontend/` (creates `.vercel/project.json` with `"rootDirectory": null` and downloads environment variables).
  2. `vercel build --prod` inside `frontend/` (compiles the app locally to `frontend/.vercel/output`).
  3. `vercel deploy --prebuilt --prod` (uploads the compiled output directly, bypassing Vercel's remote builders).

Because the CI pipeline uses a prebuilt deploy, it succeeds. However, because local deployments use the remote-build strategy from the wrong directory, local changes cannot be pushed directly via the script.

### 3. Environment Variable Configuration Drift
During the CI/CD pipeline:
1. `vercel pull` downloads the project environment variables from the Vercel Dashboard and writes them to `frontend/.vercel/.env.production.local`.
2. In the Vercel Dashboard, `VITE_API_URL` is set to `""` (empty string).
3. The workflow copies `frontend/.vercel/.env.production.local` to `frontend/.env.production.local`.
4. Vite loads `.env.production.local` with higher priority than `.env.production`.
5. Consequently, the build compiles with `VITE_API_URL=""`. The application only works because of a fallback logic in `frontend/src/lib/api.js` (`const API_BASE = import.meta.env.VITE_API_URL || 'https://mutunerent-api.onrender.com/api/v1'`). If the fallback was absent or if staging variables were required, the build would fail or break.

---

## Detailed Evidence

### File: `c:\Users\Admin\Desktop\mutune\.vercel\project.json`
```json
{
  "projectId": "prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt",
  "orgId": "team_R6Kqhq8YeE61SwWGEdZ9vUJI",
  "projectName": "mutunerent-web",
  "settings": {
    "framework": "vite",
    ...
    "rootDirectory": "frontend",
    ...
  }
}
```

### File: `c:\Users\Admin\Desktop\mutune\frontend\.vercel\project.json`
```json
{
  "projectId": "prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt",
  "orgId": "team_R6Kqhq8YeE61SwWGEdZ9vUJI",
  "projectName": "mutunerent-web",
  "settings": {
    ...
    "rootDirectory": null,
    ...
  }
}
```

### File: `frontend/.vercel/.env.production.local` (Pulled Vercel Environment)
```
VITE_API_URL=""
VITE_CLERK_PUBLISHABLE_KEY="pk_test_Y29zbWljLWtvYWxhLTgwLmNsZXJrLmFjY291bnRzLmRldiQ"
```

### Local Deploy Script (`scripts/deploy.js` lines 55-63)
```javascript
function deployFrontend() {
  console.log('\n🚀 Deploying frontend to Vercel...');
  try {
    execSync('npx vercel --prod --yes', { cwd: path.join(__dirname, '../frontend') });
    console.log('✅ Frontend deployed');
  } catch (e) {
    console.error('❌ Frontend deploy failed:', e.message);
  }
}
```

---

## Fix Strategy

To resolve the deployment gap and unify the local and CI/CD pipelines, the following changes are proposed:

### 1. Align Vercel CLI Commands to the Repository Root
All Vercel commands (local and CI) should run from the repository root instead of the `frontend/` subdirectory. This ensures that the root `.vercel/project.json` configuration (which has `"rootDirectory": "frontend"`) is consistently used, and the uploaded directory contains the expected subdirectory structure.

* **Modify `.github/workflows/deploy.yml`**:
  * Change `cd frontend && vercel pull` to `vercel pull --yes --environment production`
  * Remove the copy command `cp frontend/.vercel/.env.production.local frontend/.env.production.local` (Vercel CLI handles the env mapping during root-level build)
  * Change `cd frontend && vercel build` to `vercel build --prod`
  * Change `cd frontend && vercel deploy` to `vercel deploy --prebuilt --prod`

* **Modify `scripts/deploy.js`**:
  * Update the frontend deployment to use the prebuilt strategy from the root:
    ```javascript
    function deployFrontend() {
      console.log('\n🚀 Deploying frontend to Vercel...');
      try {
        execSync('npx vercel pull --yes --environment production', { cwd: path.join(__dirname, '..') });
        execSync('npx vercel build --prod --yes', { cwd: path.join(__dirname, '..') });
        execSync('npx vercel deploy --prebuilt --prod --yes', { cwd: path.join(__dirname, '..') });
        console.log('✅ Frontend deployed');
      } catch (e) {
        console.error('❌ Frontend deploy failed:', e.message);
      }
    }
    ```

### 2. Update Vercel Dashboard Environment Variables
* Configure `VITE_API_URL` on the Vercel Dashboard to the actual production Render API URL (`https://mutunerent-api.onrender.com/api/v1`) rather than leaving it empty. This removes the reliance on fallback logic in the codebase and prevents configuration drift.
