#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Synchronize D1 skills database with Vectorize index
    
.DESCRIPTION
    This script automates the process of indexing new or updated skills from D1 into Vectorize.
    Can be run manually or scheduled via Task Scheduler/cron.
    
.PARAMETER Environment
    Target environment: 'dev' or 'production' (default: 'dev')
    
.PARAMETER WatchMode
    Enable continuous watching for changes (default: false)
    
.PARAMETER IntervalMinutes
    Minutes between sync checks in watch mode (default: 60)
    
.EXAMPLE
    .\sync-skills.ps1 -Environment production
    
.EXAMPLE
    .\sync-skills.ps1 -Environment production -WatchMode -IntervalMinutes 30
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'production')]
    [string]$Environment = 'dev',
    
    [Parameter(Mandatory=$false)]
    [switch]$WatchMode,
    
    [Parameter(Mandatory=$false)]
    [int]$IntervalMinutes = 60
)

# Configuration
$WORKER_URLS = @{
    'dev' = 'https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}'
    'production' = 'https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}'
}

$WORKER_URL = $WORKER_URLS[$Environment]
$LOG_FILE = "sync-skills-$(Get-Date -Format 'yyyyMMdd').log"

# Logging function
function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage
}

# Check if wrangler is available
function Test-WranglerAvailable {
    try {
        $null = Get-Command npx -ErrorAction Stop
        return $true
    } catch {
        Write-Log "npx command not found. Please install Node.js." -Level 'ERROR'
        return $false
    }
}

# Get last indexed count from D1
function Get-IndexedCount {
    try {
        Write-Log "Querying D1 for indexed count..."
        $envFlag = if ($Environment -eq 'production') { '--env production' } else { '' }
        
        $query = "SELECT COUNT(*) as count FROM technology"
        $result = Invoke-Expression "npx wrangler d1 execute cv_assistant_db $envFlag --command `"$query`"" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            # Parse wrangler output (JSON format)
            $jsonMatch = $result | Select-String -Pattern '\[.*\]' | Select-Object -First 1
            if ($jsonMatch) {
                $data = $jsonMatch.Matches[0].Value | ConvertFrom-Json
                return $data[0].count
            }
        }
        
        Write-Log "Failed to query D1: $result" -Level 'WARN'
        return 0
    } catch {
        Write-Log "Error querying D1: $_" -Level 'ERROR'
        return 0
    }
}

# Trigger indexing via worker endpoint
function Invoke-Indexing {
    try {
        Write-Log "Triggering indexing at $WORKER_URL/index..."
        
        $body = @{
            type = 'technology'
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$WORKER_URL/index" `
            -Method POST `
            -Headers @{'Content-Type' = 'application/json'} `
            -Body $body `
            -TimeoutSec 120
        
        if ($response.success) {
            Write-Log "Indexing completed: $($response.processed) items processed (version $($response.version))"
            return $true
        } else {
            Write-Log "Indexing failed: $($response.message)" -Level 'ERROR'
            return $false
        }
    } catch {
        Write-Log "Error triggering indexing: $_" -Level 'ERROR'
        Write-Log "Response: $($_.Exception.Response)" -Level 'ERROR'
        return $false
    }
}

# Check Vectorize index count
function Get-VectorizeCount {
    try {
        Write-Log "Querying Vectorize index count..."
        $envFlag = if ($Environment -eq 'production') { '--env production' } else { '' }
        
        $result = Invoke-Expression "npx wrangler vectorize info cv-skills-index $envFlag" 2>&1
        
        # Parse output for record count
        $countMatch = $result | Select-String -Pattern 'records:\s+(\d+)' 
        if ($countMatch) {
            return [int]$countMatch.Matches[0].Groups[1].Value
        }
        
        Write-Log "Could not parse Vectorize count" -Level 'WARN'
        return 0
    } catch {
        Write-Log "Error querying Vectorize: $_" -Level 'ERROR'
        return 0
    }
}

# Main sync function
function Start-Sync {
    Write-Log "=== Starting sync for $Environment environment ==="
    
    if (-not (Test-WranglerAvailable)) {
        Write-Log "Wrangler not available, exiting" -Level 'ERROR'
        exit 1
    }
    
    # Get current counts
    $d1Count = Get-IndexedCount
    $vectorizeCount = Get-VectorizeCount
    
    Write-Log "D1 records: $d1Count, Vectorize records: $vectorizeCount"
    
    # Check if sync is needed
    if ($d1Count -eq $vectorizeCount -and $vectorizeCount -gt 0) {
        Write-Log "Indexes are in sync, no action needed"
        return $true
    }
    
    Write-Log "Sync needed: D1=$d1Count, Vectorize=$vectorizeCount"
    
    # Trigger indexing
    $success = Invoke-Indexing
    
    if ($success) {
        Write-Log "Sync completed successfully"
        
        # Verify sync
        Start-Sleep -Seconds 2
        $newVectorizeCount = Get-VectorizeCount
        Write-Log "Post-sync Vectorize count: $newVectorizeCount"
        
        return $true
    } else {
        Write-Log "Sync failed" -Level 'ERROR'
        return $false
    }
}

# Main execution
try {
    Write-Log "Script started with Environment=$Environment, WatchMode=$WatchMode, IntervalMinutes=$IntervalMinutes"
    
    if ($WatchMode) {
        Write-Log "Watch mode enabled, checking every $IntervalMinutes minutes"
        Write-Log "Press Ctrl+C to stop"
        
        while ($true) {
            Start-Sync
            Write-Log "Waiting $IntervalMinutes minutes until next sync..."
            Start-Sleep -Seconds ($IntervalMinutes * 60)
        }
    } else {
        # Single sync
        $result = Start-Sync
        exit ($result ? 0 : 1)
    }
} catch {
    Write-Log "Fatal error: $_" -Level 'ERROR'
    exit 1
}
