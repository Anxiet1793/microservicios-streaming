$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent $workspace
Push-Location (Join-Path $workspace 'users-service')
try { docker compose up -d --wait; if ($LASTEXITCODE -ne 0) { throw 'Users no pudo iniciar' } } finally { Pop-Location }
Push-Location (Join-Path $workspace 'catalog-service')
try { docker compose -f docker-compose.yml -f ../frontend/docker/catalog.private.yml up -d --wait; if ($LASTEXITCODE -ne 0) { throw 'Catalog no pudo iniciar' } } finally { Pop-Location }
Push-Location (Join-Path $workspace 'playback-service')
try { docker compose -f docker-compose.yml -f ../frontend/docker/playback.integrated.yml up -d --wait; if ($LASTEXITCODE -ne 0) { throw 'Playback no pudo iniciar' } } finally { Pop-Location }
Push-Location (Join-Path $workspace 'frontend')
try { docker run --rm -v "${PWD}:/app" -w /app node:24-bookworm-slim node scripts/setup.ts; docker compose up --build -d --wait; if ($LASTEXITCODE -ne 0) { throw 'Frontend no pudo iniciar' } } finally { Pop-Location }
