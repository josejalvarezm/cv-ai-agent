<#
.SYNOPSIS
    Verify D1 and Vectorize sync status.

.DESCRIPTION
    Quick diagnostic to check if D1 records match Vectorize vectors.
#>

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              CV Assistant - Sync Verification               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check D1 count
Write-Host "1. Checking D1 database..." -ForegroundColor Yellow
npx wrangler d1 execute cv_assistant_db --remote --command "SELECT COUNT(*) as total FROM technology"

Write-Host ""
Write-Host "2. Checking Vectorize index..." -ForegroundColor Yellow
npx wrangler vectorize info cv-skills-index

Write-Host ""
Write-Host "3. Sample of recent records:" -ForegroundColor Yellow
npx wrangler d1 execute cv_assistant_db --remote --command "SELECT id, name FROM technology ORDER BY id DESC LIMIT 5"

Write-Host ""
Write-Host "4. Testing semantic query (GCP)..." -ForegroundColor Yellow
$workerUrl = "https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}"

try {
    $response = Invoke-RestMethod -Uri "$workerUrl/query-d1-vectors?q=GCP%20cloud%20experience" -Method GET
    Write-Host "Query successful! Top result:" -ForegroundColor Green
    if ($response.results) {
        $top = $response.results[0]
        Write-Host "  - $($top.name) (score: $($top.score))" -ForegroundColor Gray
    }
} catch {
    Write-Host "Query failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Verification complete!" -ForegroundColor Green
Write-Host ""
