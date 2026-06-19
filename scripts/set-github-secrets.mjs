// set-github-secrets.mjs
// Sets GitHub Actions repository secrets using libsodium sealed-box encryption
// Usage: node scripts/set-github-secrets.mjs

import https from 'https';
import { Buffer } from 'buffer';

const GH_TOKEN   = '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';
const REPO_OWNER = 'evergreen-realm';
const REPO_NAME  = 'mutune--';

const secrets = {
  RENDER_API_KEY:    'rnd_zEeYAd8T7eO95Azr49l1Z3GrJN3F',
  RENDER_SERVICE_ID: 'PENDING_MANUAL_SETUP',           // update after Render service created
  VERCEL_TOKEN:      process.env.VERCEL_TOKEN || '',
  VERCEL_ORG_ID:     'team_R6Kqhq8YeE61SwWGEdZ9vUJI',
  VERCEL_PROJECT_ID: 'prj_2evu8fKOr2Kk7sxDreMuYVCLwVvt',
};

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
