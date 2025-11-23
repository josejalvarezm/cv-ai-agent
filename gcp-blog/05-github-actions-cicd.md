# Automated Deployments with GitHub Actions: Multi-Cloud CI/CD

*Six independent CI/CD pipelines deploying to Cloudflare Pages, Cloudflare Workers, Firebase Hosting, GCP Cloud Functions, and AWS Lambda×2—with automated testing, secrets management, and zero-downtime deployments across three clouds.*

## Quick Summary

- ✓ **6 independent CI/CD pipelines** for dashboard, webhook, processor, reporter, Angular CV site, Cloudflare Worker
- ✓ **GitHub Actions workflows** automate testing, building, deploying across 3 clouds
- ✓ **Multi-cloud deployments** to Vercel (Angular), Cloudflare Workers, Firebase Hosting, GCP Cloud Functions, AWS Lambda×2
- ✓ **Secrets management** with GitHub Secrets (12+ secrets across 6 repos, 3 clouds)
- ✓ **Zero-downtime deployments** with serverless platforms (Cloudflare, GCP, AWS)

---

## Introduction

Manual deployments don't scale. In January 2024, I deployed CV Analytics updates 47 times across six services and three clouds. Each manual deployment took 15 minutes (checkout code, build, test, deploy, verify). That's 11.75 hours of repetitive work, with human error on every deployment.

After automating with GitHub Actions, every git push triggers tested deployments to Vercel (Angular), Cloudflare Workers, Firebase Hosting (React), GCP Cloud Functions (Go), and AWS Lambda×2 (Node.js). Zero manual intervention. Zero forgotten steps. Zero "works on my machine" deployments.

This post explains how CV Analytics uses GitHub Actions for multi-cloud CI/CD across three clouds:

**You'll learn:**
- ✓ GitHub Actions fundamentals (workflows, jobs, steps, triggers)
- ✓ 6 independent pipelines for Angular CV site, Cloudflare Worker, React dashboard, GCP webhook, AWS processor, AWS reporter
- ✓ Multi-cloud deployments to Vercel, Cloudflare, Firebase Hosting, GCP Cloud Functions, AWS Lambda
- ✓ Secrets management (12+ secrets across 6 repositories, 3 clouds)
- ✓ Cross-cloud deployment coordination (Angular → Cloudflare → AWS → GCP)
- ✓ Troubleshooting common deployment failures across multiple clouds

**Why CI/CD matters for microservices:**

Microservices architectures create deployment complexity. CV Analytics has 6 independent services across 3 cloud providers (Cloudflare, AWS, GCP). Manual coordination fails:
- Forgotten environment variables break production (3 clouds = 3 different secret managers)
- Stale builds deploy outdated code
- No consistent testing before deployment
- Rollbacks require manual intervention across clouds
- Cross-cloud dependencies (AWS Lambda needs GCP webhook URL)
- Service ordering (must deploy GCP webhook before AWS Lambda can call it)

**The cost of manual deployments:**

Every manual deployment introduces risk:
1. **Human error**: Typos in gcloud/aws commands
2. **Inconsistency**: Different steps each time
3. **No audit trail**: Who deployed what, when?
4. **Slow feedback**: Find bugs after deployment
5. **Context switching**: Stop feature work to deploy

Automation eliminates these problems. Push code, pipeline handles everything.

**GitHub Actions as automation platform:**

GitHub Actions integrates directly with your repository. No external CI/CD platform required. Workflows defined in .github/workflows/ alongside your code.

**Advantages:**
- Free for public repos (2,000 minutes/month for private repos)
- GitHub-hosted runners (Ubuntu, Windows, macOS)
- Built-in secrets management
- Marketplace with 15,000+ reusable actions
- Matrix builds for multi-environment testing

**How independent pipelines enable velocity:**

CV Analytics runs 6 separate workflows across 3 clouds:
1. **Angular CV site pipeline**: Angular build → Vercel
2. **Cloudflare Worker pipeline**: TypeScript build → Cloudflare Workers
3. **React Dashboard pipeline**: React build → Firebase Hosting
4. **Webhook receiver pipeline**: Go build → GCP Cloud Functions
5. **Processor pipeline**: Node.js → AWS Lambda
6. **Reporter pipeline**: Node.js → AWS Lambda

Services deploy independently. No coordinated releases. Angular site updates don't wait for Cloudflare Worker changes. React dashboard updates don't wait for GCP webhook changes. Each service (even within same cloud) moves at its own pace.

**Cross-cloud dependency exception:** AWS Lambda Processor must deploy after GCP Cloud Function webhook (Lambda needs webhook URL). GitHub Actions handles this with output artifacts.

Let's build these pipelines.

---

## GitHub Actions Fundamentals

GitHub Actions orchestrates CI/CD through **workflows**, **jobs**, and **steps**. Understanding this hierarchy is essential before building pipelines.

### Workflow, Job, Step Hierarchy

**Workflow** (top level):
- YAML file in .github/workflows/
- Defines when to run (triggers)
- Contains one or more jobs
- Example: deploy-dashboard.yml

**Job** (middle level):
- Named unit of work
- Runs on a runner (virtual machine)
- Can run in parallel or sequentially
- Example: build, test, deploy

**Step** (bottom level):
- Individual command or action
- Runs inside a job
- Sequential execution
- Example: npm install, npm build, firebase deploy

```mermaid
graph TD
    WORKFLOW[Workflow: deploy-dashboard.yml] --> JOB1[Job: build]
    WORKFLOW --> JOB2[Job: test]
    WORKFLOW --> JOB3[Job: deploy]
    JOB1 --> STEP1[Step: Checkout code]
    JOB1 --> STEP2[Step: Setup Node.js]
    JOB1 --> STEP3[Step: npm ci]
    JOB1 --> STEP4[Step: npm run build]
    JOB2 --> STEP5[Step: npm test]
    JOB3 --> STEP6[Step: Firebase deploy]
    
    style WORKFLOW fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style JOB1 fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style JOB2 fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style JOB3 fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style STEP1 fill:#c8e6c9,stroke:#388e3c,stroke-width:1px
    style STEP2 fill:#c8e6c9,stroke:#388e3c,stroke-width:1px
    style STEP3 fill:#c8e6c9,stroke:#388e3c,stroke-width:1px
    style STEP4 fill:#c8e6c9,stroke:#388e3c,stroke-width:1px
    style STEP5 fill:#c8e6c9,stroke:#388e3c,stroke-width:1px
    style STEP6 fill:#c8e6c9,stroke:#388e3c,stroke-width:1px
```

### Triggers: When Workflows Run

GitHub Actions supports multiple trigger types:

**1. Push triggers** (most common):
```yaml
on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'src/**'
      - 'package.json'
```
Runs on every push to specified branches/paths. CV Analytics uses this for automatic deployments.

**2. Pull request triggers** (for testing):
```yaml
on:
  pull_request:
    branches:
      - main
```
Runs on PR creation/update. Use for tests before merging.

**3. Schedule triggers** (cron jobs):
```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # 2am UTC daily
```
CV Analytics reporter uses this for daily summary generation.

**4. Manual triggers** (workflow_dispatch):
```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy environment'
        required: true
        default: 'staging'
```
Adds "Run workflow" button in GitHub UI. Useful for controlled deployments.

**5. Repository events** (release, issue, etc.):
```yaml
on:
  release:
    types: [published]
```
CV Analytics uses this for semantic versioning workflows (Part 6).

### Runners: Where Jobs Execute

**GitHub-hosted runners** (CV Analytics uses these):
- Ubuntu, Windows, macOS available
- Clean VM for each job
- Pre-installed tools (Node.js, Python, Docker, AWS CLI, gcloud)
- 2 vCPUs, 7 GB RAM, 14 GB SSD
- Free for public repos

**Self-hosted runners** (for special cases):
- Your own infrastructure
- Persistent environment
- Custom tools/configs
- Faster for large dependencies
- CV Analytics doesn't need these (GitHub-hosted sufficient)

**Runner selection:**
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest  # Most common
    # runs-on: windows-latest
    # runs-on: macos-latest
    # runs-on: [self-hosted, linux, x64]
```

### Secrets and Environment Variables

GitHub Actions provides secure secret storage:

**Repository secrets** (CV Analytics uses 7):
- Encrypted at rest (AES-256)
- Never logged or exposed
- Accessible via ${{ secrets.SECRET_NAME }}
- Per-repository or organisation-wide

**Example secret usage:**
```yaml
steps:
  - name: Deploy to Firebase
    env:
      FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
    run: firebase deploy --token "$FIREBASE_TOKEN"
```

**Environment variables** (non-secret config):
```yaml
env:
  NODE_ENV: production
  REGION: us-central1
  
steps:
  - run: echo "Deploying to $REGION"
```

**Built-in environment variables:**
- ${{ github.repository }}: repo name
- ${{ github.sha }}: commit SHA
- ${{ github.ref }}: branch/tag ref
- ${{ github.actor }}: triggering user

### Actions Marketplace

Reusable actions from community/GitHub:

**CV Analytics uses:**
- actions/checkout@v3 (clone repo)
- actions/setup-node@v3 (install Node.js)
- actions/setup-go@v4 (install Go)
- google-github-actions/auth@v1 (GCP authentication)
- FirebaseExtended/action-hosting-deploy@v0 (Firebase deploy)
- aws-actions/configure-aws-credentials@v2 (AWS authentication)

**Example action usage:**
```yaml
steps:
  - uses: actions/checkout@v3
    with:
      fetch-depth: 0  # Full history for versioning
      
  - uses: actions/setup-node@v3
    with:
      node-version: 18
      cache: 'npm'
```

**Custom actions** (not needed for CV Analytics):
- Docker container actions
- JavaScript actions
- Composite actions (reusable workflow fragments)

Now let's build actual pipelines.

---

## Dashboard Pipeline: React → Firebase

The dashboard pipeline deploys a React SPA to Firebase Hosting. Every push to main triggers automatic deployment. Build time: ~2 minutes.

### Dashboard Deployment Flow

```mermaid
graph LR
    PUSH[Git Push to main] --> TRIGGER[GitHub Actions Trigger]
    TRIGGER --> CHECKOUT[Checkout Code]
    CHECKOUT --> NODE[Setup Node.js 18]
    NODE --> DEPS[npm ci]
    DEPS --> BUILD[npm run build]
    BUILD --> DEPLOY[Firebase Deploy]
    DEPLOY --> CDN[CDN Invalidation]
    CDN --> LIVE[Live at cv-dashboard.web.app]
    
    BUILD -.->|Build Failure| NOTIFY1[Notify Developer]
    DEPLOY -.->|Deploy Failure| NOTIFY2[Notify Developer]
    
    style PUSH fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style TRIGGER fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style CHECKOUT fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style NODE fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style DEPS fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style BUILD fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style DEPLOY fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style CDN fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style LIVE fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style NOTIFY1 fill:#ffccbc,stroke:#d84315,stroke-width:2px
    style NOTIFY2 fill:#ffccbc,stroke:#d84315,stroke-width:2px
```

### Complete Workflow File

**File:** `.github/workflows/deploy-dashboard.yml`

```yaml
name: Deploy Dashboard to Firebase

on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
      - 'public/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/deploy-dashboard.yml'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      # Checkout repository
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Full history for build metadata
      
      # Setup Node.js environment
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      # Install dependencies (npm ci for reproducible builds)
      - name: Install dependencies
        run: npm ci
      
      # Run tests (optional, but recommended)
      - name: Run tests
        run: npm test
        env:
          CI: true
      
      # Build production bundle
      - name: Build production bundle
        run: npm run build
        env:
          REACT_APP_API_URL: https://us-central1-cv-analytics-prod.cloudfunctions.net/webhook-receiver
          REACT_APP_ENVIRONMENT: production
      
      # Deploy to Firebase Hosting
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_TOKEN }}
          projectId: cv-analytics-prod
          channelId: live
        env:
          FIREBASE_CLI_EXPERIMENTS: webframeworks
```

### Trigger Configuration

**Push to main with path filters:**
```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'src/**'          # Source code changes
      - 'public/**'       # Public assets
      - 'package.json'    # Dependencies
      - 'package-lock.json'
      - '.github/workflows/deploy-dashboard.yml'
```

**Why path filters?** Changing documentation shouldn't trigger deployments. CV Analytics only deploys when code/dependencies change.

**No paths filter alternative:**
```yaml
paths-ignore:
  - '**.md'
  - 'docs/**'
  - '.gitignore'
```

### Firebase CLI Authentication

**Service account approach** (CV Analytics uses this):

1. Create Firebase service account in GCP Console
2. Generate JSON key
3. Store in GitHub Secrets as `FIREBASE_TOKEN`
4. Action uses this token for authentication

**Alternative: firebase login:ci** (deprecated):
```bash
firebase login:ci
# Outputs token, store in GitHub Secrets
```

Google recommends service accounts for CI/CD (more granular permissions).

### Environment-Specific Builds

Dashboard needs different API URLs per environment:

**Production:**
```yaml
env:
  REACT_APP_API_URL: https://us-central1-cv-analytics-prod.cloudfunctions.net/webhook-receiver
  REACT_APP_ENVIRONMENT: production
```

**Staging:**
```yaml
env:
  REACT_APP_API_URL: https://us-central1-cv-analytics-staging.cloudfunctions.net/webhook-receiver
  REACT_APP_ENVIRONMENT: staging
```

React embeds these at build time (REACT_APP_* prefix required).

**Multiple environments workflow:**
```yaml
on:
  push:
    branches:
      - main        # Deploy to production
      - develop     # Deploy to staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Set environment variables
        run: |
          if [[ "$GITHUB_REF" == "refs/heads/main" ]]; then
            echo "ENVIRONMENT=production" >> $GITHUB_ENV
            echo "FIREBASE_PROJECT=cv-analytics-prod" >> $GITHUB_ENV
          else
            echo "ENVIRONMENT=staging" >> $GITHUB_ENV
            echo "FIREBASE_PROJECT=cv-analytics-staging" >> $GITHUB_ENV
          fi
      
      - name: Build
        run: npm run build
        env:
          REACT_APP_ENVIRONMENT: ${{ env.ENVIRONMENT }}
      
      - name: Deploy
        run: firebase deploy --project ${{ env.FIREBASE_PROJECT }}
```

### CDN Cache Invalidation

Firebase Hosting uses Google Cloud CDN. After deployment:
- New files immediately available
- Existing files cached (up to 1 hour by default)
- Users might see stale content

**Firebase handles cache invalidation automatically:**
- Generates unique URLs for assets (content hashing)
- index.html has short cache (1 hour)
- JS/CSS bundles have long cache (1 year)

**Example build output:**
```
build/static/js/main.a1b2c3d4.js
build/static/css/main.e5f6g7h8.css
```

Content hash (a1b2c3d4) changes when code changes. CDN serves new file.

**Manual cache clearing** (not needed for CV Analytics):
```yaml
- name: Clear CDN cache
  run: |
    gcloud compute url-maps invalidate-cdn-cache cv-dashboard-lb \
      --path "/*" \
      --async
```

### Deployment Verification

Firebase action outputs deployment URL:
```yaml
- name: Deploy to Firebase
  id: deploy
  uses: FirebaseExtended/action-hosting-deploy@v0
  # ... config ...

- name: Verify deployment
  run: |
    curl -f ${{ steps.deploy.outputs.url }} || exit 1
    echo "Dashboard live at ${{ steps.deploy.outputs.url }}"
```

**Health check endpoint** (recommended):
```yaml
- name: Health check
  run: |
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://cv-dashboard.web.app/health)
    if [ $RESPONSE -ne 200 ]; then
      echo "Health check failed with status $RESPONSE"
      exit 1
    fi
```

CV Analytics dashboard includes /health endpoint returning {"status": "ok"}.

### Build Optimisation

**npm ci vs npm install:**
- `npm ci`: Clean install from package-lock.json (reproducible)
- `npm install`: Updates package-lock.json (non-reproducible)

Always use `npm ci` in CI/CD.

**Caching dependencies:**
```yaml
- uses: actions/setup-node@v3
  with:
    node-version: '18'
    cache: 'npm'  # Caches node_modules
```

First build: 90 seconds. Subsequent builds (cache hit): 30 seconds.

**Build matrix** (test multiple Node versions):
```yaml
strategy:
  matrix:
    node-version: [16, 18, 20]

steps:
  - uses: actions/setup-node@v3
    with:
      node-version: ${{ matrix.node-version }}
```

CV Analytics uses Node 18 only (LTS).

Dashboard pipeline complete. Next: webhook pipeline for Go services.

---

## Webhook Pipeline: Go → Cloud Functions

The webhook service receives GitHub events. Written in Go, deployed to Cloud Functions. Every push to main triggers redeployment. Deploy time: ~3 minutes (includes Go compilation and Cloud Functions packaging).

### Webhook Deployment Flow

```mermaid
graph LR
    PUSH[Git Push to main] --> TRIGGER[GitHub Actions Trigger]
    TRIGGER --> CHECKOUT[Checkout Code]
    CHECKOUT --> GO[Setup Go 1.21]
    GO --> AUTH[GCP Authentication]
    AUTH --> TEST[go test ./...]
    TEST --> BUILD[go build]
    BUILD --> DEPLOY[gcloud functions deploy]
    DEPLOY --> IAM[Configure IAM]
    IAM --> VERIFY[Verify HTTPS endpoint]
    VERIFY --> LIVE[Live at cloudfunctions.net]
    
    TEST -.->|Test Failure| NOTIFY1[Notify Developer]
    DEPLOY -.->|Deploy Failure| NOTIFY2[Notify Developer]
    
    style PUSH fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style TRIGGER fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style CHECKOUT fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style GO fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style AUTH fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style TEST fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style BUILD fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style DEPLOY fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style IAM fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style VERIFY fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style LIVE fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style NOTIFY1 fill:#ffccbc,stroke:#d84315,stroke-width:2px
    style NOTIFY2 fill:#ffccbc,stroke:#d84315,stroke-width:2px
```

### Complete Workflow File

**File:** `.github/workflows/deploy-webhook.yml`

```yaml
name: Deploy Webhook to Cloud Functions

on:
  push:
    branches:
      - main
    paths:
      - '**.go'
      - 'go.mod'
      - 'go.sum'
      - '.github/workflows/deploy-webhook.yml'

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      # Checkout repository
      - name: Checkout code
        uses: actions/checkout@v3
      
      # Setup Go environment
      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
          cache: true  # Cache Go modules
      
      # Download dependencies
      - name: Download dependencies
        run: go mod download
      
      # Run tests
      - name: Run tests
        run: go test -v -race -coverprofile=coverage.out ./...
      
      # Build for verification (not required for Cloud Functions)
      - name: Build
        run: go build -v .
      
      # Authenticate to GCP
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      # Setup gcloud CLI
      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
      
      # Deploy to Cloud Functions
      - name: Deploy to Cloud Functions
        run: |
          gcloud functions deploy webhook-receiver \
            --gen2 \
            --runtime go121 \
            --region us-central1 \
            --source . \
            --entry-point ReceiveWebhook \
            --trigger-http \
            --allow-unauthenticated \
            --set-env-vars GITHUB_SECRET=${{ secrets.GITHUB_WEBHOOK_SECRET }},FIRESTORE_COLLECTION=cv_events \
            --memory 256MB \
            --timeout 60s \
            --max-instances 10
      
      # Verify deployment
      - name: Verify deployment
        run: |
          FUNCTION_URL=$(gcloud functions describe webhook-receiver \
            --region us-central1 \
            --format='value(serviceConfig.uri)')
          
          echo "Function deployed at: $FUNCTION_URL"
          
          # Health check
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL/health")
          if [ $HTTP_CODE -ne 200 ]; then
            echo "Health check failed with status $HTTP_CODE"
            exit 1
          fi
          
          echo "Webhook service healthy"
```

### Go Build Process

**Go modules** (dependency management):
```yaml
- name: Download dependencies
  run: go mod download
```

Caches dependencies between builds. go.mod/go.sum lock versions.

**Testing before deployment:**
```yaml
- name: Run tests
  run: go test -v -race -coverprofile=coverage.out ./...
```

- `-v`: Verbose output
- `-race`: Race condition detection
- `-coverprofile`: Code coverage report
- `./...`: All packages recursively

Tests must pass before deployment proceeds.

**Build verification** (optional for Cloud Functions):
```yaml
- name: Build
  run: go build -v .
```

Cloud Functions compiles Go code during deployment. Local build verifies compilation succeeds.

### GCP Authentication

**Service account approach** (recommended):

1. Create service account with roles:
   - Cloud Functions Developer
   - Service Account User
   - Cloud Build Service Account

2. Generate JSON key:
```bash
gcloud iam service-accounts keys create key.json \
  --iam-account github-actions@cv-analytics-prod.iam.gserviceaccount.com
```

3. Store in GitHub Secrets as `GCP_SA_KEY`

4. Authenticate in workflow:
```yaml
- uses: google-github-actions/auth@v1
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
```

**Workload Identity Federation** (more secure, no keys):
```yaml
- uses: google-github-actions/auth@v1
  with:
    workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider'
    service_account: 'github-actions@cv-analytics-prod.iam.gserviceaccount.com'
```

CV Analytics uses service account keys (simpler setup). Workload Identity Federation recommended for production (no key rotation needed).

### Cloud Functions Deployment

**gcloud functions deploy command:**
```bash
gcloud functions deploy webhook-receiver \
  --gen2 \                    # 2nd generation Cloud Functions
  --runtime go121 \           # Go 1.21 runtime
  --region us-central1 \      # Region
  --source . \                # Current directory
  --entry-point ReceiveWebhook \  # Function name in code
  --trigger-http \            # HTTP trigger
  --allow-unauthenticated \   # Public access
  --set-env-vars KEY=value    # Environment variables
```

**Generation 2 vs Generation 1:**
- Gen 2: Cloud Run based, better scaling, longer timeouts (60 minutes)
- Gen 1: Legacy, 9-minute timeout

Always use Gen 2 for new functions.

**Entry point** (Go function signature):
```go
package webhook

import (
    "net/http"
    "github.com/GoogleCloudPlatform/functions-framework-go/functions"
)

func init() {
    functions.HTTP("ReceiveWebhook", receiveWebhook)
}

func receiveWebhook(w http.ResponseWriter, r *http.Request) {
    // Handle webhook
}
```

Entry point must match `--entry-point` flag.

### Environment Variables Injection

**Secrets as environment variables:**
```yaml
--set-env-vars GITHUB_SECRET=${{ secrets.GITHUB_WEBHOOK_SECRET }},FIRESTORE_COLLECTION=cv_events
```

**Access in Go code:**
```go
import "os"

func validateSignature(payload []byte, signature string) bool {
    secret := os.Getenv("GITHUB_SECRET")
    // HMAC validation
}
```

**Multiple variables:**
```bash
--set-env-vars \
  VAR1=value1,\
  VAR2=value2,\
  VAR3=value3
```

**Environment file** (alternative):
```yaml
--env-vars-file .env.yaml
```

.env.yaml:
```yaml
GITHUB_SECRET: "secret-value"
FIRESTORE_COLLECTION: "cv_events"
```

CV Analytics uses inline `--set-env-vars` (clearer in workflow).

### Service Account Configuration

**Cloud Function service account:**

Each Cloud Function runs as a service account. CV Analytics uses default Compute Engine service account:
```
PROJECT_NUMBER-compute@developer.gserviceaccount.com
```

**Custom service account** (better security):
```yaml
--service-account webhook-sa@cv-analytics-prod.iam.gserviceaccount.com
```

Grant minimal permissions:
- Firestore User (write to cv_events collection)
- Cloud Logging Writer (write logs)

**IAM binding for public access:**
```yaml
--allow-unauthenticated
```

Equivalent to:
```bash
gcloud functions add-iam-policy-binding webhook-receiver \
  --region us-central1 \
  --member "allUsers" \
  --role "roles/cloudfunctions.invoker"
```

Webhook must be public (GitHub calls it). Security via HMAC signature validation (Part 3).

### Deployment Verification

**Get function URL:**
```bash
FUNCTION_URL=$(gcloud functions describe webhook-receiver \
  --region us-central1 \
  --format='value(serviceConfig.uri)')
```

**Health check endpoint:**
```go
func receiveWebhook(w http.ResponseWriter, r *http.Request) {
    if r.URL.Path == "/health" {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(`{"status":"ok"}`))
        return
    }
    // Handle webhook
}
```

**Verify in workflow:**
```yaml
- name: Verify deployment
  run: |
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL/health")
    if [ $HTTP_CODE -ne 200 ]; then
      exit 1
    fi
```

Webhook pipeline complete. Next: AWS Lambda deployments for processor and reporter.

---

## Processor & Reporter Pipelines: Node.js → Lambda

CV Analytics runs two Lambda functions: **processor** (SQS consumer) and **reporter** (scheduled summary generator). Both use identical deployment pipelines with different triggers.

### Lambda Deployment Flow

```mermaid
graph LR
    PUSH[Git Push to main] --> TRIGGER[GitHub Actions Trigger]
    TRIGGER --> CHECKOUT[Checkout Code]
    CHECKOUT --> NODE[Setup Node.js 18]
    NODE --> DEPS[npm ci]
    DEPS --> TEST[npm test]
    TEST --> PACKAGE[Create deployment package]
    PACKAGE --> AUTH[AWS Authentication]
    AUTH --> UPDATE[Update function code]
    UPDATE --> ENV[Update environment variables]
    ENV --> PUBLISH[Publish new version]
    PUBLISH --> VERIFY[Verify invocation]
    VERIFY --> LIVE[Live Lambda function]
    
    TEST -.->|Test Failure| NOTIFY1[Notify Developer]
    UPDATE -.->|Deploy Failure| NOTIFY2[Notify Developer]
    
    style PUSH fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style TRIGGER fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style CHECKOUT fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style NODE fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style DEPS fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style TEST fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style PACKAGE fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style AUTH fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style UPDATE fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style ENV fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style PUBLISH fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style VERIFY fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style LIVE fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style NOTIFY1 fill:#ffccbc,stroke:#d84315,stroke-width:2px
    style NOTIFY2 fill:#ffccbc,stroke:#d84315,stroke-width:2px
```

### Complete Processor Workflow

**File:** `.github/workflows/deploy-processor.yml`

```yaml
name: Deploy Processor to Lambda

on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/deploy-processor.yml'

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      # Checkout repository
      - name: Checkout code
        uses: actions/checkout@v3
      
      # Setup Node.js environment
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      # Install dependencies
      - name: Install dependencies
        run: npm ci --production
      
      # Run tests
      - name: Run tests
        run: npm test
        env:
          NODE_ENV: test
      
      # Create deployment package
      - name: Create deployment package
        run: |
          zip -r function.zip . \
            -x "*.git*" \
            -x "node_modules/.cache/*" \
            -x "tests/*" \
            -x "*.md"
      
      # Configure AWS credentials
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      # Update Lambda function code
      - name: Update Lambda function code
        run: |
          aws lambda update-function-code \
            --function-name cv-processor \
            --zip-file fileb://function.zip \
            --publish
      
      # Update environment variables
      - name: Update environment variables
        run: |
          aws lambda update-function-configuration \
            --function-name cv-processor \
            --environment Variables="{\
              DYNAMODB_TABLE=cv-events,\
              SQS_QUEUE_URL=${{ secrets.SQS_QUEUE_URL }},\
              LOG_LEVEL=info\
            }"
      
      # Wait for function update to complete
      - name: Wait for update
        run: |
          aws lambda wait function-updated \
            --function-name cv-processor
      
      # Verify deployment with test invocation
      - name: Verify deployment
        run: |
          RESPONSE=$(aws lambda invoke \
            --function-name cv-processor \
            --payload '{"test": true}' \
            --log-type Tail \
            response.json)
          
          STATUS=$(echo $RESPONSE | jq -r '.StatusCode')
          if [ $STATUS -ne 200 ]; then
            echo "Invocation failed with status $STATUS"
            cat response.json
            exit 1
          fi
          
          echo "Processor function deployed successfully"
```

### Reporter Workflow (Scheduled)

**File:** `.github/workflows/deploy-reporter.yml`

```yaml
name: Deploy Reporter to Lambda

on:
  push:
    branches:
      - main
    paths:
      - 'reporter/**'
      - '.github/workflows/deploy-reporter.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      # Same checkout, Node.js setup, dependencies as processor
      
      # Create deployment package
      - name: Create deployment package
        working-directory: reporter
        run: zip -r ../reporter.zip .
      
      # Configure AWS credentials (same as processor)
      
      # Update Lambda function
      - name: Update Lambda function
        run: |
          aws lambda update-function-code \
            --function-name cv-reporter \
            --zip-file fileb://reporter.zip \
            --publish
      
      # Update CloudWatch Events rule (for scheduled execution)
      - name: Update schedule
        run: |
          aws events put-rule \
            --name cv-daily-report \
            --schedule-expression "cron(0 8 * * ? *)" \
            --state ENABLED
          
          aws lambda add-permission \
            --function-name cv-reporter \
            --statement-id AllowCloudWatchInvoke \
            --action lambda:InvokeFunction \
            --principal events.amazonaws.com \
            --source-arn arn:aws:events:us-east-1:ACCOUNT_ID:rule/cv-daily-report
```

### Node.js Build and Packaging

**Production dependencies only:**
```yaml
- name: Install dependencies
  run: npm ci --production
```

`--production` excludes devDependencies (smaller package, faster deployment).

**Creating ZIP package:**
```bash
zip -r function.zip . \
  -x "*.git*" \           # Exclude .git directory
  -x "node_modules/.cache/*" \  # Exclude cache
  -x "tests/*" \          # Exclude tests
  -x "*.md"               # Exclude documentation
```

**Lambda deployment package requirements:**
- Must be ZIP or container image
- Maximum size: 50 MB (zipped), 250 MB (unzipped)
- Must include all dependencies (no npm install at runtime)
- Must have handler file at root or in specified path

**Lambda handler** (Node.js):
```javascript
// index.js
exports.handler = async (event) => {
    // Process SQS messages
    for (const record of event.Records) {
        const body = JSON.parse(record.body);
        await processCVEvent(body);
    }
    return { statusCode: 200 };
};
```

Handler format: `filename.exportedFunction` (e.g., `index.handler`).

### AWS CLI Authentication

**Access keys approach** (CV Analytics uses this):
```yaml
- uses: aws-actions/configure-aws-credentials@v2
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1
```

Store IAM user access keys in GitHub Secrets.

**IAM user permissions required:**
- lambda:UpdateFunctionCode
- lambda:UpdateFunctionConfiguration
- lambda:PublishVersion
- lambda:GetFunction

**OIDC/Workload Identity** (more secure, no long-lived keys):
```yaml
- uses: aws-actions/configure-aws-credentials@v2
  with:
    role-to-assume: arn:aws:iam::ACCOUNT_ID:role/github-actions-role
    aws-region: us-east-1
```

Requires OIDC provider configuration in AWS IAM.

### Lambda Deployment Strategies

**1. Update function code** (CV Analytics uses this):
```bash
aws lambda update-function-code \
  --function-name cv-processor \
  --zip-file fileb://function.zip \
  --publish  # Creates new version
```

Pros: Simple, fast (~10 seconds).
Cons: No blue/green, no gradual rollout.

**2. Function versioning:**
```bash
# Update $LATEST
aws lambda update-function-code --function-name cv-processor --zip-file fileb://function.zip

# Publish immutable version
VERSION=$(aws lambda publish-version --function-name cv-processor --query 'Version' --output text)

# Update alias to new version
aws lambda update-alias \
  --function-name cv-processor \
  --name production \
  --function-version $VERSION
```

Pros: Immutable versions, easy rollback.
Cons: More complex workflow.

**3. Blue/green with traffic shifting:**
```bash
aws lambda update-alias \
  --function-name cv-processor \
  --name production \
  --routing-config AdditionalVersionWeights={"2"=0.10}  # 10% traffic to v2
```

Pros: Gradual rollout, canary testing.
Cons: Requires aliases and versions.

**4. CloudFormation/SAM deployment:**
```yaml
# template.yaml
Resources:
  ProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: index.handler
      Runtime: nodejs18.x
```

```bash
sam build
sam deploy
```

Pros: Infrastructure-as-code, repeatable.
Cons: Slower deployment.

CV Analytics uses simple update-function-code (sufficient for small projects).

### Function Versioning

**Lambda versions:**
- `$LATEST`: Mutable, always points to latest code
- `1, 2, 3, ...`: Immutable versions

**Publishing version:**
```bash
aws lambda publish-version \
  --function-name cv-processor \
  --description "Deploy from commit abc123"
```

Returns version number (e.g., 5).

**Aliases** (pointers to versions):
```bash
aws lambda create-alias \
  --function-name cv-processor \
  --name production \
  --function-version 5
```

Invoke via alias: `arn:aws:lambda:us-east-1:ACCOUNT:function:cv-processor:production`

**Rollback to previous version:**
```bash
aws lambda update-alias \
  --function-name cv-processor \
  --name production \
  --function-version 4  # Previous stable version
```

CV Analytics doesn't use versions/aliases yet (planned for Part 6: Semantic Versioning).

### CloudWatch Integration

**CloudWatch Logs automatic:**

Lambda automatically sends logs to CloudWatch Logs. No configuration needed.

**Log group naming:**
```
/aws/lambda/cv-processor
/aws/lambda/cv-reporter
```

**Logging in Node.js:**
```javascript
exports.handler = async (event) => {
    console.log('Processing event:', JSON.stringify(event));
    // Appears in CloudWatch Logs
};
```

**Structured logging** (recommended):
```javascript
const log = (level, message, context = {}) => {
    console.log(JSON.stringify({
        level,
        message,
        timestamp: new Date().toISOString(),
        ...context
    }));
};

log('info', 'Processing CV event', { eventId: event.id });
```

**Viewing logs in workflow:**
```yaml
- name: Check recent logs
  run: |
    aws logs tail /aws/lambda/cv-processor \
      --since 5m \
      --follow
```

**CloudWatch metrics:**
- Invocations (count)
- Duration (ms)
- Errors (count)
- Throttles (count)
- Concurrent executions

Accessible via AWS Console or CLI.

Lambda pipelines complete. Next: secrets management across all workflows.

---

## Secrets Management

CV Analytics uses 12+ secrets across 6 repositories and 3 cloud providers. GitHub Secrets provides encrypted storage. Secrets never appear in logs or workflow files.

**Multi-cloud secrets coordination:**
- **Angular CV site** (Vercel): `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`
- **Cloudflare Worker**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `AWS_ACCESS_KEY_ID` (for DynamoDB)
- **React Dashboard** (Firebase): `FIREBASE_TOKEN`, `GCP_PROJECT_ID`
- **GCP Webhook** (Cloud Functions): `GCP_SA_KEY`, `GCP_PROJECT_ID`, `WEBHOOK_SECRET_NAME`
- **AWS Processor** (Lambda): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GCP_WEBHOOK_URL`
- **AWS Reporter** (Lambda): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### Secrets Flow Architecture

```mermaid
graph TB
    DEV[Developer] -->|One-time setup| SECRETS[GitHub Repository Secrets]
    
    subgraph "GitHub Secrets Storage (AES-256)"
        SECRETS --> DASH_SECRET[FIREBASE_TOKEN]
        SECRETS --> WEBHOOK_SECRET1[GCP_SA_KEY]
        SECRETS --> WEBHOOK_SECRET2[GCP_PROJECT_ID]
        SECRETS --> PROCESSOR_SECRET1[AWS_ACCESS_KEY_ID]
        SECRETS --> PROCESSOR_SECRET2[AWS_SECRET_ACCESS_KEY]
        SECRETS --> REPORTER_SECRET1[AWS_ACCESS_KEY_ID]
        SECRETS --> REPORTER_SECRET2[AWS_SECRET_ACCESS_KEY]
    end
    
    subgraph "Workflow Execution"
        DASH_SECRET --> DASH_WORKFLOW[Dashboard Workflow]
        WEBHOOK_SECRET1 --> WEBHOOK_WORKFLOW[Webhook Workflow]
        WEBHOOK_SECRET2 --> WEBHOOK_WORKFLOW
        PROCESSOR_SECRET1 --> PROCESSOR_WORKFLOW[Processor Workflow]
        PROCESSOR_SECRET2 --> PROCESSOR_WORKFLOW
        REPORTER_SECRET1 --> REPORTER_WORKFLOW[Reporter Workflow]
        REPORTER_SECRET2 --> REPORTER_WORKFLOW
    end
    
    subgraph "Cloud Providers"
        DASH_WORKFLOW -->|Authenticated deploy| FIREBASE[Firebase Hosting]
        WEBHOOK_WORKFLOW -->|Authenticated deploy| GCP[Cloud Functions]
        PROCESSOR_WORKFLOW -->|Authenticated deploy| AWS1[Lambda Processor]
        REPORTER_WORKFLOW -->|Authenticated deploy| AWS2[Lambda Reporter]
    end
    
    style DEV fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style SECRETS fill:#fff3e0,stroke:#f57c00,stroke-width:3px
    style DASH_SECRET fill:#ffe0b2,stroke:#f57c00,stroke-width:1px
    style WEBHOOK_SECRET1 fill:#ffe0b2,stroke:#f57c00,stroke-width:1px
    style WEBHOOK_SECRET2 fill:#ffe0b2,stroke:#f57c00,stroke-width:1px
    style PROCESSOR_SECRET1 fill:#ffe0b2,stroke:#f57c00,stroke-width:1px
    style PROCESSOR_SECRET2 fill:#ffe0b2,stroke:#f57c00,stroke-width:1px
    style REPORTER_SECRET1 fill:#ffe0b2,stroke:#f57c00,stroke-width:1px
    style REPORTER_SECRET2 fill:#ffe0b2,stroke:#f57c00,stroke-width:1px
    style DASH_WORKFLOW fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style WEBHOOK_WORKFLOW fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style PROCESSOR_WORKFLOW fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style REPORTER_WORKFLOW fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style FIREBASE fill:#b3e5fc,stroke:#0277bd,stroke-width:2px
    style GCP fill:#b3e5fc,stroke:#0277bd,stroke-width:2px
    style AWS1 fill:#ffccbc,stroke:#d84315,stroke-width:2px
    style AWS2 fill:#ffccbc,stroke:#d84315,stroke-width:2px
```

### GitHub Secrets Configuration

**Adding secrets via UI:**
1. Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: FIREBASE_TOKEN
4. Value: (paste secret)
5. Click "Add secret"

**Adding secrets via CLI:**
```bash
# Using GitHub CLI
gh secret set FIREBASE_TOKEN < token.txt

# Using GitHub API
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"encrypted_value":"...","key_id":"..."}' \
  https://api.github.com/repos/OWNER/REPO/actions/secrets/FIREBASE_TOKEN
```

**Organisation secrets** (shared across repos):

For AWS credentials used by processor + reporter:
1. Organisation → Settings → Secrets
2. Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
3. Select repository access (All repositories or Selected repositories)

CV Analytics uses repository-level secrets (clearer permissions).

### CV Analytics Secrets Inventory

**1. Dashboard repository:**
- `FIREBASE_TOKEN`: Service account key for Firebase deployment
- **Generation:** `firebase login:ci` or GCP Console → IAM → Service Accounts
- **Permissions:** Firebase Admin

**2. Webhook repository:**
- `GCP_SA_KEY`: Service account JSON key for Cloud Functions deployment
  - **Generation:** `gcloud iam service-accounts keys create key.json`
  - **Permissions:** Cloud Functions Developer, Service Account User
- `GCP_PROJECT_ID`: GCP project ID (e.g., cv-analytics-prod)
  - **Not sensitive** but stored as secret for consistency

**3. Processor repository:**
- `AWS_ACCESS_KEY_ID`: IAM user access key
  - **Generation:** AWS Console → IAM → Users → Security credentials
  - **Permissions:** lambda:UpdateFunctionCode, lambda:UpdateFunctionConfiguration
- `AWS_SECRET_ACCESS_KEY`: IAM user secret access key
  - **Generation:** Same as access key (shown once at creation)
- `SQS_QUEUE_URL`: SQS queue URL (e.g., https://sqs.us-east-1.amazonaws.com/123456789/cv-queue)
  - **Not sensitive** but stored as secret for environment isolation

**4. Reporter repository:**
- `AWS_ACCESS_KEY_ID`: Same IAM user as processor (or separate user)
- `AWS_SECRET_ACCESS_KEY`: Same secret key

**Total:** 7 secrets across 4 repositories.

### Security Best Practices

**1. Never commit secrets to git:**

Add to .gitignore:
```gitignore
# Secrets
*.pem
*.key
*.json
key.txt
secrets/
.env
.env.local
```

**2. Use secret references, never hardcode:**

✗ **Bad:**
```yaml
run: firebase deploy --token "1//abc123xyz..."
```

✓ **Good:**
```yaml
env:
  FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
run: firebase deploy --token "$FIREBASE_TOKEN"
```

**3. Mask secrets in logs:**

GitHub Actions automatically masks secret values. Never echo secrets:

✗ **Bad:**
```yaml
run: echo "Token: ${{ secrets.FIREBASE_TOKEN }}"
```

✓ **Good:**
```yaml
run: echo "Token configured"
```

**4. Use environment-specific secrets:**

```yaml
# Production workflow
env:
  FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN_PROD }}

# Staging workflow
env:
  FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN_STAGING }}
```

**5. Limit secret access with environment protection:**

```yaml
jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval
    steps:
      - run: deploy-to-prod
```

Environment secrets override repository secrets.

**6. Use OIDC instead of long-lived keys** (where possible):

**GCP Workload Identity Federation:**
```yaml
- uses: google-github-actions/auth@v1
  with:
    workload_identity_provider: 'projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github'
    service_account: 'github-actions@PROJECT.iam.gserviceaccount.com'
```

No `GCP_SA_KEY` needed (GitHub generates short-lived token).

**AWS OIDC:**
```yaml
- uses: aws-actions/configure-aws-credentials@v2
  with:
    role-to-assume: arn:aws:iam::ACCOUNT:role/github-actions-role
    aws-region: us-east-1
```

No `AWS_SECRET_ACCESS_KEY` needed (GitHub exchanges OIDC token for AWS credentials).

### Secret Rotation Strategies

**1. Rotate on schedule:**

- **Firebase tokens:** Rotate every 90 days
- **GCP service account keys:** Rotate every 90 days
- **AWS access keys:** Rotate every 90 days

**Rotation procedure:**
1. Generate new key in cloud provider
2. Update GitHub Secret
3. Test workflow with new key
4. Delete old key in cloud provider

**2. Rotate on personnel changes:**

Developer leaves team? Rotate all secrets they had access to.

**3. Rotate on suspected compromise:**

Secret leaked in logs? Rotate immediately:
```bash
# GCP
gcloud iam service-accounts keys delete KEY_ID --iam-account SA_EMAIL
gcloud iam service-accounts keys create new-key.json --iam-account SA_EMAIL

# Update GitHub Secret
gh secret set GCP_SA_KEY < new-key.json

# AWS
aws iam delete-access-key --access-key-id AKIAIOSFODNN7EXAMPLE
aws iam create-access-key --user-name github-actions

# Update GitHub Secrets
gh secret set AWS_ACCESS_KEY_ID --body "AKIA..."
gh secret set AWS_SECRET_ACCESS_KEY --body "wJalr..."
```

**4. Automate rotation with GitHub Actions:**

```yaml
name: Rotate Secrets

on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly on 1st
  workflow_dispatch:     # Manual trigger

jobs:
  rotate-gcp-keys:
    runs-on: ubuntu-latest
    steps:
      - name: Generate new GCP key
        run: |
          gcloud iam service-accounts keys create new-key.json \
            --iam-account github-actions@PROJECT.iam.gserviceaccount.com
          
          # Update GitHub Secret via API
          gh secret set GCP_SA_KEY < new-key.json
          
          # Delete old keys (keep 1 previous)
          gcloud iam service-accounts keys list \
            --iam-account github-actions@PROJECT.iam.gserviceaccount.com \
            --format="value(name)" |
            tail -n +3 |
            xargs -I {} gcloud iam service-accounts keys delete {} --quiet
```

CV Analytics rotates manually every 90 days (automation planned for future).

### Never Log Secrets

**GitHub Actions automatic masking:**

Secrets are automatically masked in logs:
```yaml
env:
  SECRET: ${{ secrets.MY_SECRET }}
run: echo "Secret: $SECRET"
```

Output: `Secret: ***`

**Masking additional values:**
```yaml
run: |
  TOKEN=$(generate-token)
  echo "::add-mask::$TOKEN"
  echo "Token: $TOKEN"  # Will be masked
```

**Common leakage scenarios:**

✗ **Base64 encoding doesn't hide secrets:**
```yaml
run: echo "${{ secrets.TOKEN }}" | base64  # Still logged!
```

✗ **Secrets in multiline strings:**
```yaml
run: |
  cat <<EOF
  {
    "token": "${{ secrets.TOKEN }}"  # Might not be masked
  }
  EOF
```

✗ **Secrets in error messages:**
```javascript
try {
    await deploy(process.env.FIREBASE_TOKEN);
} catch (error) {
    console.error('Deployment failed:', error);  // Might include token
}
```

✓ **Safe error handling:**
```javascript
try {
    await deploy(process.env.FIREBASE_TOKEN);
} catch (error) {
    console.error('Deployment failed:', error.message);  // No token
}
```

Secrets management complete. Next: understanding independent deployment triggers.

---

## Independent Deployment Triggers

CV Analytics runs 6 independent pipelines across 3 clouds. Services deploy separately. No coordinated releases. Angular site updates don't wait for Cloudflare Worker changes. React dashboard updates don't wait for GCP webhook changes.

**Exception:** AWS Lambda Processor deployment requires GCP Cloud Function webhook URL (cross-cloud dependency). GitHub Actions handles this with artifact outputs.

### 4 Parallel Deployment Pipelines

```mermaid
graph TB
    subgraph "Dashboard Repository"
        DASH_COMMIT[Git Push] --> DASH_TRIGGER[on: push main]
        DASH_TRIGGER --> DASH_BUILD[Build React]
        DASH_BUILD --> DASH_DEPLOY[Deploy to Firebase]
        DASH_DEPLOY --> DASH_LIVE[Live: cv-dashboard.web.app]
    end
    
    subgraph "Webhook Repository"
        WEBHOOK_COMMIT[Git Push] --> WEBHOOK_TRIGGER[on: push main]
        WEBHOOK_TRIGGER --> WEBHOOK_BUILD[Build Go]
        WEBHOOK_BUILD --> WEBHOOK_DEPLOY[Deploy to Cloud Functions]
        WEBHOOK_DEPLOY --> WEBHOOK_LIVE[Live: cloudfunctions.net]
    end
    
    subgraph "Processor Repository"
        PROCESSOR_COMMIT[Git Push] --> PROCESSOR_TRIGGER[on: push main]
        PROCESSOR_TRIGGER --> PROCESSOR_BUILD[Build Node.js]
        PROCESSOR_BUILD --> PROCESSOR_DEPLOY[Deploy to Lambda]
        PROCESSOR_DEPLOY --> PROCESSOR_LIVE[Live: Lambda Processor]
    end
    
    subgraph "Reporter Repository"
        REPORTER_COMMIT[Git Push] --> REPORTER_TRIGGER[on: push main/schedule]
        REPORTER_TRIGGER --> REPORTER_BUILD[Build Node.js]
        REPORTER_BUILD --> REPORTER_DEPLOY[Deploy to Lambda]
        REPORTER_DEPLOY --> REPORTER_LIVE[Live: Lambda Reporter]
    end
    
    style DASH_COMMIT fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style DASH_BUILD fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style DASH_DEPLOY fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style DASH_LIVE fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    
    style WEBHOOK_COMMIT fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style WEBHOOK_BUILD fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style WEBHOOK_DEPLOY fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style WEBHOOK_LIVE fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    
    style PROCESSOR_COMMIT fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style PROCESSOR_BUILD fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style PROCESSOR_DEPLOY fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style PROCESSOR_LIVE fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    
    style REPORTER_COMMIT fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style REPORTER_BUILD fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style REPORTER_DEPLOY fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style REPORTER_LIVE fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
```

### Per-Service Pipeline Triggers

**Dashboard trigger:**
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'package.json'
```

Only deploys when dashboard code changes. Webhook updates don't trigger dashboard deployment.

**Webhook trigger:**
```yaml
on:
  push:
    branches: [main]
    paths:
      - '**.go'
      - 'go.mod'
```

Only deploys when Go code changes. Dashboard updates don't trigger webhook deployment.

**Processor trigger:**
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package.json'
```

Only deploys when processor code changes.

**Reporter trigger (dual):**
```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 8 * * *'  # Daily at 8am UTC
```

Deploys on code changes AND runs daily report generation.

### No Coordinated Deployments

**Why independent deployments?**

Microservices promise independent evolution. Coordinated deployments break this promise:

✗ **Coordinated (monolith thinking):**
- Deploy all services together
- Wait for all tests to pass
- One service failure blocks all deployments
- Slow feedback loop

✓ **Independent (microservices thinking):**
- Deploy each service separately
- Each service tests independently
- One failure doesn't block others
- Fast feedback loop

**CV Analytics independence:**
- Dashboard deploys 10x/week
- Webhook deploys 2x/week
- Processor deploys 5x/week
- Reporter deploys 1x/week

Different velocity for different needs.

**When coordination IS needed:**

Breaking API changes require coordination:
1. Webhook changes event schema
2. Processor expects old schema
3. Processor breaks

**Solution:** Backward compatibility (Part 6: Semantic Versioning)

### Branch Protection Rules

Prevent broken code from reaching main:

**Repository → Settings → Branches → Add rule:**

**Required settings:**
- ✓ Require pull request reviews (1 approver minimum)
- ✓ Require status checks to pass before merging
  - ✓ tests (must pass)
  - ✓ build (must succeed)
- ✓ Require branches to be up to date before merging
- ✓ Require linear history (no merge commits)
- ✓ Do not allow bypassing the above settings

**Status checks workflow:**
```yaml
name: Tests

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

PR cannot merge until tests pass.

**CV Analytics branch protection:**
- All 4 repositories protected
- Required: tests, build
- Solo developer (no review requirement)
- Production deploys only from main

### Pull Request Checks

**Automated checks before merge:**

**1. Tests:**
```yaml
- name: Run unit tests
  run: npm test -- --coverage
  
- name: Fail if coverage below 80%
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      echo "Coverage $COVERAGE% below threshold 80%"
      exit 1
    fi
```

**2. Linting:**
```yaml
- name: Lint code
  run: npm run lint
  
- name: Check formatting
  run: npm run format:check
```

**3. Build verification:**
```yaml
- name: Build production bundle
  run: npm run build
  
- name: Check bundle size
  run: |
    SIZE=$(du -sk build | cut -f1)
    if [ $SIZE -gt 5000 ]; then  # 5MB limit
      echo "Bundle size $SIZE KB exceeds limit"
      exit 1
    fi
```

**4. Security scanning:**
```yaml
- name: Audit dependencies
  run: npm audit --audit-level=high
  
- name: Scan for secrets
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
```

**Pull request workflow** (runs on PR, not deployment):
```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build
```

PR checks run in parallel with main branch deployments (different triggers).

### Manual Approval Gates

**GitHub Environments** provide manual approval:

**Repository → Settings → Environments → New environment:**
- Name: production
- ✓ Required reviewers (select reviewers)
- ✓ Wait timer (optional, e.g., 5 minutes)

**Workflow with approval:**
```yaml
jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    steps:
      - run: deploy-to-production
```

**Approval flow:**
1. Workflow triggered
2. Reaches `environment: production` job
3. Pauses, waits for reviewer approval
4. Reviewer clicks "Approve and deploy" in GitHub UI
5. Workflow continues

**CV Analytics doesn't use approval gates:**
- Solo developer (no reviewer needed)
- Branch protection provides safety
- Serverless rollback is fast (if needed)

**When to use approval gates:**
- Production deployments in team environments
- Financial/healthcare applications (compliance)
- Major version releases
- Infrastructure changes (Terraform)

CV Analytics relies on automated tests instead of manual approvals.

---

## Troubleshooting Common Failures

Pipelines fail. Authentication expires. Dependencies break. Here's how CV Analytics troubleshoots common failures.

### Authentication Errors

**Symptom:** Deployment fails with "Invalid credentials" or "Permission denied".

**Causes:**
1. Expired service account key
2. Insufficient IAM permissions
3. Wrong secret name in workflow
4. Secret not configured in repository

**Diagnosis:**

**GCP authentication failure:**
```
Error: google.auth.exceptions.RefreshError: The credentials do not contain the required field: type
```

**Check:**
```yaml
- name: Debug GCP auth
  run: |
    echo "GCP_SA_KEY length: ${#GCP_SA_KEY}"
    echo "First 50 chars: ${GCP_SA_KEY:0:50}"
  env:
    GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
```

If length is 0, secret not configured.

**AWS authentication failure:**
```
Error: The security token included in the request is invalid
```

**Check:**
```yaml
- name: Debug AWS auth
  run: |
    aws sts get-caller-identity
```

Shows authenticated user/role. Fails if credentials invalid.

**Fixes:**
1. Regenerate service account key:
   ```bash
   gcloud iam service-accounts keys create new-key.json \
     --iam-account SA_EMAIL
   ```
2. Update GitHub Secret
3. Verify IAM permissions:
   ```bash
   gcloud projects get-iam-policy PROJECT_ID \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:SA_EMAIL"
   ```

### Build Failures

**Symptom:** Build fails with dependency errors.

**Common causes:**

**1. Dependency version conflicts:**
```
npm ERR! Could not resolve dependency:
npm ERR! peer react@"^17.0.0" from react-router-dom@6.0.0
```

**Fix:**
```bash
npm install react@17.0.0
npm ci  # Verify lock file updated
```

**2. Missing dependencies:**
```
Error: Cannot find module '@google-cloud/firestore'
```

**Fix:**
```bash
npm install @google-cloud/firestore
```

**3. Outdated lock file:**
```
npm ERR! Errors were found in package-lock.json
```

**Fix:**
```bash
rm package-lock.json
npm install
git commit -am "fix: update package-lock.json"
```

**4. Platform-specific dependencies:**
```
Error: The module './native.node' was compiled against a different Node.js version
```

**Fix:** Use `--platform=linux` in package.json:
```json
{
  "scripts": {
    "build": "npm rebuild --platform=linux"
  }
}
```

**Debugging build failures:**
```yaml
- name: Debug build
  run: |
    node --version
    npm --version
    npm list  # Show dependency tree
    cat package-lock.json | jq '.packages."node_modules/problematic-package"'
```

### Deployment Timeouts

**Symptom:** Workflow times out during deployment.

**GitHub Actions timeout:** 6 hours (default), 360 minutes (configurable).

**Common timeout scenarios:**

**1. Firebase Hosting deployment hangs:**
```yaml
- name: Deploy to Firebase
  timeout-minutes: 10  # Fail after 10 minutes
  run: firebase deploy --only hosting
```

**2. Lambda deployment large package:**
```
Error: Timed out waiting for function update
```

**Fix:** Reduce package size:
```bash
# Before: 60 MB (slow)
zip -r function.zip .

# After: 5 MB (fast)
npm ci --production  # Remove devDependencies
zip -r function.zip . -x "tests/*" -x "*.md"
```

**3. Cloud Functions build timeout:**
```yaml
--timeout 540s  # 9 minutes (Gen 1 max)
--timeout 3600s  # 60 minutes (Gen 2 max)
```

Increase if function initialization takes long.

**Workflow timeout configuration:**
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30  # Fail after 30 minutes
    steps:
      - name: Deploy
        timeout-minutes: 10  # Step-level timeout
        run: deploy-command
```

### Rate Limiting

**Symptom:** Deployment fails with "Rate limit exceeded" or "Too many requests".

**GitHub Actions rate limits:**
- API requests: 1,000/hour per repository
- Workflow runs: Unlimited
- Concurrent jobs: 20 (free), 60 (Team), 180 (Enterprise)

**Cloud provider rate limits:**

**GCP Cloud Functions:**
- Deployments: 60/minute per region
- API calls: 100/second

**AWS Lambda:**
- UpdateFunctionCode: 10/second per region
- Concurrent executions: 1,000 (default, adjustable)

**Firebase Hosting:**
- Deployments: 10/hour per project

**Mitigation strategies:**

**1. Add retry logic:**
```yaml
- name: Deploy with retry
  uses: nick-invision/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    retry_wait_seconds: 60
    command: firebase deploy --only hosting
```

**2. Throttle deployments:**
```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '*/15 * * * *'  # Max every 15 minutes
```

**3. Request limit increase:**
- GCP: https://console.cloud.google.com/iam-admin/quotas
- AWS: https://console.aws.amazon.com/servicequotas

**4. Batch multiple changes:**

Instead of deploying on every commit, deploy on PR merge:
```yaml
on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  deploy:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - run: deploy
```

### Rollback Procedures

**When deployment succeeds but breaks production:**

**1. Revert git commit:**
```bash
git revert HEAD
git push origin main
# Triggers new deployment with previous code
```

Automatic rollback via CI/CD.

**2. Manual Lambda rollback:**
```bash
# List versions
aws lambda list-versions-by-function --function-name cv-processor

# Update alias to previous version
aws lambda update-alias \
  --function-name cv-processor \
  --name production \
  --function-version 4  # Previous version
```

**3. Cloud Functions rollback:**
```bash
# List revisions
gcloud functions describe webhook-receiver --region us-central1

# Rollback to previous revision
gcloud functions rollback webhook-receiver \
  --region us-central1 \
  --revision webhook-receiver-00002-abc
```

**4. Firebase Hosting rollback:**
```bash
# List deployments
firebase hosting:channel:list

# Rollback to previous deployment
firebase hosting:rollback
```

**5. Emergency workflow:**

Create manual rollback workflow:
```yaml
name: Emergency Rollback

on:
  workflow_dispatch:
    inputs:
      service:
        description: 'Service to rollback'
        required: true
        type: choice
        options:
          - dashboard
          - webhook
          - processor
          - reporter
      commit:
        description: 'Git commit SHA to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.event.inputs.commit }}
      
      - name: Deploy previous version
        run: |
          case ${{ github.event.inputs.service }} in
            dashboard) firebase deploy --only hosting ;;
            webhook) gcloud functions deploy webhook-receiver ;;
            processor) aws lambda update-function-code --function-name cv-processor ;;
            reporter) aws lambda update-function-code --function-name cv-reporter ;;
          esac
```

**Rollback best practices:**
- Keep last 3 versions (easy rollback)
- Monitor post-deployment metrics
- Automated health checks
- Rollback decision within 5 minutes
- Document rollback in incident log

---

## Practical Takeaways

Building CI/CD for multi-cloud microservices in 4 weeks:

### Week 1: Foundation

**Day 1-2: Setup GitHub Actions basics**
- ✓ Create .github/workflows/ directory in each repository
- ✓ Start with simple workflow (checkout code, run tests)
- ✓ Verify workflows trigger on push

**Day 3-4: Configure secrets**
- ✓ Generate service account keys (GCP, AWS)
- ✓ Store in GitHub Secrets
- ✓ Test authentication in workflows

**Day 5-7: Build first pipeline**
- ✓ Choose simplest service (dashboard recommended)
- ✓ Add build step
- ✓ Add deployment step
- ✓ Test end-to-end

### Week 2: Expand Coverage

**Day 8-10: Add remaining pipelines**
- ✓ Webhook pipeline (Go → Cloud Functions)
- ✓ Processor pipeline (Node.js → Lambda)
- ✓ Reporter pipeline (Node.js → Lambda)

**Day 11-12: Add testing**
- ✓ Unit tests in each pipeline
- ✓ Fail pipeline if tests fail
- ✓ Code coverage reporting

**Day 13-14: Path filters**
- ✓ Configure path filters (only deploy when code changes)
- ✓ Test that documentation changes don't trigger deployments

### Week 3: Hardening

**Day 15-17: Branch protection**
- ✓ Enable branch protection on main
- ✓ Require status checks
- ✓ Create PR workflow for testing

**Day 18-19: Monitoring**
- ✓ Add deployment verification steps
- ✓ Health check endpoints
- ✓ CloudWatch/Cloud Logging integration

**Day 20-21: Error handling**
- ✓ Add retry logic for transient failures
- ✓ Timeout configuration
- ✓ Notification on failures (Slack, email)

### Week 4: Optimisation

**Day 22-23: Dependency caching**
- ✓ Enable npm/Go module caching
- ✓ Measure build time improvement

**Day 24-25: Rollback procedures**
- ✓ Document rollback steps
- ✓ Create emergency rollback workflow
- ✓ Test rollback (controlled environment)

**Day 26-28: Documentation**
- ✓ README with pipeline architecture diagram
- ✓ Troubleshooting guide
- ✓ Runbook for common failures

### Key Principles

**1. Automate every deployment:**

Manual deployments don't scale. Every service should deploy via CI/CD. No exceptions.

✗ **Don't:**
- SSH into servers and copy files
- Run gcloud/aws commands locally
- Deploy from your laptop

✓ **Do:**
- Push to main branch
- Let pipeline handle deployment
- Verify via monitoring

**2. Never deploy manually:**

CI/CD is the only deployment path. Even for hotfixes:
```bash
git commit -m "hotfix: critical bug"
git push origin main
# Pipeline deploys automatically
```

**3. Test before deploying:**

Every pipeline should run tests:
```yaml
steps:
  - run: npm test
  - run: npm run lint
  - run: npm run build
  - run: deploy  # Only after tests pass
```

**4. Use secrets properly:**

Never commit secrets. Always use GitHub Secrets:
```yaml
env:
  SECRET: ${{ secrets.SECRET_NAME }}
```

**5. Monitor pipeline health:**

Set up notifications for failures:
```yaml
- name: Notify on failure
  if: failure()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -d '{"text":"Deployment failed: ${{ github.repository }}"}'
```

### What NOT to Do

✗ **Don't deploy without testing:**
Skipping tests to "save time" causes production incidents.

✗ **Don't hardcode secrets:**
Secrets in code get committed to git (forever).

✗ **Don't coordinate deployments:**
Microservices deploy independently. Coordination breaks velocity.

✗ **Don't skip branch protection:**
Broken code reaches production without gates.

✗ **Don't ignore failures:**
Failed pipelines indicate problems. Investigate immediately.

✗ **Don't use shared secrets across environments:**
Production and staging need separate secrets.

### Success Metrics

Measure CI/CD effectiveness:

**Deployment frequency:**
- Before: 2-3/week (manual)
- After: 20-30/week (automated)

**Lead time (commit to production):**
- Before: 30 minutes (manual)
- After: 5 minutes (automated)

**Deployment failure rate:**
- Before: 15% (manual errors)
- After: 5% (automated, with tests)

**Mean time to recovery:**
- Before: 45 minutes (manual rollback)
- After: 5 minutes (git revert + auto-deploy)

**Developer time saved:**
- Before: 11.75 hours/month on deployments
- After: 0 hours (fully automated)

CV Analytics achieved these metrics after 4 weeks of CI/CD implementation.

---

## What's Next

**Part 6: Semantic Versioning for Microservices**

Deployments automated. Now: how to version services independently.

Part 6 covers:
- ✓ SemVer 2.0.0 for microservices
- ✓ Git tagging strategies
- ✓ Breaking changes across services
- ✓ Deprecation policies
- ✓ Automated version bumps in CI/CD

**Focus:** Independent evolution without breaking consumers.

---

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [AWS Lambda Deployment](https://docs.aws.amazon.com/lambda/latest/dg/deploying-lambda-apps.html)
