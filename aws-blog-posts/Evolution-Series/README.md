# Edge Analytics at £0/month

A complete technical series documenting production-grade analytics infrastructure built within AWS free tier limits.

---

## Series Overview

This series documents building a complete analytics system from scratch: from edge workers logging queries, through microservices processing events, to automated weekly reports—all at zero monthly cost.

Not a proof-of-concept. Not a tutorial. A production system handling real traffic with measured reliability.

**System stats:**

- 10,000 queries/month processed
- 99.97% success rate
- 12ms p95 response time
- 18 AWS resources across 3 microservices
- 36 deployments in 30 days (0 failures)
- £0.00 monthly operational cost

**Key insight:** Best practices don't require budget. State locking, zero-downtime deployments, and failure isolation work the same at £0/month or £10,000/month. Constraints force discipline, not compromise.

---

## Reading Guide

### Quick Navigation

| Part | Title | What You'll Learn | Reading Time |
|------|-------|-------------------|--------------|
| [Part 0](./00-why-analytics-visibility-problem.md) | Why Analytics Matter | The visibility problem: fast ≠ credible without data | 4 min |
| [Part 1](./01-fire-and-forget-edge-analytics.md) | Fire-and-Forget Pattern | 89% latency reduction using execution context | 9 min |
| [Part 2](./02-microservices-architecture-zero-cost.md) | Microservices Architecture | 3-service design with independent deployments | 11 min |
| [Part 3](./03-hybrid-deployment-terraform-cloudformation.md) | Hybrid Deployment | Terraform + CloudFormation = best of both | 12 min |
| [Part 4](./04-production-patterns-free-tier.md) | Production Patterns | State locking, zero-downtime, CI/CD automation | 13 min |

**Total reading time:** ~50 minutes

### Recommended Reading Paths

**If you want the complete story:** Read Parts 0-4 sequentially.

**If you're evaluating analytics solutions:** Start with Part 0 (problem statement) and Part 2 (architecture overview).

**If you're building edge systems:** Read Part 1 (fire-and-forget pattern) and Part 4 (production patterns).

**If you're choosing between Terraform and CloudFormation:** Jump straight to Part 3.

**If you want to validate best practices:** Read Part 4 (AWS Well-Architected Framework compliance).

---

## What This Series Covers

### Part 0: Why Analytics Matter

**The problem:** Portfolio claims "12ms response time" without evidence.

**The constraint:** £0 monthly budget (AWS free tier only).

**The solution:** Build production analytics to prove performance claims.

**Key topics:**

- Why visibility matters for credibility
- The zero-cost constraint as forcing function
- Architecture decisions driven by free tier limits
- Measured outcomes vs claims

[Read Part 0 →](./00-why-analytics-visibility-problem.md)

---

### Part 1: Fire-and-Forget Edge Analytics

**The pattern:** Edge systems can't wait for external services.

**The solution:** Fire-and-forget using execution context (`ctx.waitUntil()`).

**The result:** 89% latency reduction (135ms → 12ms p95).

**Key topics:**

- Execution context pattern across platforms (Cloudflare, Vercel, Deno, Lambda@Edge)
- Promise handling for background work
- Error handling without blocking response
- Platform equivalence for portability

**Code samples:**

- Cloudflare Workers implementation
- Vercel Edge Functions equivalent
- SQS FIFO queue ingestion
- Platform comparison matrix

[Read Part 1 →](./01-fire-and-forget-edge-analytics.md)

---

### Part 2: Microservices Architecture at Zero Cost

**The design:** Three independent services with clear boundaries.

**The services:**

1. **Worker:** Cloudflare edge function logs queries to SQS
2. **Processor:** Lambda consumes SQS, writes to DynamoDB  
3. **Reporter:** EventBridge schedules Lambda to generate weekly emails

**The benefit:** Independent deployments, isolated failures, polyrepo structure.

**Key topics:**

- Service boundary definition
- Polyrepo vs monorepo trade-offs
- Terraform Cloud workspace isolation
- State management across services
- Cost scaling analysis (£0 → £0.52 at 10x traffic)
- Failure isolation scenarios

**Architecture diagrams:**

- Complete system data flow
- 18 AWS resources mapped
- State management patterns
- Cost breakdown by service

[Read Part 2 →](./02-microservices-architecture-zero-cost.md)

---

### Part 3: Hybrid Deployment (Terraform + CloudFormation)

**The question:** Why use CloudFormation if you have Terraform?

**The answer:** Terraform manages infrastructure, CloudFormation deploys applications.

**The pattern:** Hybrid deployment optimizes for each tool's strengths.

**Key topics:**

- What Terraform excels at (VPCs, IAM, DynamoDB, SQS, EventBridge)
- What CloudFormation excels at (Lambda code packaging, versioning, aliases)
- Interface contracts between tools (outputs as inputs)
- Real-world deployment scenarios
- Zero-downtime update mechanisms

**Measured outcomes:**

- Code-only updates: 2-3 minutes
- Infrastructure-only updates: 3-4 minutes
- Combined updates: 4-5 minutes
- 26 deployments, 0 failures

**Trade-offs covered:**

- Learning curve (two tools vs one)
- State management (two state systems)
- When pure Terraform makes sense
- When pure CloudFormation makes sense

[Read Part 3 →](./03-hybrid-deployment-terraform-cloudformation.md)

---

### Part 4: Production Patterns at Free Tier

**The thesis:** Best practices work regardless of budget.

**The patterns:**

- Remote state with automatic locking (Terraform Cloud)
- Zero-downtime deployments (Lambda aliases + versions)
- Automated CI/CD (GitHub Actions with path filtering)
- Security (credential management, least privilege IAM)
- Monitoring (CloudWatch metrics, alarms, SNS notifications)
- Failure handling (dead letter queues, batch partial failures)

**AWS Well-Architected Framework compliance:**

✓ Operational Excellence (IaC, automation, monitoring)  
✓ Security (least privilege, secrets management, encryption)  
✓ Reliability (retries, DLQ, failure isolation, zero-downtime)  
✓ Performance Efficiency (right-sizing, batching, edge processing)  
✓ Cost Optimization (pay-per-use, free tier utilization, no idle resources)

**Measured metrics:**

- 36 deployments in 30 days
- 100% zero-downtime success rate
- 99.97% query processing success
- 3.2 minute average deployment time
- 0 state conflicts (automatic locking)

**Cost analysis:**

- Current usage: <10% of free tier capacity
- At 10x traffic: Still £0/month
- At 100x traffic: £0.82/month
- At 1,000x traffic: £8.20/month (no architecture changes required)

[Read Part 4 →](./04-production-patterns-free-tier.md)

---

## Technical Stack

### Edge Layer

- **Cloudflare Workers** (edge compute)
- **SQS FIFO queue** (ingestion buffer)

### Processing Layer

- **AWS Lambda** (Node.js 20.x)
- **DynamoDB** (NoSQL storage with TTL)
- **EventBridge** (scheduled triggers)
- **SNS** (email notifications)

### Infrastructure Layer

- **Terraform 1.9.0** (infrastructure management)
- **Terraform Cloud** (remote state + locking)
- **CloudFormation** (Lambda application deployment)
- **GitHub Actions** (CI/CD automation)

### Monitoring Layer

- **CloudWatch Metrics** (performance tracking)
- **CloudWatch Alarms** (error detection)
- **CloudWatch Logs** (debugging)

**Total AWS resources:** 18 (across 3 microservices)

**Monthly cost:** £0.00

---

## Key Lessons from the Series

### Architecture

**Microservices work at any scale.** Independent deployments and failure isolation aren't enterprise luxuries—they solve real problems regardless of budget.

**Hybrid deployment is pragmatic.** Terraform and CloudFormation complement each other. Use both where each excels.

**State management matters.** Remote state with locking prevents conflicts and enables collaboration.

**Edge processing is transformative.** 89% latency reduction by moving work out of the response path.

### Operations

**Zero-downtime is achievable.** Lambda aliases enable updates without service interruption.

**Automation reduces errors.** 36 deployments with 0 failures because humans don't run terraform apply manually.

**Path filtering prevents waste.** Deploy only changed services, not everything.

**Monitoring is non-negotiable.** CloudWatch metrics and alarms are free and essential.

### Cost

**Free tier is generous.** System uses <10% of allocated capacity at current traffic.

**Growth is gradual.** 100x traffic increase costs £0.82/month (not hundreds).

**Pay-per-use wins.** No idle EC2 instances, no unused RDS databases, no NAT gateway charges.

**Constraints force quality.** Can't throw money at problems; must engineer properly.

### Best Practices

**IaC isn't optional.** Manual changes don't belong in production.

**Version control everything.** Infrastructure changes need the same review as code.

**Failures are normal.** Dead letter queues and retries handle transient issues.

**Production-grade ≠ expensive.** State locking, zero-downtime, and monitoring work at £0/month.

---

## Who This Series Is For

### You should read this series if you:

✓ Build portfolio projects and want production-quality infrastructure  
✓ Evaluate whether AWS free tier can handle real workloads  
✓ Wonder if microservices make sense at small scale  
✓ Need to choose between Terraform and CloudFormation  
✓ Want to implement zero-downtime deployments  
✓ Question whether best practices apply to side projects  
✓ Build edge applications (Cloudflare Workers, Vercel Edge, Deno Deploy)  
✓ Need analytics but can't justify commercial SaaS pricing  

### This series isn't for you if:

✗ You need multi-region high availability (single-region architecture)  
✗ You process >100k events/month and need reserved capacity  
✗ You require HIPAA/PCI DSS compliance (not covered)  
✗ You want a tutorial with copy-paste commands (this explains decisions, not steps)  
✗ You prefer pure Terraform or pure CloudFormation (hybrid approach)  

---

## Complete System Metrics

### Performance

- **Response time (p95):** 12ms
- **Latency reduction:** 89% (vs blocking pattern)
- **Cold start rate:** 2%
- **Processing success rate:** 99.97%

### Reliability

- **Uptime (30 days):** 100%
- **Failed events:** 3 per 10,000 (moved to DLQ)
- **Deployment success rate:** 100% (36/36)
- **Zero-downtime deployments:** 100%

### Operational

- **Deployments (30 days):** 36
- **Average deployment time:** 3.2 minutes
- **State conflicts prevented:** 2 (automatic locking)
- **Manual interventions:** 0

### Cost

- **Monthly operational cost:** £0.00
- **Free tier utilization:** 9% (Lambda compute)
- **Cost at 10x traffic:** £0.00
- **Cost at 100x traffic:** £0.82/month

### Resources

- **AWS services used:** 8
- **Total AWS resources:** 18
- **Microservices:** 3
- **Lines of Terraform:** ~400
- **Lines of TypeScript:** ~300

---

## Related Resources

### Documentation

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

### Code Repositories

- cv-analytics-infrastructure (Terraform modules, deployment scripts)
- cv-analytics-processor (Lambda function, DynamoDB schema)
- cv-analytics-reporter (EventBridge scheduler, SNS templates)

### Related Blog Posts

- "Why I Migrated from Terraform Local State to Terraform Cloud"
- "CloudFormation vs Terraform for Lambda: A Nuanced Comparison"
- "The Economics of Serverless: AWS Free Tier Analysis"

---

## About This Series

**Author:** Jose Alvarez  
**Written:** January 2025  
**System status:** Production (live traffic)  
**Last updated:** January 2025

This series documents real production infrastructure, not a tutorial project. Metrics are measured, not estimated. Trade-offs are discussed honestly.

The system described continues to run in production, processing queries from my portfolio website and generating weekly analytics reports.

---

## Feedback Welcome

Found an error? Have questions? Want to discuss trade-offs?

- **Email:** {YOUR_EMAIL}
- **Portfolio:** {YOUR_DOMAIN}
- **LinkedIn:** [Jose Alvarez](https://www.linkedin.com/in/jose-joaquin-alvarez-munoz/)

---

**Start reading:** [Part 0: Why Analytics Matter →](./00-why-analytics-visibility-problem.md)
