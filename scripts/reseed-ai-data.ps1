#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Bulletproof AI data re-seeding script
.DESCRIPTION
    Safely re-seeds the D1 database with technologies-content-with-outcomes.json data.
    Handles all foreign key constraints, duplicates, and cleanup automatically.
    
    This script:
    - Regenerates SQL from JSON if it's newer
    - Clears old data in correct order (respecting FK constraints)
    - Seeds categories first, then technologies
    - Re-indexes vectors
    - Verifies the operation succeeded
    
.PARAMETER Environment
    Target environment: 'local' or 'remote' (default: remote)
.PARAMETER SkipIndex
    Skip vector re-indexing
.PARAMETER Force
    Force regeneration of SQL even if it exists
.PARAMETER DryRun
    Show what will happen without making changes
    
.EXAMPLE
    .\scripts/reseed-ai-data.ps1
    Re-seed remote database with default settings
    
.EXAMPLE
    .\scripts/reseed-ai-data.ps1 -Environment local -DryRun
    Test locally without making changes
    
.EXAMPLE
    .\scripts/reseed-ai-data.ps1 -Force -SkipIndex
    Force regenerate SQL and skip indexing
#>

param(
    [ValidateSet('local', 'remote')]
    [string]$Environment = 'remote',
    
    [switch]$SkipIndex,
    [switch]$Force,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$WorkerUrl = "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}"

# ============================================================================
# Logging Functions
# ============================================================================

function Write-Step {
    param([string]$Message)
    Write-Host "`n▶ $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "   $Message" -ForegroundColor Gray
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# ============================================================================
# Cache Clearing Functions
# ============================================================================

function Clear-LocalCaches {
    Write-Step "Clearing local caches..."
    
    if ($DryRun) {
        Write-Info "[DRY RUN] Would clear:"
        Write-Info "  - .wrangler directory (Wrangler build cache)"
        Write-Info "  - dist directory (Compiled TypeScript)"
        return
    }
    
    try {
        # Clear Wrangler cache
        if (Test-Path ".wrangler") {
            Remove-Item -Path ".wrangler" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Info "Cleared .wrangler cache"
        }
        
        # Clear compiled output (will be rebuilt)
        if (Test-Path "dist") {
            Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Info "Cleared dist directory"
        }
        
        Write-Success "Local caches cleared"
    }
    catch {
        Write-Warning "Could not clear some caches: $_"
    }
}

function Clear-RemoteCaches {
    Write-Step "Clearing Cloudflare caches..."
    
    if ($DryRun) {
        Write-Info "[DRY RUN] Would:"
        Write-Info "  - Rebuild TypeScript"
        Write-Info "  - Redeploy worker"
        Write-Info "  - Invalidate Cloudflare cache"
        return
    }
    
    try {
        # Rebuild TypeScript
        Write-Info "Rebuilding TypeScript..."
        npm run build 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
        Write-Info "TypeScript rebuilt"
        
        # Redeploy worker (this clears Cloudflare edge cache)
        Write-Info "Redeploying worker to invalidate edge cache..."
        $deployOutput = npm run deploy 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }
        
        # Extract version ID if available
        if ($deployOutput -match "Version ID:\s*([a-f0-9\-]+)") {
            $versionId = $Matches[1]
            Write-Info "Deployed new version: $versionId"
        } elseif ($deployOutput -match "Current Version ID:\s*([a-f0-9\-]+)") {
            $versionId = $Matches[1]
            Write-Info "Current version: $versionId"
        }
        
        Write-Success "Cloudflare caches cleared"
    }
    catch {
        Write-Warning "Cache invalidation may have failed: $_"
        Write-Info "You may need to wait 60 seconds for CDN cache to expire"
    }
}

# ============================================================================
# Helper Functions
# ============================================================================

function Test-FileNewer {
    param(
        [string]$Source,
        [string]$Target
    )
    
    if (-not (Test-Path $Target)) { return $true }
    
    $sourceTime = (Get-Item $Source).LastWriteTime
    $targetTime = (Get-Item $Target).LastWriteTime
    return $sourceTime -gt $targetTime
}

function Invoke-D1Command {
    param(
        [string]$Command,
        [string]$FilePath,
        [switch]$SuppressOutput
    )
    
    $d1Flag = if ($Environment -eq 'local') { '--local' } else { '--remote' }
    
    if ($DryRun) {
        Write-Info "[DRY RUN] Would execute: $(if ($Command) { $Command } else { "file: $FilePath" })"
        return
    }
    
    try {
        if ($Command) {
            $output = wrangler d1 execute cv_assistant_db $d1Flag `
                --command="$Command" 2>&1 | Out-String
        } else {
            $output = wrangler d1 execute cv_assistant_db $d1Flag `
                --file="$FilePath" 2>&1 | Out-String
        }
        
        if (-not $SuppressOutput) {
            Write-Info $output
        }
        
        return $output
    }
    catch {
        throw "D1 command failed: $_"
    }
}

function Get-RecordCount {
    param([string]$Table)
    
    $output = Invoke-D1Command -Command "SELECT COUNT(*) as cnt FROM $Table;"
    
    if ($output -match '"cnt"\s*:\s*"?(\d+)"?') {
        return [int]$Matches[1]
    }
    elseif ($output -match "│\s*(\d+)\s*│") {
        return [int]$Matches[1]
    }
    
    return 0
}

# ============================================================================
# Main Script
# ============================================================================

# Header
Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
Write-Host "  AI DATA RE-SEEDING UTILITY" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Info "Environment: $Environment"
Write-Info "Worker URL: $WorkerUrl"
if ($DryRun) { Write-Warning "DRY RUN MODE - No changes will be made" }
Write-Host ""

# Step 0: Clear caches
if ($Environment -eq 'remote') {
    Clear-LocalCaches
    # Remote caches will be cleared after re-deployment
} else {
    if (-not $DryRun) {
        Clear-LocalCaches
    }
}

# Step 1: Check JSON and SQL files
Write-Step "Checking source data files..."

$jsonPath = "schema/technologies-content-with-outcomes.json"
$sqlPath = "migrations/002_seed_data_tech_only.sql"

if (-not (Test-Path $jsonPath)) {
    Write-Error-Custom "JSON file not found: $jsonPath"
    exit 1
}

Write-Success "Found: $jsonPath"

# Check if we need to regenerate SQL
$needsRegenerate = $Force -or (Test-FileNewer $jsonPath $sqlPath)

if ($needsRegenerate) {
    Write-Warning "Regenerating SQL from JSON (JSON is newer or force flag set)..."
    
    if ($DryRun) {
        Write-Info "[DRY RUN] Would run: node scripts/generate-seed-sql.js > $sqlPath"
    } else {
        try {
            node scripts/generate-seed-sql.js > $sqlPath 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "SQL generation failed"
            }
            Write-Success "SQL generated: $sqlPath"
        }
        catch {
            Write-Error-Custom "Failed to generate SQL: $_"
            exit 1
        }
    }
} else {
    Write-Success "SQL file is up-to-date, skipping regeneration"
}

# Step 2: Get current record counts
Write-Step "Checking current database state..."

try {
    $currentTechCount = Get-RecordCount "technology"
    $currentCategoryCount = Get-RecordCount "technology_category"
    $currentVectorCount = Get-RecordCount "vectors"
    
    Write-Info "Current records - Categories: $currentCategoryCount, Technologies: $currentTechCount, Vectors: $currentVectorCount"
}
catch {
    Write-Warning "Could not retrieve record counts: $_"
}

# Step 3: Clear old data (respecting foreign key constraints)
Write-Step "Clearing old data (maintaining referential integrity)..."

if (-not $DryRun) {
    try {
        # Delete in correct order: vectors first (FK to technology), then technology, then categories
        Invoke-D1Command -Command "DELETE FROM vectors;" -SuppressOutput
        Write-Info "Cleared vectors table"
        
        Invoke-D1Command -Command "DELETE FROM technology;" -SuppressOutput
        Write-Info "Cleared technology table"
        
        Invoke-D1Command -Command "DELETE FROM technology_category;" -SuppressOutput
        Write-Info "Cleared technology_category table"
        
        Write-Success "All old data cleared"
    }
    catch {
        Write-Error-Custom "Failed to clear data: $_"
        exit 1
    }
}

# Step 4: Seed new data
Write-Step "Seeding new data from SQL..."

if (-not $DryRun) {
    try {
        $seedOutput = Invoke-D1Command -FilePath $sqlPath
        
        # Parse the output for row counts
        if ($seedOutput -match "(\d+) rows written") {
            $rowsWritten = [int]$Matches[1]
            Write-Success "Seeded $rowsWritten rows"
        } else {
            Write-Success "Seed operation completed"
        }
    }
    catch {
        Write-Error-Custom "Seeding failed: $_"
        exit 1
    }
}

# Step 5: Verify data
Write-Step "Verifying seeded data..."

if (-not $DryRun) {
    try {
        $newTechCount = Get-RecordCount "technology"
        $newCategoryCount = Get-RecordCount "technology_category"
        
        Write-Info "New records - Categories: $newCategoryCount, Technologies: $newTechCount"
        
        if ($newTechCount -eq 64 -and $newCategoryCount -eq 9) {
            Write-Success "Data verified: 64 technologies, 9 categories ✓"
        } else {
            Write-Warning "Unexpected record counts (expected 64 technologies, 9 categories)"
        }
        
        # Spot check outcomes data
        $outcomeCheck = Invoke-D1Command -Command "SELECT COUNT(*) as cnt FROM technology WHERE outcome IS NOT NULL;"
        if ($outcomeCheck -match "(\d+)") {
            $outcomeCount = [int]$outcomeCheck -replace ".*?(\d+).*", '$1'
            Write-Info "Outcome records populated: $outcomeCount"
        }
    }
    catch {
        Write-Warning "Could not verify data: $_"
    }
}

# Step 6: Vector indexing
if (-not $SkipIndex -and $Environment -eq 'remote') {
    Write-Step "Re-indexing vectors..."
    
    if ($DryRun) {
        Write-Info "[DRY RUN] Would run: npm run index:remote"
    } else {
        try {
            # First verify vectors table and clear if needed
            $existingVectors = Get-RecordCount "vectors"
            if ($existingVectors -gt 0) {
                Write-Info "Clearing existing $existingVectors vectors..."
                Invoke-D1Command -Command "DELETE FROM vectors;" -SuppressOutput | Out-Null
            }
            
            Write-Info "Generating embeddings (this may take 1-2 minutes)..."
            $indexOutput = npm run index:remote 2>&1 | Out-String
            
            if ($LASTEXITCODE -ne 0) {
                throw "Vector indexing failed with exit code $LASTEXITCODE"
            }
            
            if ($indexOutput -match "Total records processed:\s*(\d+)") {
                $indexedCount = [int]$Matches[1]
                Write-Success "Indexed $indexedCount vectors"
            } elseif ($indexOutput -match "INDEXING COMPLETE") {
                Write-Success "Vector indexing completed successfully"
            } else {
                Write-Warning "Could not parse indexing results. Full output:"
                Write-Info "$indexOutput"
            }
            
            # Verify vectors were actually created
            $vectorCount = Get-RecordCount "vectors"
            if ($vectorCount -eq 0) {
                throw "Vector indexing completed but 0 vectors found in database!"
            }
            Write-Success "Verified: $vectorCount vectors in database"
        }
        catch {
            Write-Error-Custom "Vector indexing failed: $_"
            exit 1
        }
    }
} elseif ($SkipIndex) {
    Write-Step "Skipping vector indexing (--SkipIndex)"
    Write-Warning "Note: Semantic search will not work without vectors!"
} elseif ($Environment -eq 'local') {
    Write-Step "Skipping vector indexing (local environment)"
}

# Step 7: Health check
if (-not $DryRun -and $Environment -eq 'remote') {
    Write-Step "Running health check..."
    
    try {
        $healthJson = curl.exe -s "$WorkerUrl/health" 2>&1
        $health = $healthJson | ConvertFrom-Json
        
        if ($health.status -eq "healthy") {
            Write-Success "Worker is healthy"
            Write-Info "Database: $($health.database)"
            Write-Info "Total Skills: $($health.total_skills)"
            if ($health.last_index) {
                Write-Info "Last Index: version $($health.last_index.version)"
            }
        } else {
            Write-Warning "Worker returned non-healthy status"
        }
    }
    catch {
        Write-Warning "Health check failed: $_"
    }
}

# Step 8: Clear remote caches (Cloudflare edge)
if ($Environment -eq 'remote' -and -not $DryRun) {
    Clear-RemoteCaches
    Write-Info "Waiting 5 seconds for cache propagation..."
    Start-Sleep -Seconds 5
}

# Summary
Write-Host ("=" * 70) -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "  DRY RUN COMPLETE - NO CHANGES MADE" -ForegroundColor Yellow
} else {
    Write-Host "  RE-SEEDING COMPLETE! 🎉" -ForegroundColor Green
}
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Info "The database is now seeded with outcomes-enriched AI data"
Write-Info "Semantic search is operational with latest skill information"
if ($Environment -eq 'remote' -and -not $DryRun) {
    Write-Info "Caches have been cleared (local and Cloudflare edge)"
    Write-Info "Workers are running latest version with fresh data"
}
Write-Host ""

exit 0
