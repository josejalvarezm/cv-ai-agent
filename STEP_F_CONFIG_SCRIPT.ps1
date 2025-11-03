# Step F: Configure Wrangler Secrets for AWS SQS Integration
# This script sets up the 4 required secrets for the Cloudflare Worker to connect to AWS SQS

Write-Host "🚀 Step F: Configuring Wrangler Secrets for SQS Integration" -ForegroundColor Cyan
Write-Host ""

# Verify cv-ai-agent directory
$workerDir = "d:\Code\MyCV\cv-ai-agent"
if (-not (Test-Path $workerDir)) {
    Write-Host "❌ Worker directory not found: $workerDir" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Worker directory found: $workerDir" -ForegroundColor Green
Write-Host ""

# Navigate to worker directory
Push-Location $workerDir

# Get credentials from AWS CLI profile
Write-Host "📋 Retrieving AWS credentials from 'cv-analytics' profile..." -ForegroundColor Yellow

$awsAccessKeyId = aws configure get aws_access_key_id --profile cv-analytics
$awsSecretAccessKey = aws configure get aws_secret_access_key --profile cv-analytics
$awsRegion = "us-east-1"
$sqsQueueUrl = "https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo"

if (-not $awsAccessKeyId -or -not $awsSecretAccessKey) {
    Write-Host "❌ Failed to retrieve AWS credentials from 'cv-analytics' profile" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "✅ AWS credentials retrieved" -ForegroundColor Green
Write-Host ""

# Display what will be set (without exposing full secrets)
Write-Host "🔐 The following secrets will be configured:" -ForegroundColor Cyan
Write-Host "  • AWS_SQS_URL: $sqsQueueUrl"
Write-Host "  • AWS_REGION: $awsRegion"
Write-Host "  • AWS_ACCESS_KEY_ID: $($awsAccessKeyId.Substring(0,4))..." -ForegroundColor DarkGray
Write-Host "  • AWS_SECRET_ACCESS_KEY: ***" -ForegroundColor DarkGray
Write-Host ""

# Prompt for confirmation
$response = Read-Host "Continue with setting these secrets? (yes/no)"
if ($response -ne "yes") {
    Write-Host "❌ Cancelled by user" -ForegroundColor Yellow
    Pop-Location
    exit 0
}

Write-Host ""
Write-Host "⏳ Setting Wrangler secrets..." -ForegroundColor Yellow

# Set secrets
try {
    Write-Host "  1/4 Setting AWS_SQS_URL..."
    echo $sqsQueueUrl | wrangler secret put AWS_SQS_URL
    
    Write-Host "  2/4 Setting AWS_REGION..."
    echo $awsRegion | wrangler secret put AWS_REGION
    
    Write-Host "  3/4 Setting AWS_ACCESS_KEY_ID..."
    echo $awsAccessKeyId | wrangler secret put AWS_ACCESS_KEY_ID
    
    Write-Host "  4/4 Setting AWS_SECRET_ACCESS_KEY..."
    echo $awsSecretAccessKey | wrangler secret put AWS_SECRET_ACCESS_KEY
    
    Write-Host ""
    Write-Host "✅ All secrets configured successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error setting secrets: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Verify secrets were set
Write-Host ""
Write-Host "🔍 Verifying secrets..." -ForegroundColor Yellow
wrangler secret list

Write-Host ""
Write-Host "📦 Ready for deployment!" -ForegroundColor Cyan
Write-Host "  Next step: wrangler deploy" -ForegroundColor Green

Pop-Location
