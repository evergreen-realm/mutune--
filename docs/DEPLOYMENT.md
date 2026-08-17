# Deployment Guide — MutuneRent Pro

> [!IMPORTANT]
> Never hardcode credentials in source files. All secrets must be set via environment variables in Render Dashboard or Vercel Dashboard. See [API_KEY_ROTATION.md](./API_KEY_ROTATION.md) for rotation procedures.

---

## 1. Prerequisites

| Requirement | Minimum Version | Purpose |
|---|---|---|
| Node.js | 20.x LTS | Runtime for backend and frontend build |
| npm | 10.x | Package management |
| Git | 2.40+ | Source control |
| GitHub account | — | Repository hosting, CI/CD triggers |

### Required Service Accounts

| Service | Sign-up URL | Purpose |
|---|---|---|
| Render | https://render.com | Backend hosting |
| Vercel | https://vercel.com | Frontend hosting |
| MongoDB Atlas | https://cloud.mongodb.com | Database |
| Clerk | https://clerk.com | Authentication |
| Safaricom Daraja | https://developer.safaricom.co.ke | M-Pesa payments |
| Africa's Talking | https://africastalking.com | SMS + USSD |
| Cloudflare | https://dash.cloudflare.com | R2 object storage |
| Resend | https://resend.com | Transactional email |
| Sentry | https://sentry.io | Error tracking |

---

## 2. Backend Deploy (Render)

### 2.1 Import the Blueprint

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New → Blueprint**.
3. Connect your GitHub repository and select the `main` branch.
4. Render will detect `render.yaml` in the repo root and display the service configuration.
5. Review the plan (Web Service, region, instance type) and click **Apply**.

### 2.2 Configure Environment Variables

Render will create placeholder entries from `render.yaml`. You must fill in the actual values for every variable listed.

> [!CAUTION]
> Do **not** leave any variable blank or set to a placeholder. Missing credentials cause silent failures — the backend will start but individual features (payments, SMS, email) will fail at runtime.

Refer to `backend/.env.example` for the complete list of required variables. Key groups include:

- **Database**: `MONGODB_URI`
- **Auth**: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`
- **Payments**: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_B2C_INITIATOR_NAME`, `MPESA_B2C_SECURITY_CREDENTIAL`
- **SMS/USSD**: `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID`
- **Storage**: `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ENDPOINT`
- **Email**: `RESEND_API_KEY`
- **AI**: `KIMI_API_KEY`
- **Tax**: `KRA_ETIMS_CLIENT_SECRET`, `KRA_ETIMS_SERIAL_NO`
- **Utilities**: `KYANDA_API_KEY`, `KYANDA_API_SECRET`
- **Bank Payments**: `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY`
- **Security**: `JWT_SECRET`, `ENCRYPTION_KEY`
- **Monitoring**: `SENTRY_DSN`

### 2.3 Verify Health Check

After the first deploy completes:

```bash
curl -s https://mutunerent-api.onrender.com/api/v1/health | jq .
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-08-17T07:51:13.000Z",
  "version": "1.0.0"
}
```

### 2.4 Manual Deploy Trigger

To trigger a deploy without pushing code (e.g., after updating env vars):

```bash
curl -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys
```

> [!NOTE]
> `RENDER_API_KEY` and `RENDER_SERVICE_ID` are Render platform credentials — they are **not** application env vars and should not be committed to source.

---

## 3. Frontend Deploy (Vercel)

### 3.1 Connect Repository

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New → Project**.
3. Import the GitHub repository.
4. Set **Root Directory** to `frontend`.
5. Set **Framework Preset** to `Vite`.
6. Click **Deploy**.

### 3.2 Configure Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g., `https://mutunerent-api.onrender.com`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (starts with `pk_`) |
| `VITE_MAPBOX_TOKEN` | Mapbox GL access token |
| `VITE_SENTRY_DSN` | Sentry DSN for frontend error tracking |

### 3.3 CLI Production Deploy

For CI/CD or manual deploys from the command line:

```bash
# Run from the repository ROOT (not inside frontend/)
npx vercel --prod --yes --token $VERCEL_TOKEN
```

> [!WARNING]
> You **must** run this from the repo root. Vercel's path mapping expects the root to resolve the workspace structure. Running from `frontend/` will cause build failures.

---

## 4. Environment Variable Setup

### Local Development

1. Copy the example files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Fill in all values in both `.env` files. See comments in each `.env.example` for descriptions.

3. Never commit `.env` files — they are already in `.gitignore`.

### Production

- **Backend (Render)**: Set all variables via Render Dashboard → Environment tab, or via the `render.yaml` blueprint during initial setup.
- **Frontend (Vercel)**: Set all `VITE_*` variables via Vercel Dashboard → Project Settings → Environment Variables.

> [!IMPORTANT]
> Every new environment variable introduced in code **must** be added to `render.yaml` (for backend) or Vercel Dashboard (for frontend) in the same commit. See Rule §4 in AGENTS.md.

---

## 5. Post-Deploy Verification Checklist

Run through each item after every production deploy:

- [ ] **Backend health endpoint** returns `{"status":"ok"}`:
  ```bash
  curl -s https://mutunerent-api.onrender.com/api/v1/health
  ```

- [ ] **Swagger docs load** without errors:
  Open https://mutunerent-api.onrender.com/api/docs in a browser.

- [ ] **Frontend loads** and displays the login page:
  Open https://mutunerent.vercel.app (or your custom domain).

- [ ] **Clerk authentication works**:
  - Sign up with a test account.
  - Sign in with the test account.
  - Verify role assignment appears in Clerk Dashboard.

- [ ] **M-Pesa STK Push works** in sandbox:
  - Trigger a test payment via the tenant portal or API.
  - Confirm the STK push prompt appears on the test phone number.
  - Verify the callback is received and transaction is recorded.

- [ ] **SMS delivery works** in sandbox:
  - Trigger a test notice or notification.
  - Confirm SMS is received via Africa's Talking sandbox logs.

---

## 6. Rollback Procedure

### 6.1 Backend (Render)

1. Open [Render Dashboard](https://dashboard.render.com).
2. Navigate to the MutuneRent API service.
3. Go to the **Events** tab.
4. Find the last known-good deploy.
5. Click **Rollback to this deploy**.

Render will redeploy the exact commit and build artifacts from that deploy.

### 6.2 Frontend (Vercel)

1. Open [Vercel Dashboard](https://vercel.com/dashboard).
2. Navigate to the MutuneRent project.
3. Go to **Deployments**.
4. Find the last known-good deployment.
5. Click the **⋮** menu → **Promote to Production**.

### 6.3 Database (MongoDB Atlas)

If a deploy introduced a breaking schema change:

1. Open [MongoDB Atlas](https://cloud.mongodb.com).
2. Navigate to your cluster → **Backup** tab.
3. Select the most recent pre-deploy snapshot.
4. Click **Restore** → choose to restore to the same cluster or a new one.

For manual backup/restore:

```bash
# Backup
mongodump --uri="$MONGODB_URI" --out=./backup-$(date +%Y%m%d)

# Restore
mongorestore --uri="$MONGODB_URI" --drop ./backup-20260817
```

> [!CAUTION]
> `--drop` will replace existing collections. Only use when you are certain the backup contains the correct state.

---

## 7. Monitoring

### Sentry (Error Tracking)

- **Dashboard**: https://sentry.io → MutuneRent project
- Alerts are configured for:
  - Unhandled exceptions (immediate)
  - Error rate spikes (>5% over 5 minutes)
  - Performance regression (P95 response time >3s)

### Render Logs

- **Dashboard**: Render → Service → **Logs** tab
- Tail logs via CLI:
  ```bash
  render logs --service $RENDER_SERVICE_ID --tail
  ```

### Vercel Deployment Logs

- **Dashboard**: Vercel → Project → **Deployments** → click any deployment for build and runtime logs
- **Runtime logs** (serverless function invocations) are available under **Monitoring** → **Logs**

### MongoDB Atlas Monitoring

- **Dashboard**: Atlas → Cluster → **Metrics** tab
- Key metrics to watch:
  - Query targeting ratio (should be <100)
  - Connections (should stay under pool limit)
  - Opcounters (read/write volume)
  - Replication lag (for replica sets)
