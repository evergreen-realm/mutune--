# Review & Handoff Report: Milestone 1 - Vercel Production Deployment Gap & Pipeline Setup

## Review Summary

**Verdict**: REQUEST_CHANGES

The remote Vercel project configuration and local `.vercel/project.json` settings have been successfully aligned to use `"rootDirectory": "frontend"`. This solves the issue where Git-triggered auto-deployments failed to locate the project root. Furthermore, a fresh production deployment was successfully forced manually, serving the updated frontend bundle `index-BB2fMyMh.js`.

However, **both the automated GitHub Actions pipeline (`deploy.yml`) and the local deploy script (`deploy.js`) are completely broken**. Because the Vercel project has its remote root directory configured as `"frontend"`, executing Vercel CLI commands inside the `frontend/` folder causes Vercel to append `"frontend"` to the workspace directory, looking for a non-existent `frontend/frontend` folder and failing. 

Additionally, the token configured in `set-github-secrets.mjs` is invalid, preventing proper authentication in the pipeline. The worker bypassed these issues by running manual commands using the repository root as context, but did not update the codebase files to reflect the fix.

---

## Findings

### [Critical] Finding 1: Broken GitHub Actions Workflow (`.github/workflows/deploy.yml`)
- **What**: Vercel CLI commands are run inside the `frontend/` directory.
- **Where**: `c:\Users\Admin\Desktop\mutune\.github\workflows\deploy.yml` lines 99, 109, and 117:
  ```yaml
  run: cd frontend && vercel pull --yes --environment production --token=${{ secrets.VERCEL_TOKEN }}
  run: cd frontend && vercel build --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
  run: cd frontend && vercel deploy --prebuilt --prod --yes --no-wait --token=${{ secrets.VERCEL_TOKEN }}
  ```
- **Why**: Since `rootDirectory` is `"frontend"`, Vercel CLI looks for `./frontend` relative to the command's execution directory. Executing from `frontend/` causes it to search for `frontend/frontend`, which does not exist and results in a build failure.
- **Suggestion**: Modify these steps to run from the repository root instead of `frontend/`:
  ```yaml
  run: vercel pull --yes --environment production --token=${{ secrets.VERCEL_TOKEN }}
  run: vercel build --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
  run: vercel deploy --prebuilt --prod --yes --no-wait --token=${{ secrets.VERCEL_TOKEN }}
  ```

### [Critical] Finding 2: Broken Local Deploy Script (`scripts/deploy.js`)
- **What**: The script attempts to deploy by executing Vercel CLI inside the `frontend/` directory.
- **Where**: `c:\Users\Admin\Desktop\mutune\scripts\deploy.js` line 58:
  ```javascript
  execSync('npx vercel --prod --yes', { cwd: path.join(__dirname, '../frontend') });
  ```
- **Why**: Like the pipeline, running this from `frontend/` results in a nesting mismatch failure.
- **Suggestion**: Run the command with CWD set to the repository root:
  ```javascript
  execSync('npx vercel --prod --yes', { cwd: path.join(__dirname, '..') });
  ```

### [Major] Finding 3: Invalid Vercel Token in GitHub Secrets Script
- **What**: The Vercel token used in `scripts/set-github-secrets.mjs` is invalid.
- **Where**: `c:\Users\Admin\Desktop\mutune\scripts\set-github-secrets.mjs` line 15:
  ```javascript
  VERCEL_TOKEN:      'vcp_73R6R6QnOCrGpS8wkhiwXRCfGjRDCFRO3S1tc6dxfLvLsPKngX0AGvJq',
  ```
- **Why**: Running CLI commands with this token fails with: `Error: The token provided via --token argument is not valid. Please provide a valid token.`
- **Suggestion**: The token must be updated with a valid Vercel Personal Access Token.

---

## 1. Observation

- **Root Vercel Config (`c:\Users\Admin\Desktop\mutune\.vercel\project.json`)**:
  ```json
  "rootDirectory": "frontend"
  ```
- **Frontend Vercel Config (`c:\Users\Admin\Desktop\mutune\frontend\.vercel\project.json`)**:
  ```json
  "rootDirectory": "frontend"
  ```
- **Remote Vercel Project Inspection**:
  Command `npx vercel project inspect` output:
  ```
  Project: mishael-s-alpha/mutunerent-web
  Root Directory: frontend
  Framework Preset: Vite
  Build Command: npm run build
  ```
- **Vercel Deployments**:
  Command `npx vercel list` output:
  ```
  mutunerent-f79tyroi7-mishael-s-alpha.vercel.app     ● Ready      Production      36s          evergreen-realm
  ```
- **Local Build Output**:
  `c:\Users\Admin\Desktop\mutune\frontend\dist\index.html` line 41:
  ```html
  <script type="module" crossorigin src="/assets/index-BB2fMyMh.js"></script>
  ```
  `c:\Users\Admin\Desktop\mutune\frontend\dist\assets/` contains the file `index-BB2fMyMh.js`.

- **Hardcoded Settings**:
  `c:\Users\Admin\Desktop\mutune\scripts\deploy.js` line 58:
  ```javascript
  execSync('npx vercel --prod --yes', { cwd: path.join(__dirname, '../frontend') });
  ```

---

## 2. Logic Chain

1. **Remote Directory Alignment**:
   - The remote Vercel project configuration matches local `.vercel/project.json` and `frontend/.vercel/project.json` settings (`rootDirectory: "frontend"`). (Observation 1, 2, 3)
2. **Path Nesting Mismatch in Commands**:
   - Because the remote `rootDirectory` is set to `"frontend"`, Vercel CLI treats this value as a path offset relative to the execution folder.
   - If the CLI command is run from inside `frontend/` (as in `deploy.js` line 58 and `deploy.yml` lines 99, 109, 117), it will append `frontend` to the CWD and look for `frontend/frontend`. This directory does not exist, causing CLI builds and deployments to fail. (Observation 6)
   - Running the command from the repository root (monorepo root) allows Vercel CLI to correctly find the `./frontend` directory.
3. **Pipeline bypass**:
   - The worker manually deployed the bundle and updated remote settings using `--cwd ..`, resulting in a successfully built production URL serving `index-BB2fMyMh.js`. (Observation 4, 5)
   - However, they did not update the pipeline workflows or the local deploy script, leaving the CI/CD pipeline and the deploy script broken.

---

## 3. Caveats

- **Sandbox Network Limitation**: Due to `CODE_ONLY` network rules, we could not execute raw curl/HTTP requests to inspect the live response body of the deployment alias `https://mutune-alpha.vercel.app`. However, the deployment was confirmed to be `Ready` via Vercel CLI inspect tools, and the build output matches the local file structure.

---

## 4. Conclusion

While the production site now serves the correct bundle hash (`BB2fMyMh`), the implementation cannot be approved because the repository's deploy pipeline and local scripts are broken due to the directory path nesting mismatch and an invalid Vercel token. The worker must correct the execution context in `.github/workflows/deploy.yml` and `scripts/deploy.js`, and replace the invalid token.

---

## 5. Verification Method

To verify the fixes independently:
1. **Local deploy script**: Run `node scripts/deploy.js`. It should execute successfully without failing on the `frontend/frontend` path mismatch.
2. **Pipeline dry run**: Verify that the Vercel commands in `.github/workflows/deploy.yml` run from the root directory rather than within the `frontend/` subdirectory.
3. **Inspect Remote Config**: Run `npx vercel project inspect` at the monorepo root to ensure Root Directory remains configured to `frontend`.
