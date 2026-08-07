# MutuneRent Pro — Deployment Guide

## Stack

| Layer     | Service              | Notes                          |
|-----------|----------------------|--------------------------------|
| Backend   | Render.com (Web Service) | Node 20, auto-deploy from `main` |
| Frontend  | Vercel                | Auto-deploy from `main`        |
| Database  | MongoDB Atlas M0      | Free tier — upgrade on growth  |
| Auth      | Clerk.dev             | Starter plan                   |
| Storage   | Cloudflare R2         | 10 GB free                     |
| SMS       | Africa's Talking      | Pay-as-you-go                  |
| M-Pesa    | Safaricom Daraja      | Sandbox → Live after KYC       |

---

## Environment Variables

### Backend (`backend/.env`)

```bash
# Server
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-vercel-url.vercel.app

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/mutunerent?retryWrites=true&w=majority

# Clerk
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx

# M-Pesa Daraja
MPESA_CONSUMER_KEY=xxxxxxxxxxxxxxxx
MPESA_CONSUMER_SECRET=xxxxxxxxxxxxxxxx
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CALLBACK_URL=https://your-render-url.onrender.com/api/v1/payments/callback
MPESA_C2B_CONFIRMATION_URL=https://your-render-url.onrender.com/api/v1/payments/c2b/confirm
MPESA_C2B_VALIDATION_URL=https://your-render-url.onrender.com/api/v1/payments/c2b/validate
MPESA_ENV=sandbox

# Africa's Talking
AFRICAS_TALKING_API_KEY=atsk_xxxxxxxxxxxxxxxx
AFRICAS_TALKING_USERNAME=sandbox
AFRICAS_TALKING_SENDER_ID=MUTUNE

# Cloudflare R2 (S3-compatible)
CLOUDFLARE_R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxx
CLOUDFLARE_R2_BUCKET=mutune-images
CLOUDFLARE_R2_PUBLIC_URL=https://pub-<hash>.r2.dev
```

### Frontend (`frontend/.env`)

```bash
VITE_API_URL=https://your-render-url.onrender.com/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
```

---

## GitHub Secrets (for CI)

Add these under **Settings → Secrets → Actions**:

| Secret Name                   | Description                    |
|-------------------------------|--------------------------------|
| `CLERK_SECRET_KEY`            | Clerk backend key              |
| `MPESA_CONSUMER_KEY`          | Daraja consumer key            |
| `MPESA_CONSUMER_SECRET`       | Daraja consumer secret         |
| `AFRICAS_TALKING_API_KEY`     | Africa's Talking API key       |
| `VITE_API_URL`                | Backend URL for frontend build |

---

## Render.com Deployment

1. **New Web Service** → Connect GitHub → select `mutune--`
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Node version: `20`
6. Add all backend env vars under **Environment**
7. Enable **Auto-Deploy** on `main`

---

## Vercel Deployment

```bash
cd frontend
npx vercel --prod
```

Or connect GitHub repo in Vercel dashboard:
- Framework: Vite
- Root directory: `frontend`
- Build: `npm run build`
- Output: `dist`
- Add `VITE_API_URL` env var

---

## UptimeRobot Monitors

Create these after deployment at [uptimerobot.com](https://uptimerobot.com) (free plan supports 50 monitors):

| Monitor Name           | Type  | URL                                                          | Interval |
|------------------------|-------|--------------------------------------------------------------|----------|
| API Health             | HTTP  | `GET https://your-render-url.onrender.com/api/v1/health`    | 5 min    |
| Frontend               | HTTP  | `GET https://your-vercel-url.vercel.app`                    | 5 min    |
| M-Pesa Callback        | HTTP  | `POST https://your-render-url.onrender.com/api/v1/payments/callback` | 10 min |
| MongoDB Atlas          | HTTP  | Via Atlas Data API or custom ping endpoint                   | 10 min   |

**Alert Channels:**
- Email: ops@mutune.co.ke
- SMS via Africa's Talking for P0 downtime (< 200ms response fails)

---

## Daraja M-Pesa Go-Live Checklist

- [ ] Business Registration Certificate (KRA PIN)
- [ ] Safaricom Daraja account verified
- [ ] C2B short code registered (PayBill or Till)
- [ ] Callback URLs whitelist approved
- [ ] Switch `MPESA_ENV=production` and update credentials
- [ ] Test with KES 1 transaction
- [ ] Monitor via Daraja dashboard

---

## Phase 3 Roadmap

| Feature                  | Complexity | Priority |
|--------------------------|-----------|---------|
| Digital notices (PDF)    | Medium    | P1      |
| Maintenance board (admin) | Medium   | P1      |
| AI Chat (Groq)           | Low       | P2      |
| Inventory management     | Medium    | P2      |
| Landlord self-service     | High      | P2      |
| render.yaml IaC          | Low       | P1      |
| Sentry error tracking    | Low       | P1      |
