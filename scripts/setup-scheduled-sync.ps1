# Windows Task Scheduler Setup for Skills Sync
# Run this script as Administrator to create a scheduled task

# Configuration
$TaskName = "Sync-CVAssistant-Skills"
$ScriptPath = Join-Path $PSScriptRoot "sync-skills.ps1"
$Environment = "production"  # Change to 'dev' if needed

# Task runs every 6 hours
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 6)

# PowerShell action
$Action = New-ScheduledTaskAction -Execute "pwsh.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" -Environment $Environment"

# Run whether user is logged on or not
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U

# Task settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Create or update the task
try {
    # Check if task exists
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    
    if ($existingTask) {
        Write-Host "Task '$TaskName' already exists. Updating..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    
    # Register new task
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Trigger $Trigger `
        -Action $Action `
        -Principal $Principal `
        -Settings $Settings `
        -Description "Automatically sync CV Assistant skills to Vectorize index every 6 hours"
    
    Write-Host "`n✅ Task '$TaskName' created successfully!" -ForegroundColor Green
    Write-Host "`nTask Details:" -ForegroundColor Cyan
    Write-Host "  - Runs every: 6 hours"
    Write-Host "  - Environment: $Environment"
    Write-Host "  - Script: $ScriptPath"
    Write-Host "`nTo view the task: taskschd.msc"
    Write-Host "To run manually: .\sync-skills.ps1 -Environment $Environment"
    
} catch {
    Write-Host "`n❌ Failed to create scheduled task: $_" -ForegroundColor Red
    Write-Host "`nPlease run this script as Administrator" -ForegroundColor Yellow
    exit 1
}
