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

### Part 5: CI/CD with GitHub Actions

**Why this matters:** Manual deployments are error-prone and time-consuming. Automated pipelines enable frequent deployments, catch regressions early, and document the release process.

**What you'll learn:**
- ✓ GitHub Actions workflows for multi-cloud deployment
- ✓ Secrets management across repositories
- ✓ Independent deployment pipelines per service
- ✓ Automated testing before deployment
- ✓ Using Firebase CLI, gcloud CLI, and AWS CLI in workflows

**Automation covered:**
- 4 independent CI/CD pipelines
- Deployment to Firebase, Cloud Functions, Lambda
- Semantic versioning automation
- Zero-downtime deployment patterns

---

### Part 6: Microservices Versioning Strategy

**Why this matters:** Without versioning, you can't track what's deployed, roll back safely, or coordinate breaking changes across services. Semantic versioning provides a contract between services and their consumers.

**What you'll learn:**
- ✓ Semantic versioning (SemVer 2.0.0) for microservices
- ✓ Git tagging workflows
- ✓ Independent service versions
- ✓ Handling breaking changes
- ✓ Version compatibility policies

**Strategy covered:**
- Per-service version management
- Git tags as deployment markers
- Automated version bumping in CI/CD
- Migration paths for breaking changes

---

### Part 7: Real-Time Dashboard with React and Firestore

**Why this matters:** Polling is wasteful. WebSocket-based real-time updates provide instant feedback without hammering your database with repeated queries.

**What you'll learn:**
- ✓ React + TypeScript + Vite setup
- ✓ Firestore real-time listeners
- ✓ Data visualization with Recharts
- ✓ Firebase Hosting deployment
- ✓ Performance optimization

**Implementation covered:**
- Real-time webhook visualization
- React TypeScript with Vite
- Tailwind CSS styling
- Firebase Authentication (optional)
- CDN optimization for global delivery

---

### Part 8: Serverless Cost Optimization

**Why this matters:** Serverless promises "pay only for what you use", but misconfiguration leads to surprise bills. Understanding free tiers, batching strategies, and cold start optimization keeps costs low.

**What you'll learn:**
- ✓ AWS Lambda free tier limits
- ✓ GCP Cloud Functions pricing
- ✓ DynamoDB on-demand vs provisioned capacity
- ✓ Batching to reduce invocations
- ✓ Monitoring costs with CloudWatch and Cloud Logging

**Cost breakdown:**
- Target: £0-15/month for production system
- Lambda: 1M free requests/month
- DynamoDB: 25 GB always free
- Firestore: 1 GB free storage
- Firebase Hosting: 10 GB/month free bandwidth

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
