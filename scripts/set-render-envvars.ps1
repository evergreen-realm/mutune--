#!/usr/bin/env pwsh
# set-render-envvars.ps1
# Injects all MutuneRent Pro env vars into an existing Render service.
#
# USAGE:
#   .\scripts\set-render-envvars.ps1 -ServiceId "srv-xxxxxxxxxxxx"
#
# PREREQUISITES:
#   Set these environment variables BEFORE running:
#   $env:RENDER_API_KEY        = "rnd_..."
#   $env:MONGODB_URI           = "mongodb+srv://..."
#   $env:JWT_SECRET            = "..."
#   $env:ENCRYPTION_KEY        = "..."
#   $env:CLERK_SECRET_KEY      = "sk_..."
#   $env:CLERK_PUBLISHABLE_KEY = "pk_..."
#   $env:GROQ_API_KEY          = "gsk_..."
#   $env:RESEND_API_KEY        = "re_..."
#   $env:AFRICAS_TALKING_API_KEY   = "atsk_..."
#   $env:MPESA_CONSUMER_KEY    = "..."
#   $env:MPESA_CONSUMER_SECRET = "..."
#   $env:MPESA_PASSKEY         = "..."
#   $env:CLOUDFLARE_R2_ACCESS_KEY_ID     = "..."
#   $env:CLOUDFLARE_R2_SECRET_ACCESS_KEY = "..."
#   $env:CLOUDFLARE_R2_ENDPOINT          = "https://..."
#   $env:CLOUDFLARE_R2_PUBLIC_URL        = "https://..."

param(
  [Parameter(Mandatory=$true)]
  [string]$ServiceId
)

$RENDER_API_KEY = $env:RENDER_API_KEY
if (-not $RENDER_API_KEY) {
  Write-Error "RENDER_API_KEY env var not set. Aborting."
  exit 1
}

# Validate all required secrets are present in the environment
$required = @(
  "MONGODB_URI", "JWT_SECRET", "ENCRYPTION_KEY",
  "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY",
  "GROQ_API_KEY", "RESEND_API_KEY",
  "AFRICAS_TALKING_API_KEY",
  "MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY",
  "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_ENDPOINT", "CLOUDFLARE_R2_PUBLIC_URL"
)
$missing = $required | Where-Object { -not (Get-Item "Env:\$_" -ErrorAction SilentlyContinue) }
if ($missing) {
  Write-Error "Missing required env vars: $($missing -join ', ')"
  exit 1
}

$envVars = @(
  @{key="NODE_ENV";                     value="production"},
  @{key="PORT";                         value="10000"},
  @{key="FRONTEND_URL";                 value="https://mutunerent-web.vercel.app"},
  @{key="MONGODB_URI";                  value=$env:MONGODB_URI},
  @{key="JWT_SECRET";                   value=$env:JWT_SECRET},
  @{key="ENCRYPTION_KEY";               value=$env:ENCRYPTION_KEY},
  @{key="CLERK_SECRET_KEY";             value=$env:CLERK_SECRET_KEY},
  @{key="CLERK_PUBLISHABLE_KEY";        value=$env:CLERK_PUBLISHABLE_KEY},
  @{key="GROQ_API_KEY";                 value=$env:GROQ_API_KEY},
  @{key="GROQ_MODEL";                   value="llama-3.3-70b-versatile"},
  @{key="GROQ_MAX_TOKENS";              value="1024"},
  @{key="GROQ_TEMPERATURE";             value="0.3"},
  @{key="RESEND_API_KEY";               value=$env:RESEND_API_KEY},
  @{key="RESEND_FROM_EMAIL";            value=if($env:RESEND_FROM_EMAIL){"$env:RESEND_FROM_EMAIL"}else{"onboarding@resend.dev"}},
  @{key="AFRICAS_TALKING_API_KEY";      value=$env:AFRICAS_TALKING_API_KEY},
  @{key="AFRICAS_TALKING_USERNAME";     value=if($env:AFRICAS_TALKING_USERNAME){"$env:AFRICAS_TALKING_USERNAME"}else{"sandbox"}},
  @{key="AFRICAS_TALKING_SMS_FROM";     value="MutuneRent"},
  @{key="MPESA_CONSUMER_KEY";           value=$env:MPESA_CONSUMER_KEY},
  @{key="MPESA_CONSUMER_SECRET";        value=$env:MPESA_CONSUMER_SECRET},
  @{key="MPESA_PASSKEY";                value=$env:MPESA_PASSKEY},
  @{key="MPESA_SHORTCODE";              value=if($env:MPESA_SHORTCODE){"$env:MPESA_SHORTCODE"}else{"174379"}},
  @{key="MPESA_ENV";                    value=if($env:MPESA_ENV){"$env:MPESA_ENV"}else{"sandbox"}},
  @{key="MPESA_CALLBACK_URL";           value="https://mutune-api.onrender.com/api/v1/payments/callback"},
  @{key="CLOUDFLARE_R2_ENDPOINT";       value=$env:CLOUDFLARE_R2_ENDPOINT},
  @{key="CLOUDFLARE_R2_ACCESS_KEY_ID";  value=$env:CLOUDFLARE_R2_ACCESS_KEY_ID},
  @{key="CLOUDFLARE_R2_SECRET_ACCESS_KEY"; value=$env:CLOUDFLARE_R2_SECRET_ACCESS_KEY},
  @{key="CLOUDFLARE_R2_BUCKET";         value=if($env:CLOUDFLARE_R2_BUCKET){"$env:CLOUDFLARE_R2_BUCKET"}else{"mutune"}},
  @{key="CLOUDFLARE_R2_PUBLIC_URL";     value=$env:CLOUDFLARE_R2_PUBLIC_URL}
)

$headers = @{
  "Authorization" = "Bearer $RENDER_API_KEY"
  "Content-Type"  = "application/json"
  "Accept"        = "application/json"
}

Write-Host "Setting $($envVars.Count) env vars on service $ServiceId ..." -ForegroundColor Cyan

# Try bulk PUT first
$body = $envVars | ConvertTo-Json -Depth 3
try {
  $resp = Invoke-RestMethod `
    -Uri "https://api.render.com/v1/services/$ServiceId/env-vars" `
    -Method PUT `
    -Headers $headers `
    -Body $body
  Write-Host "SUCCESS: All env vars set via bulk PUT." -ForegroundColor Green
} catch {
  Write-Host "Bulk PUT failed, falling back to individual PUTs..." -ForegroundColor Yellow
  foreach ($ev in $envVars) {
    try {
      $evBody = @{value=$ev.value} | ConvertTo-Json
      Invoke-RestMethod `
        -Uri "https://api.render.com/v1/services/$ServiceId/env-vars/$($ev.key)" `
        -Method PUT -Headers $headers -Body $evBody | Out-Null
      Write-Host "  OK $($ev.key)" -ForegroundColor Green
    } catch {
      Write-Host "  FAIL $($ev.key): $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

# Trigger redeploy
Write-Host "`nTriggering redeploy..." -ForegroundColor Cyan
try {
  $d = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId/deploys" `
    -Method POST -Headers $headers -Body "{}"
  Write-Host "Redeploy triggered: $($d.id)" -ForegroundColor Green
} catch {
  Write-Host "Redeploy trigger: $($_.Exception.Message)" -ForegroundColor Red
}
