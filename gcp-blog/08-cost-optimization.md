# Serverless Cost Optimization: Running Production at £0/Month

## Quick Summary

- ✓ **£0/month** for production CV Analytics system
- ✓ **AWS Lambda** free tier: 1M requests/month (never exceeded)
- ✓ **DynamoDB** always-free tier: 25 GB storage + 25 RCU/WCU
- ✓ **GCP Cloud Functions** free tier: 2M invocations/month
- ✓ **Batching strategy** reduces Lambda invocations by 90%

---

## Introduction

[Content to be written following guidelines: British English, ✓ symbols, no em dashes, professional tone]

**Topics to cover:**
- Serverless cost model (pay-per-use)
- How CV Analytics stays within free tiers
- Cost optimization patterns
- When to scale up (beyond free tier)

---

## Understanding Serverless Pricing

[Content to be written]

**Topics:**
- AWS Lambda pricing (requests + duration)
- DynamoDB pricing (reads + writes + storage)
- Cloud Functions pricing (invocations + compute time)
- Firestore pricing (reads + writes + storage)
- Firebase Hosting (bandwidth)

**Pricing breakdown:**
```
AWS Lambda:
- 1M requests/month free
- 400,000 GB-seconds compute/month free

DynamoDB:
- 25 GB storage always free
- 25 RCU + 25 WCU always free

GCP Cloud Functions:
- 2M invocations/month free
- 400,000 GB-seconds compute/month free

Firestore:
- 1 GB storage free
- 50,000 reads/day free
- 20,000 writes/day free
```

---

## AWS Free Tier: Lambda and DynamoDB

[Content to be written]

**Topics:**
- Lambda invocation limits
- Memory and duration trade-offs
- DynamoDB on-demand vs provisioned
- Always-free tier benefits
- CloudWatch Logs retention costs

**CV Analytics usage:**
- Processor Lambda: ~500 invocations/month
- Reporter Lambda: 4 invocations/month (weekly)
- DynamoDB: <1 GB storage
- Well within free tier limits

**Mermaid diagram:** Free tier thresholds with actual usage

---

## GCP Free Tier: Cloud Functions and Firestore

[Content to be written]

**Topics:**
- Cloud Functions invocation limits
- Firestore read/write quotas
- Firebase Hosting bandwidth
- Storage costs
- Network egress charges

**CV Analytics usage:**
- Webhook receiver: ~100 invocations/month
- Firestore writes: ~100/month
- Firestore reads: ~500/month (real-time listeners)
- Well within free tier limits

---

## Batching Strategy: Reducing Invocations by 90%

[Content to be written]

**Topics:**
- SQS batch processing
- DynamoDB Streams batching
- Lambda configuration (batch size, window)
- Trade-offs (latency vs cost)
- When NOT to batch (real-time requirements)

**Code example:**
```javascript
// Processor Lambda with batching
exports.handler = async (event) => {
  // event.Records contains up to 10 messages from SQS
  const batch = event.Records.map(record => JSON.parse(record.body));
  
  console.log(`Processing batch of ${batch.length} messages`);
  
  // Process all at once
  await Promise.all(batch.map(processMessage));
};
```

**Impact:**
- Before batching: 1000 Lambda invocations
- After batching (batch size 10): 100 Lambda invocations
- **90% reduction in costs**

**Mermaid diagram:** Batching impact visualization

---

## Cold Start Optimization

[Content to be written]

**Topics:**
- What causes cold starts
- Memory allocation impact (higher memory = faster cold start)
- Code splitting and dependencies
- Connection pooling
- Provisioned concurrency (costs money)

**Cold start times:**
- Lambda (Node.js 18, 256 MB): ~200ms
- Lambda (Node.js 18, 1024 MB): ~100ms
- Cloud Functions (Go, 256 MB): ~150ms

**Trade-off:** Higher memory costs more but reduces cold start latency.

---

## Cost Monitoring and Alerts

[Content to be written]

**Topics:**
- AWS Cost Explorer
- CloudWatch billing metrics
- GCP billing budgets
- Setting up alerts (>£5/month)
- Daily cost tracking

**CloudWatch alarm example:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name billing-alert \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --period 86400 \
  --threshold 5.0
```

---

## Real Cost Breakdown: CV Analytics

[Content to be written]

**Monthly costs (last 6 months):**
```
AWS:
- Lambda invocations: £0.00 (500/1,000,000 free tier)
- DynamoDB storage: £0.00 (0.8 GB/25 GB free tier)
- DynamoDB reads/writes: £0.00 (within RCU/WCU limits)
- CloudWatch Logs: £0.00 (within free tier)

GCP:
- Cloud Functions: £0.00 (100/2,000,000 free tier)
- Firestore reads: £0.00 (500/50,000 daily limit)
- Firestore writes: £0.00 (100/20,000 daily limit)
- Firebase Hosting: £0.00 (within bandwidth limits)

Total: £0.00/month
```

**Mermaid diagram:** Cost breakdown by service

---

## When to Scale Up: Beyond Free Tier

[Content to be written]

**Topics:**
- Traffic thresholds (when free tier isn't enough)
- Reserved capacity (Lambda, DynamoDB)
- Savings plans (AWS, GCP)
- Right-sizing resources
- Cost-benefit analysis

**Scaling scenarios:**
- 1M queries/month → Stay on free tier
- 10M queries/month → ~£50/month
- 100M queries/month → ~£500/month

---

## Practical Takeaways

[Content to be written]

**Key points:**
- ✓ Free tiers are generous (1M Lambda requests)
- ✓ Batch processing reduces costs dramatically
- ✓ Monitor costs proactively
- ✓ Optimize cold starts with memory tuning
- ✓ Stay within free tier for portfolio projects

---

## Series Conclusion

**What We've Covered:**

1. **Part 1:** Pure microservices architecture (87.5% score)
2. **Part 2:** Multi-cloud infrastructure as code (Terraform)
3. **Part 3:** Automated deployments (GitHub Actions)
4. **Part 4:** Event-driven architecture (SQS, Streams)
5. **Part 5:** Semantic versioning (independent evolution)
6. **Part 6:** Multi-cloud security (HMAC, IAM, secrets)
7. **Part 7:** Real-time dashboard (React, Firestore)
8. **Part 8:** Cost optimization (£0/month production system)

**What You've Learned:**
- ✓ Design and score microservices architectures
- ✓ Provision multi-cloud infrastructure with Terraform
- ✓ Automate deployments with GitHub Actions
- ✓ Build event-driven systems with queues and streams
- ✓ Version services independently with SemVer
- ✓ Secure webhooks and APIs across clouds
- ✓ Create real-time dashboards with React
- ✓ Optimize serverless costs for production

**Next Steps:**
- Clone the repositories and run locally
- Modify for your own use cases
- Deploy to your own AWS/GCP accounts
- Share your learnings

**All repositories:**
- [Dashboard](https://github.com/josejalvarezm/cv-analytics-dashboard-private)
- [Webhook Receiver](https://github.com/josejalvarezm/cv-analytics-webhook-receiver-private)
- [Processor](https://github.com/josejalvarezm/cv-analytics-processor-private)
- [Reporter](https://github.com/josejalvarezm/cv-analytics-reporter-private)
- [Infrastructure](https://github.com/josejalvarezm/cv-analytics-infrastructure-private)

---

## Further Reading

- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [GCP Cloud Functions Pricing](https://cloud.google.com/functions/pricing)
- [Firestore Pricing](https://firebase.google.com/docs/firestore/quotas)

---

**Author:** José Álvarez  
**Series:** CV Analytics Multi-Cloud Microservices  
**Published:** November 2025  
**Tags:** serverless, cost-optimization, AWS, GCP, free-tier, production
