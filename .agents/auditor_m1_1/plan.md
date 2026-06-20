# Audit Plan - Milestone 1 Verification

This plan outlines the steps to verify the implementation of Milestone 1.

## Step 1: Document Review
- **Objective**: Review global configs, scopes, worker handoff, and reviewer reports.
- **Verification**: Ensure alignment between implementation claims and codebase configuration files.

## Step 2: Static Code Verification
- **Objective**: Inspect modified files for hardcoding, bypasses, facade structures, and correct configurations.
- **Targets**:
  - `.github/workflows/deploy.yml` lines 98–121: verify lack of `cd frontend` prefix.
  - `scripts/deploy.js` line 58: verify cwd points to root (`path.join(__dirname, '..')`).
  - `scripts/set-github-secrets.mjs` line 15: verify dynamic token logic.
  - `backend/server.js` line 43: verify CORS subdomain regex.
  - `backend/tests/cors.e2e.test.js`: verify test cases cover preview and production subdomains.

## Step 3: Test Execution
- **Objective**: Attempt manual execution of CORS test suite.
- **Verification**: Run `cd backend && npm test tests/cors.e2e.test.js`. (Note: Command execution may time out if no terminal input is permitted; static validation will act as secondary confirmation).

## Step 4: Adversarial Review
- **Objective**: Identify edge cases, logic bypasses, and security vulnerabilities.
- **Focus**:
  - CORS regex domain squatting / spoofing vectors.
  - Hardcoded tokens in secrets helper scripts.
