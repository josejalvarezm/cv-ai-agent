#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Seed D1 database with skills from deep.seek.cv.md
    
.DESCRIPTION
    Adds missing technologies, cloud services, and practices from the CV
    that are not currently in the D1 database.
    
.PARAMETER Environment
    Target environment: 'local' or 'remote' (default: 'remote')
    
.EXAMPLE
    .\seed-cv-skills.ps1 -Environment remote
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('local', 'remote')]
    [string]$Environment = 'remote'
)

$remoteFlag = if ($Environment -eq 'remote') { '--remote' } else { '' }

Write-Host "🌱 Seeding CV skills to D1 database ($Environment)..." -ForegroundColor Cyan

# Missing core languages/frameworks
$languages = @(
    @{name='Go'; category='Backend Development'; years=2; level='Intermediate'; experience='Used Go for GCP Cloud Functions runtime, implementing webhook receivers with HMAC validation and Firestore integration'; action='Implemented GCP Cloud Function webhook receiver'; effect='Validated HMAC signatures and wrote to Firestore'; outcome='Achieved sub-second cross-cloud data flow'; employer='Portfolio'},
    @{name='React'; category='Frontend Development'; years=3; level='Advanced'; experience='Built real-time analytics dashboard using React with TypeScript, implementing Firestore WebSocket listeners for instant updates'; action='Architected real-time dashboard with Firestore onSnapshot()'; effect='Eliminated polling overhead'; outcome='Sub-second UI updates across cloud boundaries'; employer='Portfolio'},
    @{name='.NET Core'; category='Backend Development'; years=8; level='Expert'; experience='Developed ASP.NET Core APIs and services for enterprise platforms, migrating from .NET Framework to modern .NET Core/5+'; action='Migrated legacy systems to .NET Core'; effect='Enabled cross-platform deployment'; outcome='Reduced infrastructure costs'; employer='CCHQ'},
    @{name='ASP.NET MVC'; category='Backend Development'; years=15; level='Expert'; experience='Built enterprise web applications using ASP.NET MVC, later evolved to Angular SPAs with ASP.NET Core backends'; action='Architected layered MVC applications'; effect='Separated concerns for maintainability'; outcome='Enabled independent frontend evolution'; employer='CCHQ'},
    @{name='Entity Framework'; category='Backend Development'; years=12; level='Expert'; experience='Implemented data access layer using Entity Framework Code-First and Database-First approaches, optimizing LINQ queries for performance'; action='Designed EF data models with navigation properties'; effect='Simplified data access with strongly-typed queries'; outcome='3× query performance improvement with proper indexing'; employer='CCHQ'}
)

# Missing cloud services
$cloudServices = @(
    @{name='AWS Lambda'; category='Cloud & DevOps'; years=3; level='Advanced'; experience='Engineered event-driven Lambda functions with SQS FIFO batching, achieving 12ms P99 latency and 10:1 cost optimization'; action='Implemented Lambda batch processing with SQS FIFO'; effect='Reduced invocations from 3,000 to 300/month'; outcome='90% cost reduction through batching'; employer='Portfolio'},
    @{name='AWS DynamoDB'; category='Cloud & DevOps'; years=3; level='Advanced'; experience='Designed DynamoDB schema with DynamoDB Streams for event sourcing, implementing TTL for automatic data expiry'; action='Architected DynamoDB with Streams + TTL'; effect='Enabled fire-and-forget writes with async processing'; outcome='12ms P99 latency with £0 operational cost'; employer='Portfolio'},
    @{name='AWS SQS'; category='Cloud & DevOps'; years=3; level='Advanced'; experience='Implemented SQS FIFO queues for reliable message processing, enabling 10:1 batching optimization in Lambda'; action='Designed SQS FIFO queue with batch processing'; effect='Guaranteed message ordering with deduplication'; outcome='Reduced Lambda invocations by 90%'; employer='Portfolio'},
    @{name='AWS EventBridge'; category='Cloud & DevOps'; years=2; level='Intermediate'; experience='Configured EventBridge cron schedules for weekly analytics reporting, triggering Lambda functions with SES email delivery'; action='Set up EventBridge cron for automated reporting'; effect='Scheduled weekly email digests'; outcome='4 automated reports/month at £0 cost'; employer='Portfolio'},
    @{name='AWS SES'; category='Cloud & DevOps'; years=2; level='Intermediate'; experience='Integrated SES for automated email delivery in analytics pipeline, sending weekly reports with formatted HTML'; action='Configured SES for automated emails'; effect='Delivered weekly analytics reports'; outcome='Reliable email delivery within free tier'; employer='Portfolio'},
    @{name='GCP Cloud Functions'; category='Cloud & DevOps'; years=2; level='Intermediate'; experience='Deployed Go-based Cloud Functions for webhook receivers, implementing HMAC validation and Firestore writes'; action='Implemented webhook validation with HMAC-SHA256'; effect='Secured cross-cloud data flow from AWS to GCP'; outcome='Sub-second cross-cloud pipeline'; employer='Portfolio'},
    @{name='GCP Firestore'; category='Cloud & DevOps'; years=2; level='Intermediate'; experience='Architected real-time Firestore database with WebSocket listeners, enabling instant dashboard updates'; action='Designed Firestore schema with real-time listeners'; effect='Eliminated polling with WebSocket updates'; outcome='Sub-second UI synchronization'; employer='Portfolio'},
    @{name='Firebase Hosting'; category='Cloud & DevOps'; years=2; level='Intermediate'; experience='Deployed React dashboard to Firebase Hosting with global CDN distribution'; action='Configured Firebase Hosting with GitHub Actions CI/CD'; effect='Global edge distribution'; outcome='Fast dashboard loads worldwide'; employer='Portfolio'},
    @{name='Cloudflare Pages'; category='Cloud & DevOps'; years=2; level='Advanced'; experience='Hosted Angular portfolio site on Cloudflare Pages with automatic deployments from GitHub'; action='Set up Cloudflare Pages with GitHub integration'; effect='Automatic deployments on git push'; outcome='Global CDN hosting with instant updates'; employer='Portfolio'},
    @{name='Cloudflare KV'; category='Cloud & DevOps'; years=2; level='Intermediate'; experience='Implemented edge caching with Cloudflare KV for quota tracking and session management'; action='Designed KV-based quota system'; effect='Edge-native state management'; outcome='Sub-10ms quota checks'; employer='Portfolio'},
    @{name='Cloudflare D1'; category='Cloud & DevOps'; years=1; level='Intermediate'; experience='Migrated from linear search to Vectorize, using D1 for metadata storage'; action='Designed D1 schema for skill metadata'; effect='Centralized metadata with edge access'; outcome='12ms query latency'; employer='Portfolio'},
    @{name='Cloudflare Vectorize'; category='Cloud & DevOps'; years=1; level='Intermediate'; experience='Implemented semantic search using Vectorize with HNSW index, achieving 64-vector indexing'; action='Indexed 768-dimensional embeddings'; effect='Enabled natural language skill queries'; outcome='Semantic search with 12ms latency'; employer='Portfolio'},
    @{name='Workers AI'; category='Cloud & DevOps'; years=1; level='Intermediate'; experience='Integrated Workers AI for embedding generation at the edge, using BGE-base-en-v1.5 model'; action='Implemented edge-native embedding generation'; effect='No external API calls for embeddings'; outcome='Complete semantic search in <50ms'; employer='Portfolio'},
    @{name='Azure Functions'; category='Cloud & DevOps'; years=5; level='Advanced'; experience='Developed serverless Azure Functions for CCHQ platform, later researched migration to Cloudflare Workers for reduced cold starts'; action='Evaluated Azure Functions vs Cloudflare Workers'; effect='Identified 1000ms → 5ms cold start improvement'; outcome='Proposed platform modernization'; employer='CCHQ'},
    @{name='Azure Blob Storage'; category='Cloud & DevOps'; years=5; level='Advanced'; experience='Implemented file storage and CDN distribution using Azure Blob Storage'; action='Configured Blob Storage with CDN'; effect='Served static assets globally'; outcome='Fast asset delivery for campaign platform'; employer='CCHQ'},
    @{name='Azure CosmosDB'; category='Cloud & DevOps'; years=3; level='Intermediate'; experience='Evaluated CosmosDB for globally distributed data, researched multi-region write scenarios'; action='Prototyped CosmosDB multi-region setup'; effect='Explored global consistency models'; outcome='Informed data architecture decisions'; employer='CCHQ'}
)

# Missing databases
$databases = @(
    @{name='SQL Server'; category='Backend Development'; years=20; level='Expert'; experience='Optimized SQL Server workloads achieving 3× performance improvements through query tuning, indexing, and execution plan analysis'; action='Analyzed execution plans and optimized indexes'; effect='Reduced query times from seconds to milliseconds'; outcome='3× throughput improvement for high-traffic operations'; employer='CCHQ'},
    @{name='DynamoDB Streams'; category='Cloud & DevOps'; years=2; level='Advanced'; experience='Architected event-driven pipeline using DynamoDB Streams to trigger Lambda processing asynchronously'; action='Configured DynamoDB Streams with Lambda trigger'; effect='Decoupled write operations from processing'; outcome='Fire-and-forget pattern with 12ms write latency'; employer='Portfolio'},
    @{name='Cosmos DB'; category='Backend Development'; years=3; level='Intermediate'; experience='Evaluated Cosmos DB for distributed scenarios at CCHQ, researched consistency models and global distribution'; action='Researched Cosmos DB multi-region architecture'; effect='Understood tradeoffs in consistency vs latency'; outcome='Informed database selection decisions'; employer='CCHQ'}
)

# Missing infrastructure/DevOps
$infrastructure = @(
    @{name='Docker'; category='Cloud & DevOps'; years=5; level='Advanced'; experience='Containerized applications with Docker for consistent deployments across environments'; action='Created Docker images for microservices'; effect='Eliminated environment inconsistencies'; outcome='Repeatable deployments across dev/staging/prod'; employer='CCHQ'},
    @{name='Kubernetes'; category='Cloud & DevOps'; years=2; level='Intermediate'; experience='Prototyped Kubernetes deployments for container orchestration, evaluated for CCHQ platform evolution'; action='Deployed test clusters with K8s'; effect='Explored auto-scaling and self-healing'; outcome='Informed platform architecture decisions'; employer='CCHQ'},
    @{name='GitHub Actions'; category='Cloud & DevOps'; years=3; level='Advanced'; experience='Built 6 parallel CI/CD pipelines deploying to 3 cloud providers with semantic versioning'; action='Architected independent GitHub Actions workflows'; effect='Enabled autonomous microservice deployments'; outcome='6 services with independent release cycles'; employer='Portfolio'},
    @{name='CI/CD'; category='Cloud & DevOps'; years=10; level='Expert'; experience='Established Azure DevOps pipelines at CCHQ, cutting deployment times by 80%, later built GitHub Actions workflows for multi-cloud deployments'; action='Designed automated deployment pipelines'; effect='Eliminated manual deployment errors'; outcome='80% faster deployments with zero downtime'; employer='CCHQ'},
    @{name='Semantic Versioning'; category='Cloud & DevOps'; years=3; level='Advanced'; experience='Implemented semantic versioning (v1.2.0, v2.1.3) across 6 microservices with automated Git tagging'; action='Established semver conventions with Git tags'; effect='Clear version history and dependency tracking'; outcome='Transparent release management'; employer='Portfolio'}
)

# Missing architecture patterns
$architecturePatterns = @(
    @{name='Event-Driven Architecture'; category='Architecture & Design'; years=5; level='Advanced'; experience='Architected event-driven systems using DynamoDB Streams, SQS, and Lambda with fire-and-forget patterns'; action='Designed async event pipelines'; effect='Decoupled services for independent scaling'; outcome='12ms P99 latency with 90% cost reduction'; employer='Portfolio'},
    @{name='Serverless Architecture'; category='Architecture & Design'; years=5; level='Advanced'; experience='Built serverless systems across Cloudflare Workers, AWS Lambda, and GCP Cloud Functions, achieving £0 operational cost'; action='Architected pure serverless platform'; effect='Eliminated infrastructure management'; outcome='3,000 queries/month at £0 cost'; employer='Portfolio'},
    @{name='HMAC Security'; category='Architecture & Design'; years=3; level='Advanced'; experience='Implemented HMAC-SHA256 signing and validation for cross-cloud webhooks (AWS → GCP)'; action='Designed HMAC webhook authentication'; effect='Secured cross-cloud data pipelines'; outcome='Verified message integrity across providers'; employer='Portfolio'},
    @{name='Real-Time Systems'; category='Architecture & Design'; years=3; level='Advanced'; experience='Architected real-time dashboard using Firestore WebSocket listeners for instant updates'; action='Implemented Firestore onSnapshot() pattern'; effect='Eliminated polling overhead'; outcome='Sub-second UI synchronization'; employer='Portfolio'},
    @{name='Fire-and-Forget Pattern'; category='Architecture & Design'; years=3; level='Advanced'; experience='Implemented fire-and-forget writes to DynamoDB with async processing via Streams and SQS'; action='Decoupled write path from processing'; effect='Non-blocking writes with async pipeline'; outcome='12ms write latency with reliable processing'; employer='Portfolio'},
    @{name='Multi-Cloud Architecture'; category='Architecture & Design'; years=3; level='Expert'; experience='Designed 6 microservices across Cloudflare, AWS, and GCP, achieving 87.5% architectural purity'; action='Architected cross-cloud service mesh'; effect='Optimal service placement per cloud strengths'; outcome='£0 operational cost with 12ms latency'; employer='Portfolio'},
    @{name='Cost Optimization'; category='Architecture & Design'; years=10; level='Expert'; experience='Achieved £0 operational cost through strategic free-tier exploitation and 10:1 batching optimization'; action='Designed constraint-driven architecture'; effect='Maximized free tier utilization'; outcome='3,000 queries/month at £0 cost'; employer='Portfolio'}
)

# Function to execute SQL with error handling
function Invoke-D1Command {
    param([string]$Command)
    
    try {
        # Execute wrangler directly with & operator (avoids Invoke-Expression escaping issues)
        $result = & npx wrangler d1 execute cv_assistant_db $remoteFlag --yes --command $Command 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
        
        # Check for success: exit code 0 AND output contains "Executed"
        if ($exitCode -eq 0 -and $result -match "Executed") {
            return $true
        } else {
            Write-Host " ❌" -ForegroundColor Red
            if ($result -match "error|Error|ERROR|UNIQUE constraint failed") {
                Write-Host "    Error: $result" -ForegroundColor DarkGray
            }
            return $false
        }
    } catch {
        Write-Host " ❌" -ForegroundColor Red
        Write-Host "    Exception: $_" -ForegroundColor Red
        return $false
    }
}

# Seed function
function Add-Skill {
    param($Skill)
    
    $name = $Skill.name -replace "'", "''"
    $category = $Skill.category -replace "'", "''"
    $experience = $Skill.experience -replace "'", "''"
    $action = $Skill.action -replace "'", "''"
    $effect = $Skill.effect -replace "'", "''"
    $outcome = $Skill.outcome -replace "'", "''"
    $employer = $Skill.employer -replace "'", "''"
    
    $sql = @"
INSERT OR IGNORE INTO technology (
    name, category, experience, experience_years, proficiency_percent, level,
    action, effect, outcome, employer, recency
) VALUES (
    '$name', '$category', '$experience', $($Skill.years), $($Skill.years * 5), '$($Skill.level)',
    '$action', '$effect', '$outcome', '$employer', 
    $(if ($Skill.years -le 2) { "'Current (2023-2025)'" } else { 'NULL' })
);
"@
    
    Write-Host "  Adding: $($Skill.name) ($($Skill.category))..." -NoNewline
    if (Invoke-D1Command $sql) {
        Write-Host " ✅" -ForegroundColor Green
        return $true
    }
    return $false
}

# Main execution
$totalAdded = 0

Write-Host "`n📦 Languages & Frameworks ($($languages.Count) skills)" -ForegroundColor Yellow
foreach ($skill in $languages) {
    if (Add-Skill $skill) { $totalAdded++ }
}

Write-Host "`n☁️  Cloud Services ($($cloudServices.Count) skills)" -ForegroundColor Yellow
foreach ($skill in $cloudServices) {
    if (Add-Skill $skill) { $totalAdded++ }
}

Write-Host "`n🗄️  Databases ($($databases.Count) skills)" -ForegroundColor Yellow
foreach ($skill in $databases) {
    if (Add-Skill $skill) { $totalAdded++ }
}

Write-Host "`n🛠️  Infrastructure & DevOps ($($infrastructure.Count) skills)" -ForegroundColor Yellow
foreach ($skill in $infrastructure) {
    if (Add-Skill $skill) { $totalAdded++ }
}

Write-Host "`n🏗️  Architecture Patterns ($($architecturePatterns.Count) skills)" -ForegroundColor Yellow
foreach ($skill in $architecturePatterns) {
    if (Add-Skill $skill) { $totalAdded++ }
}

Write-Host "`n✅ Seeding complete: $totalAdded skills added!" -ForegroundColor Green
Write-Host "📊 Next step: Run .\sync-skills.ps1 -Environment production to index into Vectorize" -ForegroundColor Cyan
