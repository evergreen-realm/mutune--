#!/usr/bin/env node
/**
 * Deployment script for MutuneRent Pro
 * Reads environment variables and validates required vars
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const requiredSecrets = [
  'MONGODB_URI',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'GROQ_API_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'AFRICAS_TALKING_API_KEY',
  'AFRICAS_TALKING_USERNAME',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_PASSKEY',
  'MPESA_SHORTCODE',
  'MPESA_CALLBACK_URL',
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_PUBLIC_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY'
];

function checkEnv() {
  const missing = requiredSecrets.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(m => console.error(`   - ${m}`));
    process.exit(1);
  }
  console.log('✅ All required environment variables present');
}

function deployBackend() {
  console.log('\n🚀 Deploying backend to Render...');
  try {
    const serviceId = process.env.RENDER_SERVICE_ID || 'srv-crhfl428ii6s7386dvt0';
    const apiKey = process.env.RENDER_API_KEY || 'rnd_zEeYAd8T7eO95Azr49l1Z3GrJN3F';
    
    // Use proper string interpolation for Windows compatibility and add Bearer token
    execSync(`curl -X POST https://api.render.com/v1/services/${serviceId}/deploys -H "Authorization: Bearer ${apiKey}" -H "Accept: application/json"`);
    
    console.log('✅ Backend deploy triggered');
  } catch (e) {
    console.error('❌ Backend deploy failed:', e.message);
  }
}

function deployFrontend() {
  console.log('\n🚀 Deploying frontend to Vercel...');
  try {
    execSync('npx vercel --prod --yes', { cwd: path.join(__dirname, '..') });
    console.log('✅ Frontend deployed');
  } catch (e) {
    console.error('❌ Frontend deploy failed:', e.message);
  }
}

checkEnv();
deployBackend();
deployFrontend();
