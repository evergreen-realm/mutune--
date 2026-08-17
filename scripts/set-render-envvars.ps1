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
#   $env:AT_API_KEY                = "atsk_..."
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
  "GROQ_API_KEY", "KIMI_API_KEY", "RESEND_API_KEY",
  "AT_API_KEY",
  "MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY",
  "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_PIPELINE_ACCESS_KEY_ID", "CLOUDFLARE_R2_PIPELINE_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_ENDPOINT", "CLOUDFLARE_R2_PUBLIC_URL",
  "MODAL_3D_SPLAT_WEBHOOK_URL", "MODAL_BLENDER_WEBHOOK_URL", "MODAL_WEBHOOK_SECRET",
  "ADMIN_HARDCODED_PASSWORD", "ADMIN_PASSWORD", "SENTRY_DSN"
)
$missing = $required | Where-Object { -not (Get-Item "Env:\$_" -ErrorAction SilentlyContinue) }
if ($missing) {
  Write-Error "Missing required env vars: $($missing -join ', ')"
  exit 1
}

$envVars = @(
  @{key="NODE_ENV";                     value="production"},
  @{key="PORT";                         value="10000"},
  @{key="FRONTEND_URL";                 value="https://mutunerent-web-mishael-s-alpha.vercel.app"},
  @{key="MONGODB_URI";                  value=$env:MONGODB_URI},
  @{key="JWT_SECRET";                   value=$env:JWT_SECRET},
  @{key="ENCRYPTION_KEY";               value=$env:ENCRYPTION_KEY},
  @{key="CLERK_SECRET_KEY";             value=$env:CLERK_SECRET_KEY},
  @{key="CLERK_PUBLISHABLE_KEY";        value=$env:CLERK_PUBLISHABLE_KEY},
  @{key="GROQ_API_KEY";                 value=$env:GROQ_API_KEY},
  @{key="GROQ_MODEL";                   value="llama-3.3-70b-versatile"},
  @{key="GROQ_MAX_TOKENS";              value="1024"},
  @{key="GROQ_TEMPERATURE";             value="0.3"},
  @{key="KIMI_API_KEY";                 value=$env:KIMI_API_KEY},
  @{key="KIMI_API_URL";                 value="https://api.moonshot.ai/v1/chat/completions"},
  @{key="RESEND_API_KEY";               value=$env:RESEND_API_KEY},
  @{key="RESEND_FROM_EMAIL";            value=if($env:RESEND_FROM_EMAIL){"$env:RESEND_FROM_EMAIL"}else{"onboarding@resend.dev"}},
  @{key="AT_API_KEY";                   value=$env:AT_API_KEY},
  @{key="AT_USERNAME";                  value=if($env:AT_USERNAME){"$env:AT_USERNAME"}else{"sandbox"}},
  @{key="AT_FROM";                      value="MutuneRent"},
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
  @{key="CLOUDFLARE_R2_PIPELINE_ACCESS_KEY_ID";  value=$env:CLOUDFLARE_R2_PIPELINE_ACCESS_KEY_ID},
  @{key="CLOUDFLARE_R2_PIPELINE_SECRET_ACCESS_KEY"; value=$env:CLOUDFLARE_R2_PIPELINE_SECRET_ACCESS_KEY},
  @{key="CLOUDFLARE_R2_PIPELINE_BUCKET"; value=if($env:CLOUDFLARE_R2_PIPELINE_BUCKET){"$env:CLOUDFLARE_R2_PIPELINE_BUCKET"}else{"mutune-pipeline"}},
  @{key="CLOUDFLARE_R2_PUBLIC_URL";     value=$env:CLOUDFLARE_R2_PUBLIC_URL},
  @{key="BLENDER_PATH";                 value="blender"},
  @{key="BLENDER_SERVER_PATH";          value="/usr/bin/blender"},
  @{key="MODAL_3D_SPLAT_WEBHOOK_URL";   value=$env:MODAL_3D_SPLAT_WEBHOOK_URL},
  @{key="MODAL_BLENDER_WEBHOOK_URL";    value=$env:MODAL_BLENDER_WEBHOOK_URL},
  @{key="MODAL_WEBHOOK_SECRET";         value=$env:MODAL_WEBHOOK_SECRET},
  @{key="ADMIN_HARDCODED_PASSWORD";     value=$env:ADMIN_HARDCODED_PASSWORD},
  @{key="ADMIN_PASSWORD";               value=$env:ADMIN_PASSWORD},
  @{key="SENTRY_DSN";                   value=$env:SENTRY_DSN}
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
  $null = Invoke-RestMethod `
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
