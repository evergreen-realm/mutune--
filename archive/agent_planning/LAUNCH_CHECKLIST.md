# MutuneRent Pro — Launch Checklist
> Phase 4 Productionization & Geo-Localization Layer  
> Last updated: 2026-06-09

---

## Pre-flight: Local Environment

- [ ] Node ≥ 20 installed (`node --version`)
- [ ] `backend/.env` created from `backend/.env.example` with **all** real values
- [ ] `frontend/.env` created from `frontend/.env.example`
- [ ] MongoDB Atlas cluster provisioned (M0 free tier or higher)
- [ ] MongoDB IP access: `0.0.0.0/0` open **or** Render outbound IPs whitelisted
- [ ] Africa's Talking account active with approved sender ID (`MutuneRent`)
- [ ] Resend domain `mutune.co.ke` verified with DNS records published
- [ ] Cloudflare R2 bucket `mutune-images` created; `CLOUDFLARE_R2_PUBLIC_URL` set to public access URL
- [ ] Clerk application created; `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` sourced from Clerk dashboard
- [ ] Groq API key obtained at `console.groq.com`

---

## Backend Verification

```bash
cd backend
npm ci
npm run lint          # must exit 0
npm test              # all tests green, coverage report generated
```

- [ ] Lint passes with 0 errors
- [ ] All tests pass (`npm test` exits 0)
- [ ] Coverage report visible at `backend/coverage/lcov-report/index.html`
- [ ] `GET http://localhost:3000/api/v1/health` returns `{ "status": "ok" }`
- [ ] `POST /api/v1/users/sync-clerk` with a valid Clerk token returns a user record
- [ ] SMS test: trigger a notice via Postman and confirm AT sandbox delivery receipt
- [ ] Email test: confirm Resend dashboard logs a sent event

---

## Phase 4 Geo-Spatial Verification

```bash
# Set a unit's geolocation
curl -X PATCH http://localhost:3000/api/v1/properties/<PROP_ID>/units/<UNIT_ID>/geolocation \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"coordinates":[39.6682,-4.0435]}'

# Fetch GeoJSON FeatureCollection
curl http://localhost:3000/api/v1/properties/<PROP_ID>/units/geojson \
  -H "Authorization: Bearer <TOKEN>"
```

- [ ] `PATCH .../geolocation` returns `200` with updated unit sub-document
- [ ] `GET .../units/geojson` returns valid RFC 7946 FeatureCollection
- [ ] Units without exact GPS coordinates have `has_exact_location: false` and receive jitter offsets
- [ ] MapWidget renders unit-level diamond markers in the **Units** tab
- [ ] Clicking a unit marker transitions to the **3D Preview** tab with `BuildingPreview3D` mounted
- [ ] `2dsphere` index visible on `units.unit_geolocation` in MongoDB Atlas → Indexes

---

## Phase 4 SMS / Multi-Channel Verification

- [ ] Tenant with `preferred_channel: "sms"` receives SMS only (email suppressed)
- [ ] Tenant with `preferred_channel: "email"` receives email; SMS fallback fires if Resend errors
- [ ] Tenant with `preferred_channel: "both"` (default) receives both channels
- [ ] After email failure, `delivery_status` array shows `{ method: "email", status: "failed", fallback_to_sms: true }`
- [ ] Fallback SMS entry shows `{ method: "sms", is_fallback: true, status: "sent" }`
- [ ] All SMS payloads truncated to ≤ 480 characters
- [ ] Phone numbers normalised to E.164 `254XXXXXXXXX` (test with `07...` and `+254...`)

---

## Frontend Verification

```bash
cd frontend
npm ci
npm run lint          # must exit 0
npm run build         # dist/ generated with no errors
npm run preview       # smoke test at http://localhost:4173
```

- [ ] Lint passes with 0 errors
- [ ] Production build succeeds (`dist/` directory created)
- [ ] Map renders on Admin Dashboard with property cluster markers
- [ ] Unit markers appear after clicking a property marker
- [ ] `updateUnitGeolocation` and `fetchUnitGeoJSON` wired correctly in `api.js`

---

## Deployment: Render (Backend)

1. Push `main` branch — Render auto-detects `render.yaml`
2. In Render dashboard: **New → Blueprint** → link the `evergreen-realm/mutune--` repo
3. Set all `sync: false` env vars in the Render **Environment** tab:

| Variable | Where to find it |
|---|---|
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `FRONTEND_URL` | Your Vercel deployment URL |
| `MPESA_*` | Safaricom Daraja portal |
| `AT_API_KEY` / `AT_USERNAME` | Africa's Talking dashboard |
| `RESEND_API_KEY` | Resend dashboard |
| `CLOUDFLARE_R2_*` | Cloudflare dashboard → R2 |
| `GROQ_API_KEY` | console.groq.com |

4. Trigger manual deploy → wait for health check at `/api/v1/health`
5. Set `MPESA_CALLBACK_URL` to `https://mutunerent-api.onrender.com/api/v1/payments/callback`

---

## Deployment: Vercel (Frontend)

1. `vercel --prod` from repo root **or** connect repo in Vercel dashboard
2. Set env var `VITE_API_URL = https://mutunerent-api.onrender.com/api/v1`
3. Set `VITE_CLERK_PUBLISHABLE_KEY` from Clerk dashboard
4. Verify SPA fallback: navigate to `/dashboard` directly — should load the app (not 404)
5. Verify `/api/*` reverse proxy hits Render backend without CORS errors

---

## Post-Deployment Smoke Tests

```bash
# Health
curl https://mutunerent-api.onrender.com/api/v1/health

# Auth-gated route (expect 401, not 500)
curl https://mutunerent-api.onrender.com/api/v1/properties
```

- [ ] Health endpoint returns `200 { status: "ok" }`
- [ ] Protected routes return `401` (not `500` or connection error)
- [ ] MongoDB Atlas shows active connections from Render service IPs
- [ ] Africa's Talking dashboard shows test SMS delivery
- [ ] Resend dashboard shows test email event
- [ ] Cloudflare R2 bucket receives PDF uploads on notice generation

---

## Security Sign-Off

- [ ] No secrets committed to git (`git log --all -p | grep -i "sk_live\|atsk_\|re_"` returns empty)
- [ ] `backend/.env` and `frontend/.env` listed in `.gitignore`
- [ ] Render env vars set as "secret" (not exposed in build logs)
- [ ] CORS origin locked to Vercel domain (not `*`)
- [ ] Helmet CSP headers active (verify with `curl -I https://mutunerent-api.onrender.com/api/v1/health`)
- [ ] Rate limiter active (100 req / 15 min per IP)

---

## Rollback Plan

```bash
# Revert to last known-good commit on Render
git revert HEAD --no-edit
git push origin main
# Render will auto-deploy the revert commit
```

**Sign-off:** _________________________________ Date: _____________
