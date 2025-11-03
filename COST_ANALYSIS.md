# CV Analytics Pipeline - Cost Analysis & Optimization

**Date**: November 3, 2025  
**AWS Account**: {AWS_ACCOUNT_ID}  
**Region**: us-east-1

---

## Executive Summary

The CV Analytics Pipeline is designed to be **cost-effective** with serverless architecture and pay-per-use pricing. Based on current infrastructure and estimated usage patterns:

**Estimated Monthly Cost**: **$2.50 - $8.00 USD/month**

**Cost Breakdown:**
- Lambda: ~$0.50 - $2.00
- DynamoDB: ~$1.00 - $4.00
- SQS: ~$0.20 - $0.50
- CloudWatch: ~$0.50 - $1.00
- SNS: ~$0.10 - $0.20
- SES: ~$0.20 - $0.30

---

## Detailed Cost Analysis

### 1. AWS Lambda

**Resources:**
- **Processor Lambda**: 512MB memory, ~100ms average duration
- **Reporter Lambda**: 512MB memory, ~30s average duration

**Pricing (us-east-1):**
- $0.0000166667 per GB-second
- $0.20 per 1M requests
- Free tier: 1M requests/month, 400,000 GB-seconds/month

**Estimated Usage:**

| Metric | Processor | Reporter | Total |
|--------|-----------|----------|-------|
| **Invocations/month** | ~5,000 (167/day) | 4 (weekly) | 5,004 |
| **Duration (avg)** | 100ms | 30s | - |
| **Memory** | 512MB (0.5GB) | 512MB (0.5GB) | - |
| **GB-seconds/month** | 250 | 60 | 310 |
| **Request cost** | $0.001 | $0.000 | **$0.001** |
| **Duration cost** | $0.004 | $0.001 | **$0.005** |

**Monthly Lambda Cost**: **~$0.01** (well within free tier)

**Optimization Opportunities:**
- ✅ Already optimized: Using minimum viable memory (512MB)
- ✅ Efficient: Short execution times (<1s average for processor)
- 💡 Consider: Reduce Processor memory to 256MB if performance allows
  - Potential savings: ~$0.002/month (negligible, not recommended)

---

### 2. Amazon DynamoDB

**Resources:**
- **cv-analytics-query-events**: On-demand billing, TTL 7 days
- **cv-analytics-analytics**: On-demand billing, TTL 90 days

**Pricing (us-east-1):**
- Write Request Units (WRU): $1.25 per million
- Read Request Units (RRU): $0.25 per million
- Storage: $0.25 per GB-month

**Estimated Usage:**

| Metric | Query Events | Analytics | Total |
|--------|--------------|-----------|-------|
| **Writes/month** | ~10,000 (2 per query) | ~400 (weekly aggregation) | 10,400 |
| **Reads/month** | ~500 (monitoring) | ~800 (reporter reads) | 1,300 |
| **Avg item size** | 1KB | 2KB | - |
| **Storage (steady state)** | ~2.5MB (7-day TTL) | ~30MB (90-day TTL) | 32.5MB |
| **Write cost** | $0.013 | $0.001 | **$0.014** |
| **Read cost** | $0.000 | $0.000 | **$0.000** |
| **Storage cost** | $0.000 | $0.008 | **$0.008** |

**Monthly DynamoDB Cost**: **~$0.02**

**Optimization Opportunities:**
- ✅ Excellent: On-demand billing (no wasted provisioned capacity)
- ✅ TTL enabled: Auto-deletion saves storage costs
- 💡 Consider: Switch to provisioned capacity if usage becomes predictable
  - Only if sustained >1 WCU/sec (2,628,000 writes/month)
  - Current usage: ~10,000/month = way below threshold
  - **Recommendation**: Keep on-demand

---

### 3. Amazon SQS

**Resources:**
- **cv-analytics-queue.fifo**: Main processing queue
- **cv-analytics-dlq.fifo**: Dead letter queue

**Pricing (us-east-1):**
- FIFO requests: $0.50 per million (after free tier)
- Free tier: 1M requests/month

**Estimated Usage:**

| Metric | Main Queue | DLQ | Total |
|--------|------------|-----|-------|
| **Messages sent/month** | ~10,000 | ~10 (failures) | 10,010 |
| **Messages received/month** | ~10,000 | ~10 | 10,010 |
| **Total requests** | ~20,000 | ~20 | **20,020** |
| **Cost** | $0.000 (free tier) | $0.000 | **$0.00** |

**Monthly SQS Cost**: **~$0.00** (within free tier)

**Optimization Opportunities:**
- ✅ Perfect: Usage well within free tier (20k vs 1M limit)
- ✅ FIFO configured: Ensures message ordering and exactly-once delivery
- ⚠️ Monitor: If usage scales to >1M requests/month, cost would be ~$0.50/million

---

### 4. Amazon CloudWatch

**Resources:**
- **2 Log Groups** (/aws/lambda/cv-analytics-processor, cv-analytics-reporter)
- **6 Metric Alarms** (DLQ, processor x2, reporter x3)
- **Custom Metrics**: None (using AWS/Lambda, AWS/SQS, AWS/DynamoDB namespaces)

**Pricing (us-east-1):**
- Logs ingestion: $0.50 per GB
- Logs storage: $0.03 per GB-month
- Standard metrics: Free (AWS namespace)
- Alarms: First 10 free, then $0.10/alarm

**Estimated Usage:**

| Metric | Processor | Reporter | Total |
|--------|-----------|----------|-------|
| **Log ingestion/month** | ~5MB (5k invocations × 1KB logs) | ~0.1MB (4 × 25KB) | 5.1MB |
| **Log storage (14-day retention)** | ~2.5MB avg | ~0.05MB avg | 2.55MB |
| **Alarms** | 3 | 3 | 6 |
| **Ingestion cost** | $0.003 | $0.000 | **$0.003** |
| **Storage cost** | $0.000 | $0.000 | **$0.000** |
| **Alarm cost** | $0.000 (free) | $0.000 (free) | **$0.00** |

**Monthly CloudWatch Cost**: **~$0.003** (negligible)

**Optimization Opportunities:**
- ✅ Excellent: 14-day retention (not excessive)
- ✅ Using standard metrics (free)
- 💡 Consider: Reduce retention to 7 days if logs not needed
  - Potential savings: ~$0.0001/month (not worth it)

---

### 5. Amazon SNS

**Resources:**
- **cv-analytics-alarms** topic: 1 email subscription

**Pricing (us-east-1):**
- Email notifications: First 1,000 free, then $2.00 per 100,000
- Free tier: 1,000 notifications/month

**Estimated Usage:**

| Metric | Value |
|--------|-------|
| **Alarm notifications/month** | ~2-5 (only when alarms trigger) |
| **Cost** | $0.00 (free tier) |

**Monthly SNS Cost**: **~$0.00**

**Optimization Opportunities:**
- ✅ Perfect: Email-only (cheapest notification method)
- ✅ Alarm-based: Only sends when needed
- 💡 Alternative: Could add SMS for critical alarms (~$0.045/SMS in US)

---

### 6. Amazon SES (Simple Email Service)

**Resources:**
- Weekly analytics reports to contact@{YOUR_DOMAIN}

**Pricing (us-east-1):**
- EC2-hosted: First 62,000 emails/month free
- Outside EC2: $0.10 per 1,000 emails

**Estimated Usage:**

| Metric | Value |
|--------|-------|
| **Emails sent/month** | ~4 (weekly reports) |
| **Cost** | $0.00 (using Lambda, counts as EC2-hosted) |

**Monthly SES Cost**: **~$0.00**

**Optimization Opportunities:**
- ✅ Excellent: Using Lambda (qualifies for EC2 pricing)
- ✅ Low volume: 4 emails/month vs 62,000 limit
- ⚠️ Note: If SES production access requires verification, no additional cost

---

### 7. EventBridge

**Resources:**
- **cv-analytics-weekly-reporter** rule: Cron trigger (Monday 7 AM UTC)

**Pricing (us-east-1):**
- Custom EventBridge rules: Free (for AWS service targets like Lambda)
- Default event bus: Free for AWS service events

**Estimated Usage:**

| Metric | Value |
|--------|-------|
| **Events/month** | 4 (weekly trigger) |
| **Cost** | $0.00 (free for Lambda targets) |

**Monthly EventBridge Cost**: **~$0.00**

---

## Total Monthly Cost Estimate

| Service | Cost Range | Notes |
|---------|------------|-------|
| **Lambda** | $0.00 - $0.01 | Within free tier |
| **DynamoDB** | $0.01 - $0.05 | On-demand, TTL-limited storage |
| **SQS** | $0.00 | Within free tier |
| **CloudWatch** | $0.00 - $0.01 | Minimal logging |
| **SNS** | $0.00 | Within free tier |
| **SES** | $0.00 | Within Lambda/EC2 free tier |
| **EventBridge** | $0.00 | Free for Lambda targets |
| **Data Transfer** | $0.00 - $0.01 | Negligible inter-service |
| | | |
| **TOTAL** | **$0.01 - $0.08** | **~$0.05/month average** |

### Projected Annual Cost: **$0.60 - $0.96 USD**

---

## Cost Optimization Recommendations

### Priority 1: Cost Monitoring (Immediate)

**Action**: Enable AWS Budgets with email alerts

```powershell
# Create budget with $5/month threshold (100x current spend for safety margin)
aws budgets create-budget `
  --account-id {AWS_ACCOUNT_ID} `
  --budget '{
    "BudgetName": "cv-analytics-monthly-budget",
    "BudgetLimit": {
      "Amount": "5.00",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {
      "TagKeyValue": ["Project$cv-analytics"]
    }
  }' `
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [{
        "SubscriptionType": "EMAIL",
        "Address": "contact@{YOUR_DOMAIN}"
      }]
    }
  ]' `
  --profile cv-analytics
```

**Expected Benefit**: Early warning if costs exceed $4/month (80% of $5 budget)

---

### Priority 2: DynamoDB On-Demand (Already Implemented ✅)

**Status**: COMPLETE - Already using on-demand billing

**Why it's optimal**:
- No wasted provisioned capacity
- Auto-scales with demand
- TTL enabled for automatic cleanup
- Current usage: ~10,000 writes/month = $0.01
- Provisioned would cost minimum ~$0.52/month (1 WCU + 1 RCU)

**Savings**: ~$0.50/month vs provisioned

---

### Priority 3: CloudWatch Log Retention (Optional)

**Current**: 14-day retention on both Lambda log groups

**Option**: Reduce to 7 days if 14 days not needed

```powershell
# Set 7-day retention
aws logs put-retention-policy --log-group-name /aws/lambda/cv-analytics-processor --retention-in-days 7 --profile cv-analytics
aws logs put-retention-policy --log-group-name /aws/lambda/cv-analytics-reporter --retention-in-days 7 --profile cv-analytics
```

**Expected Savings**: ~$0.0001/month (negligible)
**Recommendation**: **Keep 14 days** - minimal cost, useful for troubleshooting

---

### Priority 4: Lambda Memory Optimization (Testing Recommended)

**Current**: Both Lambdas use 512MB memory

**Option**: Test Processor Lambda with 256MB

```hcl
# In terraform/processor_lambda.tf
resource "aws_lambda_function" "processor" {
  # Change from 512 to 256
  memory_size = 256
  timeout     = 30
}
```

**Testing Steps**:

1. Deploy with 256MB: `terraform apply`
2. Monitor duration metrics for 1 week
3. Check for timeout errors or slow processing
4. If duration increases >2x, revert to 512MB

**Expected Savings**: ~$0.002/month (not significant)
**Recommendation**: **Keep 512MB** - cost savings negligible, performance priority

---

### Priority 5: Enable Cost Explorer (For Detailed Tracking)

**Action**: Enable AWS Cost Explorer in AWS Console

**Steps**:

1. Navigate to AWS Console → Billing Dashboard
2. Click "Cost Explorer" in left menu
3. Click "Enable Cost Explorer"
4. Wait 24 hours for data ingestion

**Benefit**:
- Detailed cost breakdowns by service
- Daily/monthly trends visualization
- Tag-based cost allocation
- Forecasting future spend

**Cost**: Free (no charge for Cost Explorer)

---

### Priority 6: Resource Tagging (For Cost Attribution)

**Current**: Terraform applies default tags (`Project`, `Environment`, `ManagedBy`)

**Enhancement**: Add cost center tags to all resources

```hcl
# In terraform/main.tf or variables.tf
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    CostCenter  = "cv-analytics"
    Owner       = "contact@{YOUR_DOMAIN}"
  }
}

# Apply to all resources
resource "aws_dynamodb_table" "query_events" {
  # ... existing config ...
  tags = local.common_tags
}
```

**Benefit**: Better cost tracking and filtering in Cost Explorer

---

## Scaling Considerations

### If Traffic Increases 10x (50,000 queries/month)

| Service | Current | 10x Scale | Cost Impact |
|---------|---------|-----------|-------------|
| **Lambda** | $0.01 | $0.10 | Still within free tier |
| **DynamoDB** | $0.02 | $0.20 | Still very cheap |
| **SQS** | $0.00 | $0.01 | Still within free tier |
| **Total** | $0.05 | $0.50 | **~$0.50/month** |

**Conclusion**: System can handle 10x traffic for **<$1/month**

---

### If Traffic Increases 100x (500,000 queries/month)

| Service | Current | 100x Scale | Cost Impact |
|---------|---------|------------|-------------|
| **Lambda** | $0.01 | $1.00 | Approaching free tier limit |
| **DynamoDB** | $0.02 | $2.00 | On-demand still optimal |
| **SQS** | $0.00 | $0.10 | Exceeds free tier |
| **CloudWatch** | $0.00 | $0.25 | Log volume increases |
| **Total** | $0.05 | $3.50 | **~$3.50/month** |

**At this scale, consider**:
- DynamoDB reserved capacity (if usage predictable)
- CloudWatch Logs Insights queries (instead of full log retention)
- Lambda Provisioned Concurrency (if latency critical)

---

## Cost Alerts Configuration

### Recommended Budget Thresholds

```powershell
# Budget 1: Monthly cost alert at $5
aws budgets create-budget `
  --account-id {AWS_ACCOUNT_ID} `
  --budget '{
    "BudgetName": "cv-analytics-monthly",
    "BudgetLimit": {"Amount": "5.00", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' `
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "FORECASTED",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100
    },
    "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "contact@{YOUR_DOMAIN}"}]
  }]' `
  --profile cv-analytics

# Budget 2: Quarterly cost alert at $15
aws budgets create-budget `
  --account-id {AWS_ACCOUNT_ID} `
  --budget '{
    "BudgetName": "cv-analytics-quarterly",
    "BudgetLimit": {"Amount": "15.00", "Unit": "USD"},
    "TimeUnit": "QUARTERLY",
    "BudgetType": "COST"
  }' `
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "contact@{YOUR_DOMAIN}"}]
  }]' `
  --profile cv-analytics
```

---

## Cloudflare Worker Costs

**Note**: Cloudflare Worker costs are **separate** from AWS costs.

**Cloudflare Pricing (Workers Plan):**
- Free tier: 100,000 requests/day
- Paid plan: $5/month for 10M requests/month

**Estimated Usage**:
- Current: ~5,000 requests/month (167/day)
- Well within free tier (100k/day = 3M/month)

**Cost**: **$0.00/month** (free tier)

---

## Summary & Action Items

### Current State
✅ **Highly cost-optimized**: ~$0.05/month (~$0.60/year)
✅ **Serverless**: Pay only for actual usage
✅ **Scalable**: Can handle 100x traffic for <$5/month
✅ **Free tier eligible**: Most services within AWS free tier limits

### Immediate Actions (Step J Completion)

- [ ] **J.1**: Enable AWS Cost Explorer (for detailed tracking)
- [ ] **J.2**: Create AWS Budget alerts ($5/month threshold)
- [ ] **J.3**: Add cost center tags to Terraform resources
- [ ] **J.4**: Document quarterly cost review process
- [ ] **J.5**: Monitor costs for 30 days, adjust alerts if needed

### Long-term Monitoring

- **Monthly**: Review Cost Explorer dashboard
- **Quarterly**: Analyze cost trends, optimize if needed
- **Annually**: Review free tier eligibility (12-month limit on some services)

---

## Cost Review Schedule

| Task | Frequency | Estimated Time |
|------|-----------|----------------|
| Check budget alert emails | As received | 2 minutes |
| Review Cost Explorer | Monthly | 10 minutes |
| Analyze cost trends | Quarterly | 20 minutes |
| Optimize resources | Quarterly | 1-2 hours |
| Annual infrastructure review | Yearly | 4 hours |

---

## Conclusion

The CV Analytics Pipeline is **extremely cost-effective** at current scale:

- **Monthly cost**: ~$0.05 USD
- **Annual cost**: ~$0.60 USD
- **Highly scalable**: Can handle 100x traffic for <$5/month
- **Well-optimized**: Using serverless, on-demand, and free-tier services

**No immediate optimizations required** - system is already highly cost-efficient. Focus on monitoring and alerting to detect any unexpected cost increases early.

---

**Document Version**: 1.0  
**Last Updated**: November 3, 2025  
**Next Review**: December 3, 2025
