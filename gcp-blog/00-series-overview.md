# CV Analytics: Multi-Cloud Microservices at £0/Month

*Production systems don't require production budgets. Constraints force better architecture.*

## The Dilemma

I needed visibility into my portfolio projects. Which repositories get the most activity? What events happen most frequently? Are GitHub webhooks reliable, or do they occasionally fail? Without analytics, every question about my work became guesswork.

Building analytics seemed straightforward: capture GitHub webhooks, store events, generate reports. The complication was cost. My portfolio projects run on free tiers. Analytics couldn't change that.

**The constraint:** £0/month operational cost. No exceptions.

This constraint eliminated obvious solutions. Real-time dashboards? CloudWatch Insights exceeds free tier limits. Managed databases? RDS costs £15/month minimum. Serverless frameworks? Vendor lock-in and hidden costs. API gateways? Free tier expires after 12 months.

What remained was harder but more valuable: patterns that work regardless of budget.

**Author context:** 25 years building systems. Cloud platforms are tools, not achievements. This series documents what worked, what failed, and why the constraint made the architecture better.

---

## What This Series Covers

### Part 1: Pure Microservices Architecture (87.5% Score)

I called my system "microservices" because it had multiple services. Then I measured it.

Shared databases? Services couldn't deploy independently. Synchronous API calls? One service down, entire system down. Coupled deployments? "Microservices" in name only.

**The scoring system forced honesty:**

- Can services deploy independently? (Yes: 6 separate pipelines)
- Do services own their data? (Mostly: shared DynamoDB table docked points)
- Are failures isolated? (Yes: webhook receiver crashes don't affect dashboard)
- Can services use different technologies? (Yes: Go, TypeScript, Python)

**Result:** 87.5% purity score. Not perfect, but honest about trade-offs.

**What you'll learn:**

- Why "microservices" doesn't mean "multiple services"
- How to measure service independence (deployment, data, versioning)
- Which pure microservices patterns cost too much (skipped API gateway, saved £30/month)
- Why shared infrastructure isn't the same as tight coupling

---

### Part 2: Event-Driven Architecture (Why Queues Beat API Calls)

My first implementation used direct HTTP calls. Webhook receiver → Processor Lambda. Simple, synchronous, and completely broken.

**What failed:**

- Processor Lambda cold start: 800ms
- Webhook receiver timeout: 500ms
- GitHub retry policy: exponential backoff → webhook floods
- Result: 60% of events dropped

**Queue-based solution:**

- Webhook receiver writes to SQS (5ms latency)
- Returns HTTP 200 immediately
- Lambda processes batches asynchronously
- Retry logic handled by queue
- Result: 0% dropped events, £0 additional cost

**What you'll learn:**

- Why async beats sync for non-critical paths (analytics don't need instant processing)
- How SQS FIFO ordering prevents duplicate events
- When eventual consistency is acceptable (weekly reports tolerate 5-second delay)
- What dead letter queues catch (malformed payloads, transient failures)

---

### Part 3: Multi-Cloud Security (The Friday Afternoon Mistake)

I deployed the webhook receiver on Friday afternoon. No HMAC validation—"I'll add that Monday."

By Monday morning: 347 fake events in my database. Someone discovered the endpoint and flooded it. My analytics were useless.

**What I should have done:**

- HMAC-SHA256 validation (GitHub signs webhooks, I verify signature)
- Cost: £0 (just cryptographic comparison)
- Implementation time: 20 minutes
- Prevented: 100% of fake events

**What you'll learn:**

- Why webhook authentication isn't optional (endpoints are discoverable)
- How HMAC signatures work without API gateway costs
- Why GCP service accounts beat IAM users (no long-lived credentials)
- Which secrets belong in environment variables vs GitHub Secrets
- What I chose not to build: API gateway (£30/month), VPC (£15/month), Web Application Firewall (£5/month)

---

### Part 4: Terraform Multi-Cloud (Never Click Through Consoles)

I provisioned my first Cloud Function through the GCP console. Seven clicks, two dropdown menus, one confused moment about VPC settings. It worked.

Then I needed to replicate it for staging. I clicked through again. Different memory setting. Forgot to set timeout. Spent 30 minutes debugging why staging behaved differently.

**The Terraform solution:**

```hcl
resource "google_cloudfunctions_function" "webhook" {
  name        = "cv-webhook-receiver"
  runtime     = "go121"
  memory      = 256
  timeout     = 60
}
```

One definition, infinite environments. Change `memory = 256` to `memory = 512`, run `terraform apply`, done. No clicking. No drift.

**What you'll learn:**

- Why console clicks don't version control (Terraform does)
- How to manage AWS + GCP in same codebase (separate providers, shared state)
- Which Terraform features free tier supports (all of them—Terraform CLI is free)
- What I chose not to build: Terraform Cloud paid features (£0 constraint), custom modules marketplace

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

- Why GitHub Actions free tier is generous (2,000 minutes/month—way more than needed)
- How to deploy AWS + GCP from same workflow (service account keys in GitHub Secrets)
- When manual approval gates matter (production only—staging deploys automatically)
- What I chose not to build: Jenkins server (£10/month EC2), CircleCI paid tier (£15/month), AWS CodePipeline (£1 per active pipeline)

---

### Part 6: Semantic Versioning (The Breaking Change I Didn't Label)

I changed the DynamoDB table schema. Added a new required field: `eventType`. Deployed the Processor Lambda first (writes new field). Reporter Lambda still expected old schema (didn't read new field). Reports broke for 3 hours.

**The mistake:** I versioned the Processor as v1.2.1 (patch). Should have been v2.0.0 (major—breaking change).

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

### Part 7: Real-Time Dashboard (Polling vs WebSockets)

First dashboard implementation: Poll Firestore every 5 seconds.

**Cost calculation:**

- 5-second poll interval = 12 requests/minute = 720 requests/hour
- 10 hours active dashboard per week = 7,200 reads/week
- Firestore free tier: 50,000 reads/day
- **Result:** Within free tier, but wasteful (99% of polls return "no changes")

**WebSocket implementation (Firestore onSnapshot):**

- 1 connection per session
- Real-time updates pushed instantly
- 50 reads on initial load + 1 read per new event
- 10 hours per week = ~100 reads/week
- **Result: 98% reduction in reads, instant updates**

**What you'll learn:**

- Why polling wastes free tier quota (720 req/hr vs 1 connection)
- How Firestore onSnapshot works (WebSocket under the hood, free tier counts initial load + changes)
- When real-time isn't worth it (batch reports—weekly email better than live dashboard)
- Performance: Vite HMR <1s vs webpack 30s rebuild times
- What I chose not to build: Custom WebSocket server (£5/month EC2), GraphQL subscriptions (complexity), Socket.io (additional dependency)

---

### Part 8: Cost Optimization (6 Months at £0/Month)

**Actual costs (May - November 2025):**

```
AWS:
- Lambda: £0.00 (500 invocations / 1M free tier = 0.05%)
- DynamoDB: £0.00 (0.8 GB / 25 GB always-free = 3.2%)
- SQS: £0.00 (100 messages / 1M free tier = 0.01%)

GCP:
- Cloud Functions: £0.00 (100 invocations / 2M free tier = 0.005%)
- Firestore: £0.00 (500 reads/month / 50K reads/day = 0.3%)
- Firebase Hosting: £0.00 (150 KB bundle / 10 GB free tier = 0.001%)

Total: £0.00 for 6 consecutive months
```

**The batching discovery:**

Before batching: 1,000 events = 1,000 Lambda invocations.
After batching (size 10): 1,000 events = 100 Lambda invocations.
**90% cost reduction** (and 0% → 0% is still 0%, but scales better).

**What you'll learn:**

- How batching saves 90% of Lambda costs (batch size 10 → 1,000 messages = 100 invocations instead of 1,000)
- Why DynamoDB on-demand beats provisioned (always-free vs 12-month free tier)
- Which free tiers are permanent vs temporary (DynamoDB 25 GB = forever, RDS free tier = 12 months)
- When to scale up (>10,000 queries/month → £5-15/month acceptable with revenue)
- What I chose not to build: Reserved capacity (requires commitment), Savings Plans (requires scale), Provisioned concurrency (£5.40/month per function)

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

All code is public and production-ready:

| Repository | Purpose | Tech Stack |
|------------|---------|------------|
| `cv-analytics-dashboard-private` | Real-time frontend | React, TypeScript, Firestore |
| `cv-analytics-webhook-receiver-private` | Event ingestion | Go, Cloud Functions, Firestore |
| `cv-analytics-processor-private` | Analytics processing | Node.js, Lambda, DynamoDB |
| `cv-analytics-reporter-private` | Weekly email reports | Node.js, Lambda, AWS SES |
| `cv-analytics-infrastructure-private` | IaC automation | Terraform (GCP + AWS) |

**Architecture metrics:**
- 6 independent services
- 87.5% microservices purity score
- 4 programming languages/runtimes
- 2 cloud providers (GCP + AWS)
- 100% infrastructure-as-code
- Automated CI/CD for all services

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

**Next:** [Part 1: Pure Microservices Architecture →](01-pure-microservices-architecture.md)

---

*This series documents a real production system. All code is public, all metrics are measured, and all trade-offs are explained. No hype, no shortcuts, just engineering.*
