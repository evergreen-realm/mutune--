#!/usr/bin/env node
/**
 * scripts/deploy.js — Phase 4 deployment pipeline
 *
 * Reads repository state, validates all required environment secrets,
 * then runs lint → test → build in order. Hard-exits with code 1 on
 * any failure so CI/CD platforms treat it as a broken build.
 *
 * Usage:
 *   node scripts/deploy.js               # validate + full pipeline
 *   node scripts/deploy.js --validate    # secret-check only (no build)
 *   node scripts/deploy.js --skip-tests  # lint + build, skip test suite
 */

'use strict';

const { execSync }  = require('child_process');
const path          = require('path');
const fs            = require('fs');

// ── Colour helpers (no external deps) ──────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m'
};
const ok   = (msg) => process.stdout.write(`${c.green}✔${c.reset}  ${msg}\n`);
const fail = (msg) => process.stderr.write(`${c.red}✖${c.reset}  ${msg}\n`);
const info = (msg) => process.stdout.write(`${c.cyan}ℹ${c.reset}  ${msg}\n`);
const warn = (msg) => process.stdout.write(`${c.yellow}⚠${c.reset}  ${msg}\n`);
const head = (msg) => process.stdout.write(`\n${c.bold}${c.cyan}── ${msg} ──${c.reset}\n`);

// ── CLI flags ───────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const validateOnly = args.includes('--validate');
const skipTests    = args.includes('--skip-tests');

// ── Paths ───────────────────────────────────────────────────────────────────
const ROOT     = path.resolve(__dirname, '..');
const BACKEND  = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

// ── Required secrets matrix ─────────────────────────────────────────────────
const REQUIRED_SECRETS = [
  // Core
  { key: 'MONGODB_URI',            label: 'MongoDB Atlas URI',            group: 'Database' },
  { key: 'CLERK_SECRET_KEY',       label: 'Clerk secret key',             group: 'Auth' },
  { key: 'FRONTEND_URL',           label: 'Frontend URL (CORS origin)',   group: 'Auth' },

  // Payments
  { key: 'MPESA_CONSUMER_KEY',     label: 'M-Pesa consumer key',          group: 'M-Pesa' },
  { key: 'MPESA_CONSUMER_SECRET',  label: 'M-Pesa consumer secret',       group: 'M-Pesa' },
  { key: 'MPESA_SHORTCODE',        label: 'M-Pesa shortcode',             group: 'M-Pesa' },
  { key: 'MPESA_PASSKEY',          label: 'M-Pesa passkey',               group: 'M-Pesa' },
  { key: 'MPESA_CALLBACK_URL',     label: 'M-Pesa STK callback URL',      group: 'M-Pesa' },

  // SMS
  { key: 'AT_API_KEY',             label: "Africa's Talking API key",     group: 'SMS' },
  { key: 'AT_USERNAME',            label: "Africa's Talking username",    group: 'SMS' },

  // Email
  { key: 'RESEND_API_KEY',         label: 'Resend API key',               group: 'Email' },
  { key: 'RESEND_FROM_EMAIL',      label: 'Resend from address',          group: 'Email' },

  // Storage
  { key: 'CLOUDFLARE_R2_ENDPOINT',         label: 'R2 endpoint',            group: 'Storage' },
  { key: 'CLOUDFLARE_R2_ACCESS_KEY_ID',    label: 'R2 access key ID',       group: 'Storage' },
  { key: 'CLOUDFLARE_R2_SECRET_ACCESS_KEY',label: 'R2 secret access key',   group: 'Storage' },
  { key: 'CLOUDFLARE_R2_BUCKET',           label: 'R2 bucket name',         group: 'Storage' },
  { key: 'CLOUDFLARE_R2_PUBLIC_URL',       label: 'R2 public CDN URL',      group: 'Storage' },

  // AI
  { key: 'GROQ_API_KEY',           label: 'Groq API key',                 group: 'AI' }
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function run(cmd, cwd, label) {
  info(`Running: ${c.bold}${cmd}${c.reset}  (${path.relative(ROOT, cwd)})`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
    ok(label);
  } catch (err) {
    fail(`${label} — exit code ${err.status}`);
    process.exit(1);
  }
}

function readPackageVersion(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return pkg.version || '?';
  } catch (_) {
    return '?';
  }
}

// ── 1. Banner ────────────────────────────────────────────────────────────────
head('MutuneRent Pro — Phase 4 Deployment Pipeline');
info(`Backend  v${readPackageVersion(BACKEND)}`);
info(`Frontend v${readPackageVersion(FRONTEND)}`);
info(`Node     ${process.version}`);
info(`Mode     ${validateOnly ? 'validate-only' : skipTests ? 'skip-tests' : 'full'}`);

// ── 2. Secret validation ─────────────────────────────────────────────────────
head('Secret Validation');

// Load .env if present (development convenience)
const envPath = path.join(BACKEND, '.env');
if (fs.existsSync(envPath)) {
  warn('.env file detected — loading for local validation (never commit this file)');
  require('dotenv').config({ path: envPath });
}

let secretErrors = 0;
let lastGroup = null;

for (const { key, label, group } of REQUIRED_SECRETS) {
  if (group !== lastGroup) {
    process.stdout.write(`\n  ${c.bold}[${group}]${c.reset}\n`);
    lastGroup = group;
  }
  const val = process.env[key];
  if (!val || val.trim() === '') {
    fail(`  ${key.padEnd(38)} — ${label} MISSING`);
    secretErrors++;
  } else {
    // Mask the value: show first 6 chars then ***
    const masked = val.length > 6 ? val.slice(0, 6) + '***' : '***';
    ok(`  ${key.padEnd(38)} ${masked}`);
  }
}

process.stdout.write('\n');

if (secretErrors > 0) {
  fail(`Secret validation FAILED — ${secretErrors} missing variable${secretErrors > 1 ? 's' : ''}`);
  fail('Set all required secrets in your environment or Render dashboard before deploying.');
  process.exit(1);
}

ok('All secrets present');

if (validateOnly) {
  ok('--validate flag set — skipping build pipeline');
  process.exit(0);
}

// ── 3. Backend pipeline ──────────────────────────────────────────────────────
head('Backend Pipeline');
run('npm run lint',                BACKEND,  'Backend lint');
if (!skipTests) {
  run('npm test -- --forceExit',   BACKEND,  'Backend tests');
}

// ── 4. Frontend pipeline ─────────────────────────────────────────────────────
head('Frontend Pipeline');
run('npm run lint',   FRONTEND, 'Frontend lint');
run('npm run build',  FRONTEND, 'Frontend build');

// ── 5. Build artefact summary ────────────────────────────────────────────────
head('Build Summary');
const distDir = path.join(FRONTEND, 'dist');
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir, { recursive: true })
    .filter(f => !fs.statSync(path.join(distDir, f)).isDirectory());
  const totalBytes = files.reduce((sum, f) => {
    try { return sum + fs.statSync(path.join(distDir, f)).size; } catch (_) { return sum; }
  }, 0);
  ok(`Frontend dist: ${files.length} files, ${(totalBytes / 1024).toFixed(1)} KB total`);
}

ok(`${c.bold}${c.green}Pipeline complete — ready to deploy${c.reset}`);
info('Next: push to main and Render will auto-deploy via webhook.');
