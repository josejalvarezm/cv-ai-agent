# CV Analytics: Multi-Cloud Microservices at £0/Month (GCP Series: Real-time Analytics & Firestore, Part I)

*Eleven independent microservices across Cloudflare, AWS, and GCP, processing 3,000 queries per month with real-time analytics, all running at £0.00/month by exploiting free tiers and architectural patterns that scale.*

## Contents

- [The Dilemma](#the-dilemma)
- [What This Series Covers](#what-this-series-covers)
- [Series Prerequisites](#series-prerequisites)
- [Repository Structure](#repository-structure)
- [How to Use This Series](#how-to-use-this-series)
- [What Makes This Series Different](#what-makes-this-series-different)
- [Target Outcome](#target-outcome)
- [Call to Action](#call-to-action)

## The Dilemma

My CV chatbot responds in 1.87s P95 (LLM-dominated). Users ask about my TypeScript experience, AWS expertise, or specific projects. The system performs semantic search, retrieves context, and generates responses using an LLM. Fast, functional, and deployed.

But I had no idea what people were actually asking.

Which skills generate the most interest? Are users finding what they need? Do certain questions indicate gaps in my CV? Is the chatbot useful, or just technically impressive? Without analytics, every question about impact became guesswork.

Building analytics seemed straightforward: capture every query, store metadata, visualize patterns. The complication was cost. My chatbot runs at £0/month on free tiers. Analytics couldn't change that.

**The constraint:** £0/month operational cost. No exceptions.

This constraint eliminated obvious solutions. Real-time dashboards? CloudWatch Insights exceeds free tier limits. Managed databases? RDS costs £15/month minimum. Serverless frameworks? Vendor lock-in and hidden costs. API gateways? Free tier expires after 12 months.

What remained was harder but more valuable: patterns that work regardless of budget.

**Author context:** 25 years building systems. Cloud platforms are tools, not achievements. This series documents what worked, what failed, and why the constraint made the architecture better.

---

## What This Series Covers

### Part 1: Pure Microservices Architecture (11 Services, 3 Clouds)

I called my system "microservices" because it had multiple services across three clouds. Then I measured it.

**The 11 services:**

| # | Service | Purpose | Cloud |
|---|---------|---------|-------|
| 1 | **Portfolio CV** | User-facing portfolio | Cloudflare Pages |
| 2 | **CV Chatbot Widget** | Embeddable chat UI | Cloudflare Pages |
| 3 | **Admin Portal** | Content management dashboard | Cloudflare Pages |
| 4 | **D1 CV Worker** | Portfolio data API + D1 database | Cloudflare Workers |
| 5 | **Admin Worker** | Admin API + D1 database | Cloudflare Workers |
| 6 | **AI Agent** | Chatbot API with semantic search | Cloudflare Workers |
| 7 | **Analytics Dashboard** | Real-time visualization | Firebase Hosting (GCP) |
| 8 | **Webhook Receiver** | Event ingestion | GCP Cloud Functions |
| 9 | **Analytics Processor** | Batch aggregation | AWS Lambda |
| 10 | **Analytics Reporter** | Weekly email reports | AWS Lambda |
| 11 | **Infrastructure** | Terraform IaC (meta-project) | All clouds |

Shared databases? Services couldn't deploy independently. Synchronous API calls? Cloudflare Worker timeouts. Coupled deployments? "Microservices" in name only.

**The scoring system forced honesty:**

- Can services deploy independently? (Yes: 11 separate deployment pipelines)
- Do services own their data? (Mostly: AWS DynamoDB shared between Processor/Reporter)
- Are failures isolated? (Yes: Dashboard works even if AWS Lambda fails)
- Can services use different clouds? (Yes: Cloudflare + AWS + GCP)
- Can services use different technologies? (Yes: Angular, React, Go, TypeScript, Node.js)

**Result:** 87.5% purity score. Not perfect, but honest about trade-offs.

**What you'll learn:**

- Why "multi-cloud microservices" isn't vendor lock-in avoidance theater
- How to measure service independence across three cloud providers
- Which pure microservices patterns cost too much (API Gateway £30/month per cloud)
- Why Cloudflare Workers force async design (50ms CPU limit)

---

### Part 2: Event-Driven Architecture (Cloudflare → AWS → GCP Pipeline)

My first implementation: Cloudflare Worker tried calling AWS Lambda directly after each chatbot query. Simple, synchronous, and completely broken.

**What failed:**

- Cloudflare Worker timeout: 50ms CPU limit
- AWS Lambda cold start: 800ms
- Result: Worker timeouts, lost events, angry users waiting

**Event-driven solution (three clouds working together):**

1. **Cloudflare Worker** responds to user in 1.87s (LLM processing), analytics logged in 12ms fire-and-forget (no blocking)
2. Worker writes analytics event to **AWS DynamoDB** (`Query Events` table)
3. **DynamoDB Streams** automatically triggers **SQS** (FIFO queue)
4. **AWS Lambda** processes batches of 10 events asynchronously
5. Lambda posts processed analytics to **GCP Cloud Function** via HMAC-signed webhook
6. GCP writes to **Firestore** → **React Dashboard** updates in real-time

**Result:** 0% dropped events, instant user responses, £0 additional cost across three clouds

**What you'll learn:**

- Why Cloudflare Workers can't call Lambda directly (CPU time limits)
- How DynamoDB Streams eliminate polling (push-based event sourcing)
- Why SQS FIFO batching reduces Lambda costs by 90%
- How cross-cloud webhooks work (AWS → GCP with HMAC signatures)
- When to use three clouds instead of one (play to each platform's strengths)

---

### Part 3: Multi-Cloud Security (Cross-Cloud Webhook Authentication)

I deployed the GCP webhook receiver on Friday afternoon. No HMAC validation, "AWS Lambda is internal, it's fine."

By Monday morning: 347 fake events in my Firestore database. Someone discovered the public Cloud Function URL and flooded it. My dashboard showed garbage.

**The security problem:** AWS Lambda needs to call GCP Cloud Function across cloud boundaries. How do you authenticate cross-cloud requests without exposing credentials?

**The solution (HMAC signatures):**

1. **Shared secret** stored in AWS Secrets Manager + GCP Secret Manager
2. **AWS Lambda** signs payload with HMAC-SHA256 before sending
3. **GCP Cloud Function** validates signature with same secret
4. If signature matches → trusted AWS request. If not → reject
5. **Cost:** £0 (cryptographic hashing is free)
6. **Implementation:** 20 minutes
7. **Result:** 100% fake events blocked

**What you'll learn:**

- Why public Cloud Functions need authentication (discoverable URLs)
- How HMAC-SHA256 works for cross-cloud webhook security
- Why Cloudflare Worker doesn't need HMAC (it writes directly to DynamoDB with IAM)
- How to store secrets across three clouds (AWS Secrets Manager, GCP Secret Manager, Cloudflare env vars)
- What I chose not to build: VPN tunnel between AWS/GCP (£50/month), API Gateway per cloud (£60/month combined), mTLS certificates (complexity)

---

### Part 4: Terraform Multi-Cloud (AWS + GCP in One Codebase)

I provisioned my first Cloud Function through the GCP console. Seven clicks, two dropdown menus, one confused moment about VPC settings. It worked.

Then I provisioned AWS Lambda through the console. Different UI, different concepts, different settings. When I needed staging environments, I clicked through both consoles twice. Different memory settings. Forgot AWS timeout. Spent 45 minutes debugging why staging behaved differently.

**The Terraform solution (two clouds, one codebase):**

```hcl
# AWS Provider
provider "aws" {
  region = "us-east-1"
}

# GCP Provider
provider "google" {
  project = "cv-analytics-dashboard"
  region  = "us-central1"
}

# AWS Lambda
resource "aws_lambda_function" "processor" {
  function_name = "cv-analytics-processor"
  runtime       = "nodejs20.x"
  memory_size   = 512
  timeout       = 60
}

# GCP Cloud Function
resource "google_cloudfunctions2_function" "webhook" {
  name     = "cv-analytics-webhook"
  runtime  = "go122"
  location = "us-central1"
}
```

One definition, infinite environments. Change memory, run `terraform apply`, both clouds update. No clicking. No drift.

**What you'll learn:**

- Why multi-cloud Terraform beats console clicking (version control + repeatability)
- How to manage AWS + GCP providers in same codebase (separate state, shared variables)
- How to handle cross-cloud dependencies (AWS Lambda needs GCP webhook URL)
- Which Terraform features free tier supports (all of them, Terraform CLI is free, both cloud APIs free tier)
- What I chose not to build: Pulumi (less mature), CloudFormation + Deployment Manager (vendor lock-in), Terraform Cloud paid (£0 constraint)

---

### Part 5: GitHub Actions CI/CD (From 45 Minutes to 4 Minutes)

Manual deployment process (first attempt):

1. SSH into my laptop
2. Pull latest code
3. Run tests locally (4 minutes)
4. Build production bundle (2 minutes)
5. Deploy to GCP (5 minutes)
6. Deploy to AWS (5 minutes)
7. Verify endpoints (2 minutes)
8. Update README (1 minute)
9. Pray nothing broke

**Total: 19 minutes per service × 4 services = 76 minutes minimum.**

Worse: I deployed dashboard with a typo in the Firestore query. Broke production for 15 minutes while I fixed it locally and re-deployed. Users saw blank dashboard.

**GitHub Actions automation:**

- Push to main → Tests run automatically (2 minutes)
- Tests pass → Deploy to staging automatically (1 minute)
- Manual approval → Deploy to production (1 minute)
- **Total: 4 minutes hands-off time**

**What you'll learn:**

- Why GitHub Actions free tier is generous (2,000 minutes/month, way more than needed)
- How to deploy AWS + GCP from same workflow (service account keys in GitHub Secrets)
- When manual approval gates matter (production only, staging deploys automatically)
- What I chose not to build: Jenkins server (£10/month EC2), CircleCI paid tier (£15/month), AWS CodePipeline (£1 per active pipeline)

---

### Part 6: Semantic Versioning (The Breaking Change I Didn't Label)

I changed the DynamoDB table schema. Added a new required field: `eventType`. Deployed the Processor Lambda first (writes new field). Reporter Lambda still expected old schema (didn't read new field). Reports broke for 3 hours.

**The mistake:** I versioned the Processor as v1.2.1 (patch). Should have been v2.0.0 (major, breaking change).

**SemVer would have caught this:**

- v1.2.1 (patch): Bug fixes, no API changes → Safe to deploy independently
- v1.3.0 (minor): New features, backward compatible → Safe to deploy independently
- v2.0.0 (major): Breaking changes → Requires coordinated deployment

Seeing v2.0.0 would have warned me: "Wait, this breaks downstream services."

**What you'll learn:**

- How to identify breaking changes before they break production (schema changes, removed fields, changed response formats)
- Why Git tags matter for rollback (tag v1.2.0, deploy fails, revert to v1.2.0 immediately)
- When services can deploy independently (minor/patch) vs require coordination (major)
- What I chose not to build: API versioning gateway (£30/month), complex migration framework, blue-green deployment infrastructure (£15/month for duplicate resources)

---

### Part 7: Real-Time Dashboard (Cross-Cloud WebSocket Updates)

First dashboard implementation: Poll Firestore every 5 seconds to check for new chatbot queries.

**Cost calculation (polling):**

- 5-second poll interval = 12 requests/minute = 720 requests/hour
- 10 hours active dashboard per week = 7,200 reads/week
- Firestore free tier: 50,000 reads/day
- **Result:** Within free tier, but wasteful (99% of polls return "no changes")

**WebSocket implementation (Firestore onSnapshot):**

**The complete real-time flow:**

1. User asks question in **Angular app**
2. **Cloudflare Worker** responds in 12ms
3. Worker writes event to **AWS DynamoDB**
4. **AWS Lambda** processes analytics (2-5 seconds later)
5. Lambda posts to **GCP Cloud Function** webhook
6. GCP writes to **Firestore**
7. **React Dashboard** subscribed via `onSnapshot` → **Instant update** (200ms from Firestore write)

**Cost:**

- 1 WebSocket connection per dashboard session
- 50 reads on initial load + 1 read per new query
- 10 hours per week = ~100 reads/week
- **Result: 98% reduction in reads, updates appear 200ms after AWS processes**

**What you'll learn:**

- Why polling wastes free tier quota (720 req/hr vs 1 connection)
- How Firestore onSnapshot enables cross-cloud real-time (AWS → GCP → Browser)
- When 2-5 second delay is acceptable (analytics don't need instant, but dashboard does)
- Why React + Firebase Hosting is perfect for real-time dashboards (built-in WebSocket support)
- What I chose not to build: Custom WebSocket server (£5/month EC2), Pusher (£10/month), Socket.io self-hosted (operational overhead)

---

### Part 8: Cost Optimization (Three Clouds at £0/Month for 6 Months)

**Actual costs (May - November 2025):**

```plaintext
Cloudflare:
- Workers: £0.00 (10,000 requests / 100K free tier = 10%)
- CPU time: £0.00 (120ms total / 10ms per request)

AWS:
- Lambda (Processor): £0.00 (500 invocations / 1M free tier = 0.05%)
- Lambda (Reporter): £0.00 (4 invocations/month weekly reports)
- DynamoDB: £0.00 (0.8 GB / 25 GB always-free = 3.2%)
- SQS: £0.00 (1,000 messages / 1M free tier = 0.1%)
- SES: £0.00 (4 emails/month / 3,000 free with EC2 = N/A, pay £0.10/1000)

GCP:
- Cloud Functions: £0.00 (500 invocations / 2M free tier = 0.025%)
- Firestore: £0.00 (2,000 reads/month / 50K reads/day free = 0.13%)
- Firebase Hosting: £0.00 (150 KB bundle / 10 GB free tier = 0.0015%)

Total across three clouds: £0.00 for 6 consecutive months
```

**The batching discovery (90% cost reduction):**

Before batching: 1,000 DynamoDB events = 1,000 Lambda invocations.
After batching (size 10): 1,000 events = 100 Lambda invocations.
**Result:** 90% fewer Lambda executions (and 0% → 0% is still 0%, but scales 10x further).

**The cross-cloud efficiency insight:**

Using three clouds costs the same as using one (£0), but leverages each platform's strengths:

- **Cloudflare:** Edge compute with 50ms CPU limit → Forces fire-and-forget pattern
- **AWS:** Best batch processing + email (Lambda + DynamoDB + SES mature ecosystem)
- **GCP:** Best real-time database (Firestore native WebSocket support)

**What you'll learn:**

- How to run production workload across three clouds at £0/month
- Why batching saves 90% Lambda costs (SQS batch size 10 vs individual events)
- Which free tiers are permanent vs temporary (DynamoDB 25 GB forever, Cloudflare Workers 100K req/day forever, GCP Cloud Functions 2M/month forever)
- When multi-cloud makes sense (free tier limits reset per cloud → 3x capacity)
- When to scale up (>100K queries/month → Cloudflare £5, AWS £5-10, GCP £5 = £15-20/month)
- What I chose not to build: Single cloud (hits limits faster), Reserved capacity (requires commitment), Provisioned concurrency (£5.40/month per Lambda)

---

### Part 9: Webhook Resilience (Cross-Cloud Failure Handling)

12-minute Firestore outage. 47 lost analytics records. No alerts. No recovery path.

**The mistake:** Webhooks failed silently. Lambda logged errors and moved on. No retries. No dead letter queue. No way to replay failed deliveries.

**Three-layer resilience strategy:**

1. **Exponential backoff (1s, 2s, 4s delays)** → Recovers 99.2% of transient failures
2. **DynamoDB DLQ** → Stores permanent failures for manual replay (7-day TTL)
3. **Graceful degradation** → Main system works even when webhooks fail

**Before resilience improvements:**

```plaintext
Webhook failure → Log error → Move on → Data lost forever
```

**After resilience improvements:**

```plaintext
Webhook failure → Retry 3x with exponential backoff → Still failed? → Store in DLQ → CloudWatch alarm → Manual investigation & replay
```

**Result:** 0 lost records over 6 months, £0/month additional cost.

**What you'll learn:**

- Why exponential backoff matters for cross-cloud webhooks (AWS ↔ GCP)
- How to implement retry logic without infinite loops
- When to give up and store in DLQ (after 3 retries, ~7 seconds)
- Manual DLQ replay procedures (TypeScript script included)
- Cost analysis: Does retry logic increase Lambda execution time? (Spoiler: stays in free tier)
- HMAC signature failures across cloud boundaries (human error, not clock skew)
- What I chose not to build: Automated DLQ replay Lambda (manual replay works fine at small scale), distributed tracing (correlating logs by requestId works)

---

## Series Prerequisites

**Required knowledge:**

- Basic command-line proficiency (Git, npm, CLI tools)
- Understanding of HTTP, REST APIs, and webhooks
- Familiarity with at least one cloud provider (AWS or GCP)
- JavaScript/TypeScript or Go (for code examples)

**Nice to have:**

- Docker/containerization concepts
- CI/CD basics (GitHub Actions or similar)
- NoSQL database experience (DynamoDB, Firestore)

**What you don't need:**

- Kubernetes or container orchestration
- Advanced infrastructure knowledge
- Multi-cloud experience (we'll cover it)

---

## Repository Structure

All code is production-ready across 11 repositories:

| Repository | Purpose | Tech Stack | Cloud |
|------------|---------|------------|-------|
| `portfolio-cv-private` | Main portfolio website | Angular 19, TypeScript | Cloudflare Pages |
| `cv-chatbot-private` | Embeddable chat widget | Angular 19, TypeScript | Cloudflare Pages |
| `cv-admin-portal-private` | Admin dashboard | React, Vite, TypeScript | Cloudflare Pages |
| `d1-cv-private` | Portfolio data API | TypeScript, Hono, D1 | Cloudflare Workers |
| `cv-admin-worker-private` | Admin API | TypeScript, Hono, D1 | Cloudflare Workers |
| `cv-ai-agent-private` | AI chatbot with semantic search | TypeScript, Vectorize, Workers AI | Cloudflare Workers |
| `cv-analytics-dashboard-private` | Real-time analytics frontend | React, TypeScript, Firestore | Firebase Hosting |
| `cv-analytics-webhook-receiver-private` | Event ingestion | Go, Cloud Functions, Firestore | GCP |
| `cv-analytics-processor-private` | Analytics batch processing | Node.js, Lambda, DynamoDB | AWS |
| `cv-analytics-reporter-private` | Weekly email reports | Node.js, Lambda, SES | AWS |
| `cv-analytics-infrastructure-private` | IaC automation | Terraform, 7 workspaces | All clouds |

**Architecture metrics:**

- 11 independent services
- 87.5% microservices purity score
- 5 programming languages/runtimes (TypeScript, Go, Node.js, Angular, React)
- 3 cloud providers (Cloudflare, AWS, GCP)
- 100% infrastructure-as-code via Terraform Cloud
- 7 Terraform Cloud workspaces managing all infrastructure
- 11 independent CI/CD pipelines via GitHub Actions

---

## How to Use This Series

**If you want to build something similar:**

1. Start with Part 1 (architecture patterns)
2. Follow Part 2 (infrastructure setup)
3. Implement Part 3 (CI/CD automation)
4. Read Part 4-8 based on your needs

**If you want to learn multi-cloud patterns:**

1. Read Part 1 (architecture decisions)
2. Study Part 2 (Terraform multi-cloud)
3. Review Part 6 (security patterns)

**If you want to improve existing systems:**

1. Part 1: Assess your microservices purity
2. Part 4: Implement event-driven patterns
3. Part 5: Add proper versioning
4. Part 8: Optimize costs

---

## What Makes This Series Different

**Not another tutorial project:**

- This is a production system, not a toy example
- Real trade-offs, not perfect solutions
- Actual costs, performance metrics, and constraints
- Public repositories you can clone and deploy

**Not vendor hype:**

- Multi-cloud architecture (avoiding lock-in)
- Measured cost analysis (free tier optimization)
- Honest assessment of complexity
- Clear guidance on when NOT to use these patterns

**Not academic theory:**

- Practical deployment patterns
- Real-world constraints (cold starts, costs, complexity)
- Actual code in production
- Lessons from building and operating the system

---

## Target Outcome

By the end of this series, you should be able to:

✓ Design and implement true microservices architecture  
✓ Deploy infrastructure with Terraform across multiple clouds  
✓ Automate deployments with GitHub Actions  
✓ Build event-driven systems with queues and streams  
✓ Implement proper versioning and release management  
✓ Secure webhooks, APIs, and cloud resources  
✓ Build real-time dashboards with WebSocket updates  
✓ Optimize serverless costs while maintaining performance  

---

## Call to Action

**Start with Part 1:** Understanding pure microservices architecture and how to measure it.

**Questions before we begin?**

- What's your current deployment approach?
- Have you tried multi-cloud before?
- What's your biggest infrastructure challenge?

**Related:** [Part 1: Pure Microservices Architecture →]((https://blog.{YOUR_DOMAIN}/blog/gcp-cv-analytics-0))

---

*This series documents a real production system. All code is public, all metrics are measured, and all trade-offs are explained. No hype, no shortcuts, just engineering.*
