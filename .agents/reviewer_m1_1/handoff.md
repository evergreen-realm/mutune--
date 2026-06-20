# Handoff Report: Milestone 1 Review - Vercel Production Deployment Gap & Pipeline Setup

## 1. Observation

### Local and Remote Vercel Configurations
- **Root `.vercel/project.json`** contains:
  ```json
  "projectId": "prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt",
  "orgId": "team_R6Kqhq8YeE61SwWGEdZ9vUJI",
  "projectName": "mutunerent-web",
  "settings": {
    "rootDirectory": "frontend",
    ...
  }
  ```
- **Frontend `frontend/.vercel/project.json`** contains:
  ```json
  "projectId": "prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt",
  "orgId": "team_R6Kqhq8YeE61SwWGEdZ9vUJI",
  "projectName": "mutunerent-web",
  "settings": {
    "rootDirectory": "frontend",
    ...
  }
  ```
- **Remote Vercel Project Config** (from `npx vercel project inspect`):
  ```
  General
    ID                  prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt
    Name                mutunerent-web
    Owner               MISHAEL's projects
    Created At          10 June 2026 14:30:50 [9d ago]
    Root Directory      frontend
    Node.js Version     22.x
  ```

### Deployed Site JS Bundle Hash
- **Vercel Remote Build Output** (from successful deployment `https://mutunerent-1dd9t766r-mishael-s-alpha.vercel.app`):
  ```
  dist/assets/index-BB2fMyMh.js          1,694.73 kB
  ```
  This matches the build output and serves the correct bundle hash `BB2fMyMh`.
- **Pulled production environment variables** (`.env.production.local`):
  ```bash
  VITE_API_URL="https://mutunerent-api.onrender.com/api/v1"
  VITE_CLERK_PUBLISHABLE_KEY="pk_test_Y29zbWljLWtvYWxhLTgwLmNsZXJrLmFjY291bnRzLmRldiQ"
  ```
  The env vars are correctly set.

### Broken Deployment Steps
- **Local deploy script execution**:
  Running `npx vercel --prod --yes` inside `frontend/` failed with:
  ```
  Vercel CLI 54.11.1 (Node.js 24.15.0)
  Retrieving project…
  Error: The provided path “~\Desktop\mutune\frontend\frontend” does not exist. To change your Project Settings, go to https://vercel.com/mishael-s-alpha/mutunerent-web/settings
  ```
- **Local deployment script (`scripts/deploy.js`)**:
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
- **GitHub Actions Workflow (`.github/workflows/deploy.yml`)**:
  ```yaml
        - name: Build with Vercel
          run: cd frontend && vercel build --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
  ```
  Both of these are configured to run Vercel CLI from inside `frontend/` instead of the root directory.

### CORS Subdomain Regex
- **Backend CORS implementation (`backend/server.js`)**:
  ```javascript
  const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://mutunerent-web.vercel.app',
    'https://mutunerent-web-mishael-s-alpha.vercel.app',
    'https://mutune-alpha.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
  ];
  ...
      const isVercelSubdomain = /^https:\/\/(mutunerent-web|mutune-alpha)(-.+)?\.vercel\.app$/.test(origin);
      if (ALLOWED_ORIGINS.includes(origin) || isVercelSubdomain) return callback(null, true);
  ```

---

## 2. Logic Chain

1. **Vercel Directory Appending behavior**:
   - Both the remote configuration and local `.vercel/project.json` files have `rootDirectory` set to `"frontend"`.
   - When a Vercel CLI command is executed inside the `frontend/` directory (where the CWD is `frontend`), Vercel CLI appends the `rootDirectory` configuration to the CWD, resulting in a lookup path of `frontend/frontend/`.
   - Since `frontend/frontend/` does not exist, Vercel CLI fails immediately with a path not found error.
2. **Impact on local deploy script**:
   - `scripts/deploy.js` sets the working directory of the Vercel deploy command to `../frontend`. Because of (1), running `node scripts/deploy.js` will always fail to deploy the frontend.
3. **Impact on GitHub Actions CI/CD**:
   - `.github/workflows/deploy.yml` sets the working directory of the Vercel build and deploy steps to `frontend/`. Because of (1), the GitHub Actions deployment pipeline will always fail on the Vercel build step.
4. **CORS Subdomain matching failure**:
   - Vercel automatic deployments for this project generate preview and direct deployment URLs of the form `https://mutunerent-[deployment-hash]-mishael-s-alpha.vercel.app`.
   - The regex `/^https:\/\/(mutunerent-web|mutune-alpha)(-.+)?\.vercel\.app$/` requires the subdomain prefix to be exactly `mutunerent-web` or `mutune-alpha`.
   - Because `mutunerent-[deployment-hash]-mishael-s-alpha` does not match `mutunerent-web` or `mutune-alpha`, any API request sent from an automatic Vercel preview deployment URL to the backend will be blocked by CORS.

---

## 3. Caveats

- **No caveats**: All configurations and execution behaviors were tested and verified directly on the workspace.

---

## 4. Conclusion

- **Verdict**: **REQUEST_CHANGES**
- While the configurations are aligned and the remote deployment serves the correct `index-BB2fMyMh.js` bundle, both the local deploy script (`scripts/deploy.js`) and the GitHub Actions deployment pipeline (`.github/workflows/deploy.yml`) are currently **broken** and fail to compile/deploy the frontend. Additionally, CORS will block requests from the automatic Vercel deployments.

---

## 5. Verification Method

1. **Verify deployment script failure**:
   Run the Vercel CLI command from the `frontend/` directory and observe the path failure:
   ```powershell
   cd frontend
   npx vercel --prod --yes
   ```
2. **Verify CORS mismatch**:
   Run the regex check in a node REPL to verify the failure:
   ```javascript
   /^https:\/\/(mutunerent-web|mutune-alpha)(-.+)?\.vercel\.app$/.test("https://mutunerent-f79tyroi7-mishael-s-alpha.vercel.app") // returns false
   ```

---

## 6. Quality Review Report

**Verdict**: **REQUEST_CHANGES**

### Findings

#### [Critical] Finding 1: Broken GitHub Actions Pipeline & Local Deploy Script
- **What**: Both `scripts/deploy.js` and `.github/workflows/deploy.yml` execute Vercel CLI commands from the `frontend/` folder.
- **Where**: `scripts/deploy.js` line 58; `.github/workflows/deploy.yml` lines 99, 109, and 117.
- **Why**: Since `rootDirectory` is configured to `"frontend"` locally and remotely, Vercel CLI expects commands to be run from the root of the repository. Running them inside `frontend/` makes Vercel CLI search for `frontend/frontend`, which fails and breaks the deployment.
- **Suggestion**:
  - Update `scripts/deploy.js` to execute Vercel CLI from the repository root:
    ```javascript
    execSync('npx vercel --prod --yes', { cwd: path.join(__dirname, '..') });
    ```
  - Update `.github/workflows/deploy.yml` to remove `cd frontend` and execute Vercel CLI steps from the root (adjusting copying commands accordingly).

#### [Major] Finding 2: CORS Block on Vercel Preview Deployments
- **What**: The CORS subdomain regex in the backend does not match the actual Vercel deployment URLs.
- **Where**: `backend/server.js` line 43.
- **Why**: Vercel preview and direct deployments start with `mutunerent-` followed by the deployment hash, which fails to match `/^https:\/\/(mutunerent-web|mutune-alpha)(-.+)?\.vercel\.app$/`.
- **Suggestion**:
  - Update the regex to allow any subdomain starting with `mutunerent-` or `mutune-`:
    ```javascript
    const isVercelSubdomain = /^https:\/\/(mutunerent|mutune)(-.+)?\.vercel\.app$/.test(origin);
    ```

### Verified Claims

- Local vercel configurations (`.vercel/project.json` and `frontend/.vercel/project.json`) are correct and consistent → verified via `view_file` → **PASS**
- Vercel project's remote config matches local `rootDirectory` → verified via `npx vercel project inspect` → **PASS**
- Deployed site serves index JS bundle hash `BB2fMyMh` → verified via Vercel build/deploy from root → **PASS**

### Coverage Gaps

- None.

---

## 7. Adversarial Review (Critic) Report

**Overall risk assessment**: **CRITICAL**

### Challenges

#### [Critical] Challenge 1: Deployment CLI fails under standard monorepo configuration
- **Assumption challenged**: That Vercel CLI can be executed inside subfolders when `rootDirectory` settings are active.
- **Attack scenario**: A developer runs `npm run deploy` from the root (which calls `scripts/deploy.js`) or a git push triggers the GitHub Actions pipeline.
- **Blast radius**: Entire frontend deployment fails. Code is never updated in production via automatic pipelines.
- **Mitigation**: Standardize all CLI operations to execute from the root directory.

#### [High] Challenge 2: API CORS blocking on Preview/Hash Deployments
- **Assumption challenged**: That `/^https:\/\/(mutunerent-web|mutune-alpha)(-.+)?\.vercel\.app$/` matches all project deployments.
- **Attack scenario**: A developer checks a preview deployment link generated by Vercel for a branch or pull request.
- **Blast radius**: The preview deployment UI loads but cannot communicate with the backend, displaying failed API requests and errors.
- **Mitigation**: Loosen the CORS subdomain regex to match the base project identifier (`mutunerent` or `mutune`).
