#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Automated deployment script for CV Assistant Worker
.DESCRIPTION
    Handles schema updates, data seeding, vector indexing, and deployment.
    This script provides a one-command solution for deploying the entire CV assistant.
.PARAMETER Environment
    Target environment: 'local' or 'remote' (default: remote)
.PARAMETER SkipBuild
    Skip TypeScript build step
.PARAMETER SkipIndex
    Skip vector indexing step
.PARAMETER SkipSeed
    Skip database seeding (use if data already exists)
.PARAMETER Force
    Force re-seeding and re-indexing even if data exists
.EXAMPLE
    .\deploy-cv-assistant.ps1
    Full deployment to remote (production)
.EXAMPLE
    .\deploy-cv-assistant.ps1 -Environment local -SkipIndex
    Deploy to local for testing, skip indexing
.EXAMPLE
    .\deploy-cv-assistant.ps1 -SkipBuild -SkipSeed
    Quick redeploy (just deploy and index)
.EXAMPLE
    .\deploy-cv-assistant.ps1 -Force
    Force full redeployment with fresh data
#>

param(
    [ValidateSet('local', 'remote')]
    [string]$Environment = 'remote',
    
    [switch]$SkipBuild,
    [switch]$SkipIndex,
    [switch]$SkipSeed,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$WorkerUrl = "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}"

function Write-Step {
    param([string]$Message)
    Write-Host "`n$Message" -ForegroundColor Cyan
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

# Header
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "  CV ASSISTANT - AUTOMATED DEPLOYMENT" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Info "Environment: $Environment"
Write-Info "Worker URL: $WorkerUrl"
Write-Host ""

# Determine D1 flag
$d1Flag = if ($Environment -eq 'local') { '--local' } else { '--remote' }

# Step 1: Build TypeScript
if (-not $SkipBuild) {
    Write-Step "📦 Step 1: Building TypeScript..."
    try {
        npm run build 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
        Write-Success "Build complete"
    }
    catch {
        Write-Error "❌ Build failed: $_"
        exit 1
    }
} else {
    Write-Step "📦 Step 1: Skipping build (--SkipBuild)"
}

# Step 2: Deploy Worker
Write-Step "🚀 Step 2: Deploying Worker to Cloudflare..."
try {
    $deployOutput = npm run deploy 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "Deployment failed" }
    
    # Extract version ID if available
    if ($deployOutput -match "Version ID: ([a-f0-9\-]+)") {
        $versionId = $Matches[1]
        Write-Success "Deployment complete (Version: $versionId)"
    } else {
        Write-Success "Deployment complete"
    }
}
catch {
    Write-Error "❌ Deployment failed: $_"
    exit 1
}

# Step 3: Check and update database schema
Write-Step "🗄️  Step 3: Checking database schema..."
try {
    $schemaCheck = wrangler d1 execute cv_assistant_db $d1Flag `
        --command="SELECT COUNT(*) as cnt FROM pragma_table_info('technology') WHERE name IN ('action', 'effect', 'outcome', 'related_project');" 2>&1 | Out-String
    
    if ($schemaCheck -match '"cnt"\s*:\s*"?4"?' -or $schemaCheck -match "│\s*4\s*│") {
        Write-Success "Schema already up to date (4 outcome fields present)"
    } else {
        Write-Warning "Schema needs update, applying migration..."
        wrangler d1 execute cv_assistant_db $d1Flag --file="migrations/003_add_outcome_fields.sql" | Out-Null
        Write-Success "Schema migration applied"
    }
}
catch {
    Write-Error "❌ Schema check/update failed: $_"
    exit 1
}

# Step 4: Check and seed database
Write-Step "📊 Step 4: Checking technology records..."

if (-not $SkipSeed) {
    try {
        $dataCheck = wrangler d1 execute cv_assistant_db $d1Flag `
            --command="SELECT COUNT(*) as cnt FROM technology;" 2>&1 | Out-String
        
        $needsSeed = $false
        
        if ($Force) {
            Write-Warning "Force mode: Re-seeding database..."
            $needsSeed = $true
        }
        elseif ($dataCheck -match '"cnt"\s*:\s*"?64"?' -or $dataCheck -match "│\s*64\s*│") {
            Write-Success "Data already populated (64 records)"
        }
        elseif ($dataCheck -match '"cnt"\s*:\s*"?0"?' -or $dataCheck -match "│\s*0\s*│") {
            Write-Warning "Database is empty, seeding..."
            $needsSeed = $true
        }
        else {
            Write-Warning "Unexpected record count, re-seeding..."
            $needsSeed = $true
        }
        
        if ($needsSeed) {
            # Clear existing data
            Write-Info "Clearing existing data..."
            wrangler d1 execute cv_assistant_db $d1Flag `
                --command="DELETE FROM vectors; DELETE FROM technology;" 2>&1 | Out-Null
            
            # Seed new data
            Write-Info "Inserting 64 technology records..."
            wrangler d1 execute cv_assistant_db $d1Flag `
                --file="migrations/002_seed_data_tech_only.sql" 2>&1 | Out-Null
            
            Write-Success "Database seeded successfully"
        }
    }
    catch {
        Write-Error "❌ Database seeding failed: $_"
        exit 1
    }
} else {
    Write-Step "📊 Step 4: Skipping database seed (--SkipSeed)"
}

# Step 5: Vector Indexing
if (-not $SkipIndex -and $Environment -eq 'remote') {
    Write-Step "🔢 Step 5: Vector indexing..."
    
    try {
        $vectorCheck = wrangler d1 execute cv_assistant_db --remote `
            --command="SELECT COUNT(*) as cnt FROM vectors;" 2>&1 | Out-String
        
        $needsIndex = $false
        
        if ($Force) {
            Write-Warning "Force mode: Re-indexing vectors..."
            $needsIndex = $true
        }
        elseif ($vectorCheck -match '"cnt"\s*:\s*"?64"?' -or $vectorCheck -match "│\s*64\s*│") {
            Write-Success "Vectors already indexed (64 embeddings)"
        }
        else {
            Write-Warning "Vectors missing or incomplete, indexing..."
            $needsIndex = $true
        }
        
        if ($needsIndex) {
            # Clear stale vectors and metadata
            Write-Info "Clearing stale vectors..."
            wrangler d1 execute cv_assistant_db --remote `
                --command="DELETE FROM vectors; DELETE FROM index_metadata;" 2>&1 | Out-Null
            
            # Index in batches
            Write-Info "Generating embeddings (this may take 1-2 minutes)..."
            $totalProcessed = 0
            
            for ($offset = 0; $offset -lt 64; $offset += 10) {
                $batch = [Math]::Min(10, 64 - $offset)
                
                Write-Progress -Activity "Indexing Vectors" `
                    -Status "Processing batch: offset=$offset, size=$batch" `
                    -PercentComplete (($offset / 64) * 100)
                
                $body = @{ 
                    type = "technology"
                    batchSize = $batch
                    offset = $offset 
                } | ConvertTo-Json -Compress
                
                $result = curl.exe -s -X POST "$WorkerUrl/index" `
                    -H "Content-Type: application/json" `
                    -d $body | ConvertFrom-Json
                
                if ($result.success -eq $false) {
                    throw "Indexing failed at offset $offset`: $($result.error)"
                }
                
                $totalProcessed += $result.processed
                Write-Info "Batch complete: $($result.processed) records indexed (version $($result.version))"
                
                Start-Sleep -Milliseconds 300
            }
            
            Write-Progress -Activity "Indexing Vectors" -Completed
            Write-Success "All $totalProcessed vectors indexed successfully"
        }
    }
    catch {
        Write-Error "❌ Vector indexing failed: $_"
        exit 1
    }
}
elseif ($SkipIndex) {
    Write-Step "🔢 Step 5: Skipping vector indexing (--SkipIndex)"
}
elseif ($Environment -eq 'local') {
    Write-Step "🔢 Step 5: Skipping vector indexing (local environment)"
    Write-Info "Vector indexing is only performed for remote deployments"
}

# Step 6: Health Check
Write-Step "🏥 Step 6: Running health check..."
try {
    $healthJson = curl.exe -s "$WorkerUrl/health"
    $health = $healthJson | ConvertFrom-Json
    
    if ($health.status -eq "healthy") {
        Write-Success "Worker is healthy"
        Write-Info "Database: $($health.database)"
        Write-Info "Total Skills: $($health.total_skills)"
        if ($health.last_index) {
            Write-Info "Last Index: version $($health.last_index.version), status '$($health.last_index.status)'"
        }
    } else {
        Write-Warning "Worker health check returned non-healthy status"
        Write-Info "Response: $healthJson"
    }
}
catch {
    Write-Warning "Health check failed (worker may still be initializing)"
    Write-Info "Error: $_"
}

# Step 7: Test Query
if ($Environment -eq 'remote') {
    Write-Step "🧪 Step 7: Testing semantic search..."
    
    try {
        $testResult = curl.exe -s "$WorkerUrl/query?q=microservices+experience" 2>&1
        
        if ($testResult -match '"error":\s*"Forbidden"') {
            Write-Success "Turnstile protection is active (as expected)"
            Write-Info "Queries require valid Turnstile token in production"
        } 
        elseif ($testResult -match '"query"') {
            $parsed = $testResult | ConvertFrom-Json
            Write-Success "Query successful (Turnstile may be disabled)"
            Write-Info "Found $($parsed.results.Count) matching skills"
            if ($parsed.assistantReply) {
                Write-Info "AI response: $($parsed.assistantReply.Substring(0, [Math]::Min(100, $parsed.assistantReply.Length)))..."
            }
        }
        else {
            Write-Warning "Query test returned unexpected result"
            Write-Info "Response: $($testResult.Substring(0, [Math]::Min(200, $testResult.Length)))"
        }
    }
    catch {
        Write-Warning "Query test failed: $_"
    }
} else {
    Write-Step "🧪 Step 7: Skipping query test (local environment)"
}

# Summary
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "  DEPLOYMENT COMPLETE! 🎉" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Info "Production URL: $WorkerUrl"
Write-Info "Environment: $Environment"
Write-Info ""
Write-Info "Next steps:"
Write-Info "  1. Test queries via your chatbot/frontend"
Write-Info "  2. Monitor Cloudflare dashboard for errors"
Write-Info "  3. Review AI responses for quality"
Write-Host ""

# Exit successfully
exit 0
