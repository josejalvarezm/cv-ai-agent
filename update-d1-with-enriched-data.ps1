# Quick update: Clear data and re-seed with Force flag
Write-Host '🔄 Updating D1 database with enriched data...' -ForegroundColor Cyan
Write-Host ''

# Note: The SQL seed file already has the outcome data
# We just need to force re-seeding

.\scripts\deploy-cv-assistant.ps1 -Force
