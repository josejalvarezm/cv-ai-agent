<#
.SYNOPSIS
    Re-indexes all technology records into Vectorize for semantic search.

.DESCRIPTION
    This script triggers the CV Assistant Worker to re-generate embeddings
    for all technology records in D1 and store them in Vectorize.
    
    Use this after:
    - Adding new technologies to D1
    - Fixing data issues
    - Rebuilding the search index

.PARAMETER Environment
    Target environment: 'production' or 'development' (default: development)

.PARAMETER TotalRecords
    Maximum number of records to index (default: 100)

.PARAMETER BatchSize
    Records per batch (default: 10)

.EXAMPLE
    .\reindex.ps1 -Environment production
    
.EXAMPLE
    .\reindex.ps1 -Environment development -TotalRecords 150

.NOTES
    Author: CV Assistant Team
    Last Updated: November 2025
#>

param(
    [ValidateSet('production', 'development')]
    [string]$Environment = 'development',
    
    [int]$TotalRecords = 100,
    
    [int]$BatchSize = 10
)

$ErrorActionPreference = 'Stop'

# Configuration
$workerUrls = @{
    'production'  = 'https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}'
    'development' = 'https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}'
}

$WorkerUrl = $workerUrls[$Environment]

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           CV Assistant - Vector Re-indexing                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Environment:   $Environment" -ForegroundColor White
Write-Host "  Worker URL:    $WorkerUrl" -ForegroundColor Gray
Write-Host "  Total Records: $TotalRecords" -ForegroundColor Gray
Write-Host "  Batch Size:    $BatchSize" -ForegroundColor Gray
Write-Host ""

# Pre-flight check
Write-Host "[1/4] Pre-flight checks..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$WorkerUrl/health" -Method GET -TimeoutSec 10
    if ($health.status -eq 'healthy') {
        Write-Host "  ✓ Worker is healthy" -ForegroundColor Green
        Write-Host "    Database: $($health.database)" -ForegroundColor Gray
    } else {
        throw "Worker unhealthy: $($health | ConvertTo-Json -Compress)"
    }
} catch {
    Write-Host "  ✗ Worker health check failed: $_" -ForegroundColor Red
    exit 1
}

# Get current vector count
Write-Host ""
Write-Host "[2/4] Checking current index state..." -ForegroundColor Yellow
try {
    $vectorInfo = npx wrangler vectorize info cv-skills-index 2>&1 | Out-String
    # Parse the table output - vectorCount is the second numeric column
    if ($vectorInfo -match '\│\s*768\s*\│\s*(\d+)\s*\│') {
        $currentCount = $matches[1]
        Write-Host "  Current vectors: $currentCount" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Could not get vector count (non-critical)" -ForegroundColor Gray
}

# Run indexing
Write-Host ""
Write-Host "[3/4] Running indexing..." -ForegroundColor Yellow
Write-Host ""

$env:WORKER_URL = $WorkerUrl
$env:TOTAL_RECORDS = $TotalRecords.ToString()
$env:BATCH_SIZE = $BatchSize.ToString()

try {
    npm run index:remote
} catch {
    Write-Host ""
    Write-Host "  ✗ Indexing failed: $_" -ForegroundColor Red
    exit 1
}

# Verify
Write-Host ""
Write-Host "[4/4] Verifying index..." -ForegroundColor Yellow
Start-Sleep -Seconds 10  # Wait for Vectorize eventual consistency

try {
    $vectorInfo = npx wrangler vectorize info cv-skills-index 2>&1 | Out-String
    # Parse the table output - vectorCount is the second numeric column after 768
    if ($vectorInfo -match '\│\s*768\s*\│\s*(\d+)\s*\│') {
        $newCount = $matches[1]
        Write-Host "  ✓ Vector count: $newCount" -ForegroundColor Green
    }
    
    # Check D1 count
    $d1Result = npx wrangler d1 execute cv_assistant_db --remote --command "SELECT COUNT(*) as cnt FROM technology" 2>&1 | Out-String
    if ($d1Result -match '"cnt":\s*(\d+)') {
        $d1Count = $matches[1]
        Write-Host "  ✓ D1 records: $d1Count" -ForegroundColor Green
        
        if ($newCount -eq $d1Count) {
            Write-Host ""
            Write-Host "  ✓ Counts match! Index is complete." -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "  ⚠ Counts differ. Consider re-running with higher TotalRecords." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  Could not verify (non-critical): $_" -ForegroundColor Gray
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    Indexing Complete!                       ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Test with: https://josej-alvarezm.com" -ForegroundColor Cyan
Write-Host "  Query: 'Do you have experience with AWS and GCP?'" -ForegroundColor Cyan
Write-Host ""
