// set-github-secrets.mjs
// Sets GitHub Actions repository secrets using libsodium sealed-box encryption
// Usage: node scripts/set-github-secrets.mjs

import https from 'https';
import { Buffer } from 'buffer';

// Imports and Setup

// Helper to load env variables from a local .env file without external dependencies
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  });
  return env;
}

// Load env values from root .env or backend/.env or process env
const rootEnv = loadEnvFile(path.resolve('..', '.env'));
const backendEnv = loadEnvFile(path.resolve('backend', '.env'));
const localEnv = loadEnvFile(path.resolve('.env'));

const getEnv = (key) => process.env[key] || localEnv[key] || backendEnv[key] || rootEnv[key];

const GH_TOKEN = getEnv('GITHUB_TOKEN') || getEnv('GH_TOKEN');
if (!GH_TOKEN) {
  throw new Error(
    'CRITICAL CONFIGURATION ERROR: GITHUB_TOKEN or GH_TOKEN is missing. ' +
    'Please set it in your environment or local .env file to configure repository secrets.'
  );
}

const REPO_OWNER = 'evergreen-realm';
const REPO_NAME  = 'mutune--';

const secrets = {
  RENDER_API_KEY:    getEnv('RENDER_API_KEY'),
  RENDER_SERVICE_ID: getEnv('RENDER_SERVICE_ID') || 'srv-crhfl428ii6s7386dvt0',
  VERCEL_TOKEN:      getEnv('VERCEL_TOKEN'),
  VERCEL_ORG_ID:     getEnv('VERCEL_ORG_ID') || 'team_R6Kqhq8YeE61SwWGEdZ9vUJI',
  VERCEL_PROJECT_ID: getEnv('VERCEL_PROJECT_ID') || 'prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt',
};

// Validate that required deployment secrets are present
const missingSecrets = Object.entries(secrets)
  .filter(([_, val]) => !val)
  .map(([name]) => name);

if (missingSecrets.length > 0) {
  throw new Error(
    `CRITICAL CONFIGURATION ERROR: The following required deployment secrets are missing: ${missingSecrets.join(', ')}. ` +
    'Please define them in your environment or local .env file before running this script.'
  );
}

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'mutunerent-deploy',
        'Content-Type': 'application/json',
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// GitHub requires libsodium sealed box encryption.
// We use the tweetsodium package.
async function encryptSecret(publicKeyB64, secretValue) {
  const { default: sodium } = await import('tweetsodium');
  const keyBytes = Buffer.from(publicKeyB64, 'base64');
  const messageBytes = Buffer.from(secretValue, 'utf8');
  const encrypted = sodium.seal(messageBytes, keyBytes);
  return Buffer.from(encrypted).toString('base64');
}

async function setSecret(name, value, keyId, keyB64) {
  const encryptedValue = await encryptSecret(keyB64, value);
  const result = await apiRequest(
    'PUT',
    `/repos/${REPO_OWNER}/${REPO_NAME}/actions/secrets/${name}`,
    { encrypted_value: encryptedValue, key_id: keyId }
  );
  const ok = result.status === 201 || result.status === 204;
  console.log(`  ${ok ? '✅' : '❌'} ${name} (HTTP ${result.status})`);
  return ok;
}

async function main() {
  console.log('Fetching repo public key...');
  const keyResp = await apiRequest('GET', `/repos/${REPO_OWNER}/${REPO_NAME}/actions/secrets/public-key`);
  if (keyResp.status !== 200) {
    console.error('Failed to get public key:', keyResp.body);
    process.exit(1);
  }
  const { key_id, key } = keyResp.body;
  console.log(`Key ID: ${key_id}`);

  console.log('\nSetting secrets:');
  const results = [];
  for (const [name, value] of Object.entries(secrets)) {
    if (!value) {
      console.log(`  ⚠️ Skipping ${name} (not set in environment)`);
      continue;
    }
    const ok = await setSecret(name, value, key_id, key);
    results.push({ name, ok });
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).map(r => r.name);
  console.log(`\nResult: ${passed}/${results.length} secrets set`);
  if (failed.length) console.log('Failed:', failed.join(', '));
  else console.log('All secrets set successfully!');
}

main().catch(e => { console.error(e); process.exit(1); });
