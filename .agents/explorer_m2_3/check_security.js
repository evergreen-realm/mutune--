const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', '..', '..', 'backend', 'routes');
if (!fs.existsSync(routesDir)) {
  console.error("Routes directory not found:", routesDir);
  process.exit(1);
}

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

console.log(`Found ${files.length} route files. Scanning for security gaps...`);
console.log('='.repeat(80));

const results = [];

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let currentRoute = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect route definition start
    // e.g., router.post('/path', ...
    const routeMatch = line.match(/router\.(get|post|patch|put|delete)\s*\(\s*['"]([^'"]+)['"]/);
    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      const routePath = routeMatch[2];
      
      // Accumulate the route block until we find the start of the handler function
      let block = line;
      let j = i;
      while (j < lines.length && !block.includes('async') && !block.includes('function') && !block.includes('=>')) {
        j++;
        if (j < lines.length) {
          block += '\n' + lines[j];
        }
      }

      const hasAuth = block.includes('requireAuth') || block.includes('verifyClerkToken');
      const hasRole = block.includes('requireRole') || block.includes('requirePermission') || block.includes('verifyClerkToken');
      
      // Check for express-validator usages
      const hasValidator = block.includes('body(') || block.includes('param(') || block.includes('query(') || 
                           block.includes('validationResult') || (block.includes('validate') && !block.includes('async (req, res') && !block.includes('function('));
      
      const isMutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

      results.push({
        file,
        lineNum: i + 1,
        method,
        path: routePath,
        block: block.replace(/\s+/g, ' '),
        hasAuth,
        hasRole,
        hasValidator,
        isMutating
      });
    }
  }
});

// Report 1: Missing Authentication
console.log('\n--- 1. ROUTES MISSING AUTHENTICATION (requireAuth / verifyClerkToken) ---');
let missingAuthCount = 0;
results.forEach(r => {
  // Allow clerk webhook to be public or handled differently, but check other public routes
  const isWebhook = r.path.includes('webhook') || r.path.includes('callback');
  if (!r.hasAuth && !isWebhook) {
    console.log(`[${r.file}:${r.lineNum}] ${r.method} ${r.path}`);
    console.log(`   Block: ${r.block.substring(0, 120)}...`);
    missingAuthCount++;
  }
});
if (missingAuthCount === 0) console.log("No routes missing authentication (excluding webhooks/callbacks).");

// Report 2: Missing Role/Permission Gating (Authorization)
console.log('\n--- 2. ROUTES MISSING ROLE/PERMISSION GATING (requireRole / requirePermission) ---');
let missingRoleCount = 0;
results.forEach(r => {
  const isWebhook = r.path.includes('webhook') || r.path.includes('callback') || r.path === '/me';
  if (!r.hasRole && !isWebhook) {
    console.log(`[${r.file}:${r.lineNum}] ${r.method} ${r.path}`);
    missingRoleCount++;
  }
});
if (missingRoleCount === 0) console.log("No routes missing role/permission checks.");

// Report 3: Mutating Routes (POST/PATCH/PUT) Missing Input Validation
console.log('\n--- 3. MUTATING ROUTES MISSING INPUT VALIDATION (express-validator) ---');
let missingValCount = 0;
results.forEach(r => {
  if (r.isMutating && !r.hasValidator && !r.path.includes('webhook') && !r.path.includes('callback')) {
    console.log(`[${r.file}:${r.lineNum}] ${r.method} ${r.path}`);
    missingValCount++;
  }
});
if (missingValCount === 0) console.log("No mutating routes missing input validation.");

// Report 4: Sensitive logging audit
console.log('\n--- 4. SENSITIVE LOGGING AUDIT (password, clerkId, phone in logger calls) ---');
let sensitiveLogCount = 0;
files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.includes('logger.')) {
      const sensitivePatterns = [/\bpassword\b/i, /\bclerkId\b/i, /\bclerk_id\b/i, /\bphone\b/i];
      const matched = sensitivePatterns.filter(p => p.test(line));
      if (matched.length > 0) {
        console.log(`[${file}:${idx + 1}] Matches: ${matched.map(m => m.toString()).join(', ')}`);
        console.log(`   Line: ${line.trim()}`);
        sensitiveLogCount++;
      }
    }
  });
});
if (sensitiveLogCount === 0) console.log("No sensitive fields logged.");
