# Milestone 1 Investigation: Vercel Production Deployment Gap & Pipeline Setup

## Executive Summary
This analysis details the root causes of the production deployment gap where the live URL (`https://mutunerent-web-mishael-s-alpha.vercel.app/`) serves an outdated build (hash `DCIl0FOU`) instead of the latest local codebase (hash `B_YQToRT`, commit `1384261`). The investigation identified a mismatch between remote and local configuration settings and an invalid Vercel deployment token as the primary obstacles.

---

## 1. Vercel CLI Version
- **Exact Version**: `Vercel CLI 54.11.1` (Node.js 24.15.0)
- **Local Authentication Scope**: Authenticated as `evergreen-realm` with access to scope `mishael-s-alpha` (personal account/projects).

---

## 2. Configuration Settings Analysis

### A. Local Configuration Files
1. **`frontend/vercel.json`**:
   Configured for a Vite application inside a subfolder, mapping all traffic to `index.html` and setting custom long-term cache headers for assets:
   ```json
   {
     "version": 2,
     "framework": "vite",
     "installCommand": "npm install --legacy-peer-deps",
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ],
     "headers": [
       {
         "source": "/assets/(.*)",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
         ]
       }
     ]
   }
   ```

2. **`.vercel/project.json` (Workspace Root)**:
   Links the project to the Vercel project `mutunerent-web` with `rootDirectory` correctly set to `"frontend"`:
   ```json
   {
     "projectId": "prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt",
     "orgId": "team_R6Kqhq8YeE61SwWGEdZ9vUJI",
     "projectName": "mutunerent-web",
     "settings": {
       "framework": "vite",
       "devCommand": "npm run dev",
       "installCommand": "npm install --legacy-peer-deps",
       "buildCommand": "npm run build",
       "outputDirectory": "dist",
       "rootDirectory": "frontend",
       "directoryListing": false,
       "nodeVersion": "22.x"
     }
   }
   ```

3. **`frontend/.vercel/project.json` (Frontend Directory)**:
   Links to the same project, but contains `rootDirectory: null` (since it is already run from the target subfolder):
   ```json
   {
     "projectId": "prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt",
     "orgId": "team_R6Kqhq8YeE61SwWGEdZ9vUJI",
     "projectName": "mutunerent-web",
     "settings": {
       "createdAt": 1781091050571,
       "framework": "vite",
       "devCommand": "npm run dev",
       "installCommand": "npm install --legacy-peer-deps",
       "buildCommand": "npm run build",
       "outputDirectory": "dist",
       "rootDirectory": null,
       "directoryListing": false,
       "nodeVersion": "22.x"
     }
   }
   ```

### B. Remote Vercel Project Settings (Via CLI)
Running `npx vercel project inspect` reveals that the remote project settings are misconfigured:
- **Root Directory**: `.` (the default root of the git repository)
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install --legacy-peer-deps`

### C. Mismatch and Failure Modes
1. **Vercel Git Integration Failure**: Since Vercel's remote settings have `Root Directory` set to `.`, the automated Vercel Git integration attempts to build the project from the root folder. However, the root folder of the repository lacks a `package.json` and build scripts, causing automatic deployments on git pushes to fail or deploy empty/outdated assets.
2. **Invalid Token**: The Vercel token used in `scripts/set-github-secrets.mjs` and GitHub secrets (`vcp_73R6...`) is invalid, causing the `.github/workflows/deploy.yml` pipeline (which runs `vercel pull` and `vercel build`) to fail with authentication errors:
   `Error: The token provided via --token argument is not valid.`
3. **Manual vs Pipeline Deployments**: Running `npx vercel --prod --yes` from the `frontend/` directory (like `scripts/deploy.js` does) succeeds locally because the local developer has a valid authenticated CLI session. However, the CI/CD pipeline and Git integration fail, leading to the deployment gap.

---

## 3. Frontend Hash Comparison
- **Deployed JS Bundle Hash**: `DCIl0FOU` (referenced via `index-DCIl0FOU.js` on production).
- **Local JS Bundle Hash**: `B_YQToRT` (referenced via `index-B_YQToRT.js` in local `dist/index.html` and `dist/assets/`).
- **Conclusion**: The production deployment is running an older build that does not match the latest local commit `1384261`.

---

## 4. Fix Strategy

### Step 1: Update Remote Vercel Settings
Update the Vercel project's "Root Directory" to `frontend` in the Vercel Dashboard project settings.
- This ensures Vercel's Git integration knows to change directory into `frontend/` before installing dependencies and building.

### Step 2: Rotate and Update Vercel Token
1. Generate a new, valid Vercel Personal Access Token or Team Token from the Vercel Dashboard.
2. Update the `VERCEL_TOKEN` secret in GitHub Actions secrets.
3. Update the hardcoded token in `scripts/set-github-secrets.mjs` to prevent future token resets using invalid credentials.

### Step 3: Trigger a Fresh Production Build
1. Force a manual production deployment from the `frontend/` directory to close the gap immediately:
   ```powershell
   cd frontend
   npx vercel --prod --yes
   ```
2. Verify that the production URL now serves the latest build with the local hash (e.g., `index-B_YQToRT.js` or the hash generated from the fresh build).

### Step 4: Verify the GitHub Actions Pipeline
Push a minor change (or run the workflow manually via `workflow_dispatch`) to verify that the CI/CD pipeline successfully executes `vercel pull`, `vercel build`, and `vercel deploy --prebuilt`.
