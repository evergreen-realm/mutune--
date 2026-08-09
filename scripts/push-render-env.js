const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'backend', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const envVars = {
    "NODE_ENV": "production",
    "PORT": "10000",
    "FRONTEND_URL": "https://mutune-alpha.vercel.app"
};

// Parse .env
envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const idx = line.indexOf('=');
        if (idx > 0) {
            const key = line.substring(0, idx).trim();
            const val = line.substring(idx + 1).trim();
            if (key) {
                envVars[key] = val;
            }
        }
    }
});

const renderApiKey = envVars['RENDER_API_KEY'];
const serviceId = envVars['RENDER_SERVICE_ID'];

if (!renderApiKey || !serviceId) {
    console.error("Missing RENDER_API_KEY or RENDER_SERVICE_ID in backend/.env");
    process.exit(1);
}

const payload = Object.keys(envVars).map(key => ({
    key: key,
    value: envVars[key]
}));

console.log(`Pushing ${payload.length} environment variables to Render Service ${serviceId}...`);

fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: 'PUT',
    headers: {
        'Authorization': `Bearer ${renderApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
})
.then(res => {
    if (!res.ok) {
        return res.text().then(text => { throw new Error(text) });
    }
    return res.json();
})
.then(data => {
    console.log("Successfully pushed environment variables.");
    console.log("Triggering redeploy...");
    return fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${renderApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({})
    });
})
.then(res => {
    if (!res.ok) {
        return res.text().then(text => { throw new Error(text) });
    }
    return res.json();
})
.then(data => {
    console.log(`Redeploy triggered successfully. Deploy ID: ${data.id}`);
})
.catch(err => {
    console.error("Error pushing env vars or triggering redeploy:", err);
    process.exit(1);
});
