<#
.SYNOPSIS
    Add a new technology to the CV Assistant database.

.DESCRIPTION
    Interactive helper to add new technologies to D1 with proper
    outcome-driven fields for optimal semantic search.

.PARAMETER Name
    Technology name (required)

.PARAMETER Years
    Years of experience (required)

.PARAMETER Category
    Category ID (1-9, optional)

.PARAMETER Summary
    What you know about it

.PARAMETER Action
    What you did with it

.PARAMETER Outcome
    Business result achieved

.PARAMETER AutoIndex
    Automatically re-index after adding (default: true)

.EXAMPLE
    .\add-technology.ps1 -Name "Redis" -Years 4

.EXAMPLE
    .\add-technology.ps1 -Name "Kafka" -Years 2 -Category 3 -AutoIndex $false
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Name,
    
    [Parameter(Mandatory=$true)]
    [int]$Years,
    
    [ValidateRange(1,9)]
    [int]$Category = 0,
    
    [string]$Summary = "",
    [string]$Action = "",
    [string]$Effect = "",
    [string]$Outcome = "",
    [string]$Project = "",
    
    [bool]$AutoIndex = $true
)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           Add Technology to CV Assistant                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Interactive prompts for missing fields
if (-not $Summary) {
    Write-Host "What do you know about $Name? (Summary)" -ForegroundColor Yellow
    Write-Host "Example: 'In-memory caching and pub/sub messaging'" -ForegroundColor Gray
    $Summary = Read-Host "Summary"
}

if (-not $Action) {
    Write-Host ""
    Write-Host "What did you DO with $Name? (Action)" -ForegroundColor Yellow
    Write-Host "Example: 'Implemented distributed caching layer'" -ForegroundColor Gray
    $Action = Read-Host "Action"
}

if (-not $Effect) {
    Write-Host ""
    Write-Host "What was the TECHNICAL impact? (Effect - optional)" -ForegroundColor Yellow
    Write-Host "Example: 'Reduced latency from 200ms to 15ms'" -ForegroundColor Gray
    $Effect = Read-Host "Effect (or press Enter to skip)"
}

if (-not $Outcome) {
    Write-Host ""
    Write-Host "What was the BUSINESS result? (Outcome)" -ForegroundColor Yellow
    Write-Host "Example: 'Enabled 10x traffic scaling'" -ForegroundColor Gray
    $Outcome = Read-Host "Outcome"
}

if (-not $Project) {
    Write-Host ""
    Write-Host "Related project name? (optional)" -ForegroundColor Yellow
    $Project = Read-Host "Project (or press Enter to skip)"
}

if ($Category -eq 0) {
    Write-Host ""
    Write-Host "Category (1-9):" -ForegroundColor Yellow
    Write-Host "  1=Architecture  2=Cloud  3=Database  4=Language" -ForegroundColor Gray
    Write-Host "  5=Framework  6=DevOps  7=Security  8=AI/ML  9=Practices" -ForegroundColor Gray
    $catInput = Read-Host "Category (or press Enter for none)"
    if ($catInput) { $Category = [int]$catInput }
}

# Build experience string
$Experience = "$Years years hands-on experience"

# Escape single quotes for SQL
$Name = $Name.Replace("'", "''")
$Summary = $Summary.Replace("'", "''")
$Action = $Action.Replace("'", "''")
$Effect = $Effect.Replace("'", "''")
$Outcome = $Outcome.Replace("'", "''")
$Project = $Project.Replace("'", "''")
$Experience = $Experience.Replace("'", "''")

# Build SQL
$categoryValue = if ($Category -gt 0) { $Category.ToString() } else { "NULL" }
$effectValue = if ($Effect) { "'$Effect'" } else { "NULL" }
$projectValue = if ($Project) { "'$Project'" } else { "NULL" }

$sql = @"
INSERT INTO technology (
  name, experience, experience_years, level, category_id,
  summary, action, effect, outcome, related_project
) VALUES (
  '$Name',
  '$Experience',
  $Years,
  'Professional',
  $categoryValue,
  '$Summary',
  '$Action',
  $effectValue,
  '$Outcome',
  $projectValue
);
"@

Write-Host ""
Write-Host "Generated SQL:" -ForegroundColor Cyan
Write-Host $sql -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "Execute this SQL? (Y/n)"
if ($confirm -eq 'n' -or $confirm -eq 'N') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Execute SQL
Write-Host ""
Write-Host "Inserting into D1..." -ForegroundColor Yellow
try {
    $sqlOneLine = $sql -replace "`r`n", " " -replace "`n", " "
    npx wrangler d1 execute cv_assistant_db --remote --command "$sqlOneLine"
    Write-Host "✓ Technology added successfully!" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to insert: $_" -ForegroundColor Red
    exit 1
}

# Get the new ID
Write-Host ""
Write-Host "Verifying..." -ForegroundColor Yellow
npx wrangler d1 execute cv_assistant_db --remote --command "SELECT id, name FROM technology ORDER BY id DESC LIMIT 1"

# Auto-index
if ($AutoIndex) {
    Write-Host ""
    Write-Host "Re-indexing vectors..." -ForegroundColor Yellow
    & "$PSScriptRoot\reindex.ps1" -Environment production
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    Technology Added!                        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
