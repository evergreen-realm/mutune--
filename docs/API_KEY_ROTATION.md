# API Key Rotation Procedures — MutuneRent Pro

> [!CAUTION]
> This document contains **no actual secrets**. All values shown are placeholders. Never commit real credentials to source control. See Rule §4 in AGENTS.md.

---

## Quick Reference

| Key Name | Dashboard URL | Risk | Rotation Schedule |
|---|---|---|---|
| `CLERK_SECRET_KEY` | https://dashboard.clerk.com | High | Monthly |
| `CLERK_PUBLISHABLE_KEY` | https://dashboard.clerk.com | Low | Quarterly |
| `MPESA_CONSUMER_KEY` | https://developer.safaricom.co.ke | High | Monthly |
| `MPESA_CONSUMER_SECRET` | https://developer.safaricom.co.ke | High | Monthly |
| `MPESA_PASSKEY` | Safaricom (provided directly) | High | On compromise only |
| `AT_API_KEY` | https://account.africastalking.com | High | Monthly |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | https://dash.cloudflare.com | Medium | Quarterly |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | https://dash.cloudflare.com | High | Quarterly |
| `GROQ_API_KEY` | https://console.groq.com | Medium | Quarterly |
| `KIMI_API_KEY` | https://platform.moonshot.ai | Medium | Quarterly |
| `RESEND_API_KEY` | https://resend.com/api-keys | Medium | Quarterly |
| `KRA_ETIMS_CLIENT_SECRET` | KRA eTIMS portal | High | Annually (or on compromise) |
| `KYANDA_API_KEY` | https://dashboard.kyanda.africa | Medium | Quarterly |
| `DARAJA_CONSUMER_KEY` | https://developer.safaricom.co.ke | High | Monthly |
| `DARAJA_CONSUMER_SECRET` | https://developer.safaricom.co.ke | High | Monthly |
| `INTASEND_PUBLISHABLE_KEY` | https://payment.intasend.com | Low | Quarterly |
| `INTASEND_SECRET_KEY` | https://payment.intasend.com | High | Monthly |
| `SENTRY_DSN` | https://sentry.io | Low | Annually |
| `JWT_SECRET` | Self-generated | High | Monthly |
| `ENCRYPTION_KEY` | Self-generated | High | Monthly |
| `MONGODB_URI` | https://cloud.mongodb.com | High | Quarterly |
| `VITE_MAPBOX_TOKEN` | https://account.mapbox.com | Low | Annually |
| `MODAL_WEBHOOK_SECRET` | Modal dashboard | Medium | Quarterly |

---

## Detailed Rotation Procedures

### 1. CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY

**Risk**: High (secret key) / Low (publishable key)
**Schedule**: Monthly (secret) / Quarterly (publishable)

**Where to generate:**
1. Go to https://dashboard.clerk.com.
2. Select your MutuneRent application.
3. Navigate to **API Keys**.
4. Click **Rotate** next to the key you want to replace.
5. Clerk will generate a new key immediately. The old key remains valid for a grace period (configurable).

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `CLERK_SECRET_KEY` |
| Vercel Dashboard → Environment Variables | `VITE_CLERK_PUBLISHABLE_KEY` |
| Local `backend/.env` | `CLERK_SECRET_KEY` |
| Local `frontend/.env` | `VITE_CLERK_PUBLISHABLE_KEY` |

**Verification:**
```bash
# Backend: confirm auth middleware works
curl -s -H "Authorization: Bearer <test-token>" \
  https://mutunerent-api.onrender.com/api/v1/users/me

# Frontend: confirm login page loads and sign-in completes
```

---

### 2. MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET

**Risk**: High
**Schedule**: Monthly

**Where to generate:**
1. Go to https://developer.safaricom.co.ke.
2. Navigate to **My Apps** → select the MutuneRent app.
3. Click **Regenerate Keys** (both Consumer Key and Consumer Secret will be regenerated together).

> [!WARNING]
> Regenerating keys invalidates the previous pair immediately. Update all locations before traffic resumes.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET` |
| Local `backend/.env` | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET` |

**Verification:**
```bash
# Generate an OAuth token to confirm the new keys work
curl -s -X GET \
  --url "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" \
  --user "$MPESA_CONSUMER_KEY:$MPESA_CONSUMER_SECRET"

# Expected: {"access_token":"...","expires_in":"3599"}
```

---

### 3. MPESA_PASSKEY

**Risk**: High
**Schedule**: On compromise only (rarely rotated)

**Where to generate:**
- The passkey is provided directly by Safaricom during M-Pesa API onboarding.
- Contact Safaricom M-Pesa API support to request a new passkey.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `MPESA_PASSKEY` |
| Local `backend/.env` | `MPESA_PASSKEY` |

**Verification:**
- Trigger a sandbox STK Push request and confirm the push prompt arrives on the test phone.

---

### 4. AT_API_KEY (Africa's Talking)

**Risk**: High
**Schedule**: Monthly

**Where to generate:**
1. Go to https://account.africastalking.com.
2. Navigate to **Settings** → **API Key**.
3. Click **Generate** to create a new key.

> [!NOTE]
> Africa's Talking allows multiple active keys. Generate the new key first, update all locations, verify, then revoke the old key.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `AT_API_KEY` |
| Local `backend/.env` | `AT_API_KEY` |

**Verification:**
```bash
# Send a test SMS via sandbox
curl -s -X POST \
  https://api.sandbox.africastalking.com/version1/messaging \
  -H "apiKey: $AT_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=sandbox&to=+254700000000&message=Rotation+test"

# Expected: {"SMSMessageData":{"Message":"Sent to 1/1 ...","Recipients":[...]}}
```

---

### 5. CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY

**Risk**: Medium (access key ID) / High (secret)
**Schedule**: Quarterly

**Where to generate:**
1. Go to https://dash.cloudflare.com.
2. Navigate to **R2** → **Manage R2 API Tokens**.
3. Click **Create API Token**.
4. Set permissions: Object Read & Write for your MutuneRent buckets.
5. Copy the new Access Key ID and Secret Access Key.

> [!TIP]
> Create the new token before revoking the old one to avoid downtime.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` |
| Local `backend/.env` | `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` |

**Verification:**
```bash
# List objects in a bucket to confirm access
aws s3 ls s3://$CLOUDFLARE_R2_BUCKET/ \
  --endpoint-url $CLOUDFLARE_R2_ENDPOINT \
  --region auto
```

---

### 6. GROQ_API_KEY

**Risk**: Medium
**Schedule**: Quarterly

**Where to generate:**
1. Go to https://console.groq.com.
2. Navigate to **API Keys**.
3. Click **Create API Key** and copy the value.
4. Revoke the old key after verifying the new one.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `GROQ_API_KEY` |
| Local `backend/.env` | `GROQ_API_KEY` |

**Verification:**
- Trigger an AI chat request in the app and confirm a response is returned without auth errors.

---

### 7. KIMI_API_KEY (Moonshot AI)

**Risk**: Medium
**Schedule**: Quarterly

**Where to generate:**
1. Go to https://platform.moonshot.ai.
2. Navigate to **API Keys**.
3. Create a new key and copy it.
4. Delete the old key after verification.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `KIMI_API_KEY` |
| Local `backend/.env` | `KIMI_API_KEY` |

**Verification:**
- Send a test message to the `/api/v1/ai/chat` endpoint and confirm a valid Kimi response.

---

### 8. RESEND_API_KEY

**Risk**: Medium
**Schedule**: Quarterly

**Where to generate:**
1. Go to https://resend.com/api-keys.
2. Click **Create API Key**.
3. Set appropriate permissions (send-only recommended for production).
4. Copy the key.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `RESEND_API_KEY` |
| Local `backend/.env` | `RESEND_API_KEY` |

**Verification:**
```bash
# Send a test email
curl -s -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"test@mutunerent.com","to":"admin@mutunerent.com","subject":"Rotation test","text":"Key rotated successfully."}'

# Expected: {"id":"..."}
```

---

### 9. KRA_ETIMS_CLIENT_SECRET

**Risk**: High
**Schedule**: Annually (or immediately on compromise)

**Where to generate:**
- This credential is managed by the Kenya Revenue Authority.
- Contact KRA eTIMS support to request a credential rotation.
- Provide your eTIMS serial number and business PIN.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `KRA_ETIMS_CLIENT_SECRET` |
| Local `backend/.env` | `KRA_ETIMS_CLIENT_SECRET` |

**Verification:**
- Submit a test invoice via the `/api/v1/tax/invoice` endpoint.
- Confirm the eTIMS response contains a valid `intrlData` (internal data reference).

---

### 10. KYANDA_API_KEY

**Risk**: Medium
**Schedule**: Quarterly

**Where to generate:**
1. Go to https://dashboard.kyanda.africa.
2. Navigate to **API Settings**.
3. Generate a new API key.
4. Copy the key and secret.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `KYANDA_API_KEY`, `KYANDA_API_SECRET` |
| Local `backend/.env` | `KYANDA_API_KEY`, `KYANDA_API_SECRET` |

**Verification:**
- Query a test KPLC meter number via the utilities endpoint and confirm a valid response.

---

### 11. DARAJA_CONSUMER_KEY / DARAJA_CONSUMER_SECRET (B2C Disbursement)

**Risk**: High
**Schedule**: Monthly

> [!NOTE]
> If you use the same Daraja app for both STK Push and B2C disbursement, these are the same credentials as `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` (see §2 above). If you use separate apps, follow the same procedure at https://developer.safaricom.co.ke → **My Apps** for the disbursement app.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET` |
| Local `backend/.env` | `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET` |

**Verification:**
- Same OAuth token test as §2 above, using the disbursement app's credentials.

---

### 12. INTASEND_PUBLISHABLE_KEY / INTASEND_SECRET_KEY

**Risk**: Low (publishable) / High (secret)
**Schedule**: Quarterly (publishable) / Monthly (secret)

**Where to generate:**
1. Go to https://payment.intasend.com.
2. Navigate to **API Keys**.
3. Generate new keys.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY` |
| Local `backend/.env` | `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY` |

**Verification:**
- Initiate a test bank checkout via the `/api/v1/bank-payments` endpoint.
- Confirm a valid checkout URL is returned.

---

### 13. SENTRY_DSN

**Risk**: Low
**Schedule**: Annually

> [!NOTE]
> Sentry DSNs are low-risk — they identify where to send events but don't grant access to your Sentry data. Rotate only if compromised or when restructuring projects.

**Where to generate:**
1. Go to https://sentry.io.
2. Navigate to your project → **Settings** → **Client Keys (DSN)**.
3. Click **Generate New Key**.
4. Disable the old key after verifying the new one works.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `SENTRY_DSN` |
| Vercel Dashboard → Environment Variables | `VITE_SENTRY_DSN` |
| Local `backend/.env` | `SENTRY_DSN` |
| Local `frontend/.env` | `VITE_SENTRY_DSN` |

**Verification:**
- Trigger a test error in both backend and frontend.
- Confirm both events appear in the Sentry dashboard under the new DSN.

---

### 14. JWT_SECRET

**Risk**: High
**Schedule**: Monthly

**Where to generate:**
```bash
openssl rand -hex 32
```

> [!WARNING]
> Rotating `JWT_SECRET` will invalidate **all** existing JWT tokens. Users with active sessions will be logged out. Plan rotations during low-traffic windows.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `JWT_SECRET` |
| Local `backend/.env` | `JWT_SECRET` |

**Verification:**
- After updating, confirm the backend starts without errors.
- Confirm a fresh login produces a valid JWT that the backend accepts.

---

### 15. ENCRYPTION_KEY

**Risk**: High
**Schedule**: Monthly

**Where to generate:**
```bash
openssl rand -hex 16
```

> [!CAUTION]
> Rotating `ENCRYPTION_KEY` means data encrypted with the old key cannot be decrypted with the new key. Before rotating, ensure you have a migration plan for any encrypted data at rest (e.g., re-encrypt with the new key, or maintain a key versioning scheme).

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `ENCRYPTION_KEY` |
| Local `backend/.env` | `ENCRYPTION_KEY` |

**Verification:**
- Confirm the backend starts without decryption errors.
- Confirm encrypted fields (if any) can be read and written correctly.

---

### 16. MONGODB_URI

**Risk**: High
**Schedule**: Quarterly

**Where to generate:**
1. Go to https://cloud.mongodb.com.
2. Navigate to **Database Access**.
3. Click **Edit** on the MutuneRent database user.
4. Click **Edit Password** → **Autogenerate Secure Password**.
5. Copy the new password.
6. Update the connection string with the new password.

> [!TIP]
> Create a new database user with the new password, verify it works, then delete the old user. This avoids downtime.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `MONGODB_URI` |
| Local `backend/.env` | `MONGODB_URI` |

**Verification:**
```bash
# Test connection with mongosh
mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')"

# Expected: { ok: 1 }
```

---

### 17. VITE_MAPBOX_TOKEN

**Risk**: Low
**Schedule**: Annually

**Where to generate:**
1. Go to https://account.mapbox.com/access-tokens/.
2. Click **Create a token**.
3. Set scopes (at minimum: `styles:read`, `fonts:read`, `datasets:read`).
4. Optionally restrict to your domain URLs.
5. Copy the token.

**Where to update:**
| Location | Variable |
|---|---|
| Vercel Dashboard → Environment Variables | `VITE_MAPBOX_TOKEN` |
| Local `frontend/.env` | `VITE_MAPBOX_TOKEN` |

**Verification:**
- Load the frontend map view.
- Confirm the Mapbox map renders with tiles and 3D buildings.
- Check browser console for 401/403 errors from Mapbox API.

---

### 18. MODAL_WEBHOOK_SECRET

**Risk**: Medium
**Schedule**: Quarterly

**Where to generate:**
1. Open the Modal dashboard for your MutuneRent deployment.
2. Navigate to webhook settings.
3. Generate a new webhook secret.
4. Copy the value.

**Where to update:**
| Location | Variable |
|---|---|
| Render Dashboard → Environment | `MODAL_WEBHOOK_SECRET` |
| Local `backend/.env` | `MODAL_WEBHOOK_SECRET` |

**Verification:**
- Trigger a test webhook event from Modal.
- Confirm the backend processes it without signature validation errors.

---

## General Rotation Checklist

For every rotation, follow this checklist:

- [ ] Generate the new credential in the provider dashboard.
- [ ] Update the value in **Render Dashboard** (for backend variables).
- [ ] Update the value in **Vercel Dashboard** (for `VITE_*` frontend variables).
- [ ] Update the value in your **local `.env`** file (for development).
- [ ] Trigger a redeploy on Render (env var changes require a new deploy).
- [ ] Trigger a redeploy on Vercel (env var changes require a new deploy).
- [ ] Run the verification step specific to that credential.
- [ ] Revoke or disable the old credential in the provider dashboard.
- [ ] Record the rotation date in your team's credential tracking system.

> [!IMPORTANT]
> Always generate the new key **before** revoking the old one. This ensures zero-downtime rotation for services that support multiple active keys. For services that only allow one active key (e.g., Safaricom Daraja), plan a brief maintenance window.
