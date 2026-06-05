# MutuneRent Pro - Account Setup Checklist

This document details the configuration and credentials for the external services integrated into MutuneRent Pro.

## 1. Hosting & CI/CD
- **Render** (API Service)
  - Status: Active (Free Tier)
  - Web Service Name: `mutunerent-api`
  - Service ID: `srv-c1234567890abcdefgh`
  - Region: `singapore` or `oregon`
- **Vercel** (Frontend SPA)
  - Status: Active (Free Tier)
  - Project ID: `prj_mutunerentweb123456`
  - Deployment Domain: `https://mutunerent-pro.vercel.app`

## 2. Databases & Storage
- **MongoDB Atlas** (M0 Cluster)
  - Status: Provisioned (Free Tier M0)
  - Cluster Name: `mutune-cluster`
  - Region: AWS Mumbai (`ap-south-1`)
  - Connection URI: `***REDACTED_MONGO_URI_2***`
  - IP Whitelist: `0.0.0.0/0` (configured for sandbox access)
- **Cloudflare R2** (Image Storage)
  - Status: Active
  - Bucket Name: `mutune-images`
  - Endpoint: `https://8a77b924391311f1999304ed33605346.r2.cloudflarestorage.com`
  - Access Key ID: `cf_access_key_id_9876543210`
  - Secret Access Key: `cf_secret_access_key_abcdefghijklmnopqrstuvwx`

## 3. Authentication & Security
- **Clerk** (Auth & RBAC)
  - Status: Active
  - Application Name: `MutuneRent Pro`
  - Publishable Key: `pk_test_Y2xlcmsubXV0dW5lcmVudC5wcm8k`
  - Secret Key: `sk_test_c2VjcmV0X2tleV9mb3JfbXV0dW5lcmVudF9wcm80NTY3`

## 4. Payment Gateway & SMS Notifications
- **M-Pesa Daraja API** (Safaricom Sandbox)
  - Status: Active (Sandbox Mode)
  - Consumer Key: `mpesa_consumer_key_sandbox_12345`
  - Consumer Secret: `mpesa_consumer_secret_sandbox_67890`
  - Passkey: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
  - Shortcode: `174379` (Lipa Na M-Pesa Online Sandbox Shortcode)
- **Africa's Talking** (SMS Provider)
  - Status: Active (Sandbox Mode)
  - Username: `sandbox`
  - API Key: `at_api_key_sandbox_abcdefghijklmnopqrstuvwxyz012345`
  - Sender ID (AT From): `MutuneRent` (Sandbox default or simulated custom alphanumeric)

## 5. Monitoring & AI
- **Sentry** (Error Monitoring)
  - Status: Active (GitHub Student Developer Pack / Developer Plan)
  - DSN: `https://sentry_dsn_placeholder@o12345.ingest.sentry.io/45071234567890`
- **Groq Cloud** (AI Engine)
  - Status: Active
  - Model: `Llama 3 70B`
  - API Key: `gsk_groq_api_key_llama3_70b_agent_key_1234567`
