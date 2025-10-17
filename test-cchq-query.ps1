#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test the improved CCHQ query handling
.DESCRIPTION
    Tests the "skillset used in CCHQ" query to verify project-specific filtering works correctly
#>

$ErrorActionPreference = "Stop"

$WorkerUrl = "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}"

Write-Host "`n=== Testing CCHQ Skillset Query ===" -ForegroundColor Cyan
Write-Host "Query: 'tell me the skillset used in cchq'" -ForegroundColor Yellow
Write-Host ""

# Test the query
$query = "tell me the skillset used in cchq"
$encodedQuery = [System.Web.HttpUtility]::UrlEncode($query)
$url = "$WorkerUrl/query?q=$encodedQuery"

Write-Host "Calling: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Get -ContentType "application/json"
    
    # Display the assistant's reply
    Write-Host "ASSISTANT REPLY:" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host $response.assistantReply -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    
    # Show raw JSON for debugging
    Write-Host "RAW JSON RESPONSE:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor DarkGray
    Write-Host ""
    
    # Validation checks
    Write-Host "VALIDATION CHECKS:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    
    $reply = $response.assistantReply
    
    # Check for issues from the original problem
    $issues = @()
    
    # Check 1: Should NOT mention "7 years" (conflation issue)
    if ($reply -match "7\s+years") {
        $issues += "❌ FAIL: Mentions '7 years' - this is a conflation of different timeframes"
    } else {
        Write-Host "✓ PASS: No conflated '7 years' timeframe" -ForegroundColor Green
    }
    
    # Check 2: Should mention CCHQ explicitly
    if ($reply -match "CCHQ|Conservative") {
        Write-Host "✓ PASS: Mentions CCHQ/Conservative context" -ForegroundColor Green
    } else {
        $issues += "⚠ WARNING: Does not explicitly mention CCHQ"
    }
    
    # Check 3: Should NOT mention "19 years of JavaScript" in CCHQ context
    if ($reply -match "19\s+years.*JavaScript" -or $reply -match "JavaScript.*19\s+years") {
        $issues += "❌ FAIL: Mentions '19 years of JavaScript' - this is total experience, not CCHQ-specific"
    } else {
        Write-Host "✓ PASS: Does not conflate total JavaScript experience (19 years) with CCHQ work" -ForegroundColor Green
    }
    
    # Check 4: Should mention multiple skills (it's a "skillset" question)
    $skillsMatches = [regex]::Matches($reply, "\b(service|architecture|API|JavaScript|TypeScript|Angular|deployment|queue|message)\b")
    if ($skillsMatches.Count -ge 3) {
        Write-Host "✓ PASS: Mentions multiple skills ($($skillsMatches.Count) skill-related terms found)" -ForegroundColor Green
    } else {
        $issues += "⚠ WARNING: Only mentions $($skillsMatches.Count) skill(s) - should synthesize multiple skills for 'skillset' query"
    }
    
    # Check 5: Should include outcome/metrics
    if ($reply -match "\d+%|\d+x|weeks?\s+to\s+days?|faster|reduction|increase") {
        Write-Host "✓ PASS: Includes measurable outcomes/metrics" -ForegroundColor Green
    } else {
        $issues += "⚠ WARNING: No measurable outcomes found"
    }
    
    Write-Host ""
    
    if ($issues.Count -eq 0) {
        Write-Host "🎉 ALL CHECKS PASSED! The response is accurate and well-structured." -ForegroundColor Green
    } else {
        Write-Host "Issues found:" -ForegroundColor Yellow
        foreach ($issue in $issues) {
            Write-Host "  $issue" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception.StackTrace -ForegroundColor DarkRed
    exit 1
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
