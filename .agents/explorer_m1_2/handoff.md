# Handoff Report: Milestone 1 Exploration

## 1. Observation
* **Vercel Root Configuration (`c:\Users\Admin\Desktop\mutune\.vercel\project.json`)**:
  ```json
  "projectName": "mutunerent-web",
  "settings": {
    "framework": "vite",
    ...
    "rootDirectory": "frontend",
    ...
  }
  ```
* **Vercel Frontend Configuration (`c:\Users\Admin\Desktop\mutune\frontend\.vercel\project.json`)**:
  ```json
  "projectName": "mutunerent-web",
  "settings": {
    ...
    "rootDirectory": null,
    ...
  }
  ```
* **Local Deploy Script (`c:\Users\Admin\Desktop\mutune\scripts\deploy.js` lines 58)**:
  `execSync('npx vercel --prod --yes', { cwd: path.join(__dirname, '../frontend') });`
* **Vercel Pulled Env (`c:\Users\Admin\Desktop\mutune\frontend\.vercel\.env.production.local` line 24)**:
  `VITE_API_URL=""`
* **Vercel Deployment History (via `npx vercel list` command output)**:
  * Successful prebuilt deployment: `https://mutunerent-rnwx9n6u2-mishael-s-alpha.vercel.app` (Status: `Ready`, Duration: `3s`)
  * Failed remote build deployment: `https://mutunerent-erx7dgml2-mishael-s-alpha.vercel.app` (Status: `Error`, Duration: `6s`)

---

## 2. Logic Chain
1. The Vercel project is configured on the dashboard with `"rootDirectory": "frontend"`.
2. When the local deploy script runs `npx vercel --prod` from the `frontend/` directory, it uploads only the contents of the `frontend/` folder.
3. The remote builder searches for a `frontend/` subdirectory in the uploaded source files to perform the build (based on the dashboard setting).
4. Because the directory is not found in the uploaded archive, the remote build fails immediately (errored status in Vercel log, 6s duration).
5. As a result, local changes cannot be pushed directly using the local deployment script.
6. The CI pipeline (`deploy.yml`) uses a local build strategy (`vercel build`) followed by `vercel deploy --prebuilt`, which succeeds because prebuilt deployments bypass remote compilation.
7. However, the CI pipeline is affected by the environment settings on the Vercel Dashboard, where `VITE_API_URL` is set to `""`. When `vercel pull` runs, this empty value is written to `.env.production.local`, overriding the correct Render URL in `.env.production` during the Vite build.

---

## 3. Caveats
* We assumed that the Vercel project's settings on the dashboard itself could not be directly altered without access, but their state is reflected in the pulled local config files.
* We have not run build tests locally since command executions timed out waiting for user approval.

---

## 4. Conclusion
The production URL is not serving the latest local codebase because the local deployment script (`scripts/deploy.js`) runs `npx vercel --prod` inside the `frontend/` subdirectory, causing the remote build to fail due to a directory nesting mismatch against Vercel's `"rootDirectory": "frontend"` configuration. To fix this, all Vercel commands should be aligned to run from the repository root, using a local prebuilt workflow.

---

## 5. Verification Method
1. Inspect the modified `scripts/deploy.js` to ensure Vercel commands are executed from the repository root (cwd `..`).
2. Run the deployment script locally (or simulate the build in CI) to verify that a successful prebuilt deployment is created and mapped to the production alias.
3. Check the network requests from the deployed frontend to confirm they point to `https://mutunerent-api.onrender.com/api/v1` instead of failing with relative URLs.
