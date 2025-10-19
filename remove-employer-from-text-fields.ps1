# Remove employer names from text fields, keeping them only in the "employer" JSON field
# This ensures clean data separation between skill descriptions and employer attribution

$filePath = "d:\Code\MyAIAgent\schema\technologies-content-with-outcomes.json"

# Read the JSON file
$json = Get-Content -Path $filePath -Raw | ConvertFrom-Json

# Employer names to remove from text fields
$employerPatterns = @(
    ' at CCHQ',
    ' and Wairbut',
    ' at Wairbut',
    ' for Independent Production',
    ' at Independent Production',
    ' for Prototype Development',
    ' at Prototype Development'
)

# Process each category
$updatedCount = 0

foreach ($category in $json.technologyCategories) {
    foreach ($tech in $category.technologies) {
        # Process each text field that shouldn't contain employer names
        foreach ($field in @('summary', 'action', 'effect', 'outcome', 'embedding_text')) {
            if ($tech.$field) {
                $originalValue = $tech.$field
                
                # Remove employer patterns
                foreach ($pattern in $employerPatterns) {
                    $tech.$field = $tech.$field -replace [regex]::Escape($pattern), ''
                }
                
                # Track changes
                if ($tech.$field -ne $originalValue) {
                    $updatedCount++
                }
            }
        }
    }
}

# Convert back to JSON and write to file
$json | ConvertTo-Json -Depth 100 | Set-Content -Path $filePath -Encoding UTF8

Write-Host "`n=== EMPLOYER REMOVAL COMPLETE ===" -ForegroundColor Green
Write-Host "`nFile: technologies-content-with-outcomes.json" -ForegroundColor Cyan
Write-Host "Total field values updated: $updatedCount" -ForegroundColor Yellow
Write-Host "`nEmployer names removed from:" -ForegroundColor Yellow
Write-Host "  - summary" -ForegroundColor White
Write-Host "  - action" -ForegroundColor White
Write-Host "  - effect" -ForegroundColor White
Write-Host "  - outcome" -ForegroundColor White
Write-Host "  - embedding_text" -ForegroundColor White
Write-Host "`nEmployer names are now ONLY in the 'employer' field" -ForegroundColor Green
