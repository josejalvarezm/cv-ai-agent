# Step D — Processor Lambda Deployment ✅ COMPLETE

**Date Completed**: 2025-11-03  
**Status**: ✅ Successfully deployed to AWS  
**Deployment Time**: ~2 hours (including troubleshooting)

---

## What Was Deployed

### Lambda Function
- **Name**: cv-analytics-processor
- **ARN**: arn:aws:lambda:us-east-1:{AWS_ACCOUNT_ID}:function:cv-analytics-processor
- **Runtime**: Node.js 20.x
- **Memory**: 512 MB
- **Timeout**: 30 seconds
- **Handler**: dist/index.handler

### Environment Variables
```
QUERY_EVENTS_TABLE = "cv-analytics-query-events"
ANALYTICS_TABLE = "cv-analytics-analytics"
ENVIRONMENT = "prod"
```

### Event Source
- **Trigger**: SQS FIFO Queue (cv-analytics-queue.fifo)
- **Batch Size**: 10 messages
- **Batch Window**: None (FIFO queues don't support batching windows)
- **Report Failed Items**: Enabled (ReportBatchItemFailures)
- **Event Source Mapping UUID**: b537af36-c305-42c7-8f19-3382a2888055

### Monitoring
- **Log Group**: /aws/lambda/cv-analytics-processor (14-day retention)
- **Alarms Created**:
  1. `cv-analytics-processor-errors` — Triggers when >5 errors in 5 minutes
  2. `cv-analytics-processor-throttles` — Triggers on any throttle event
  3. `cv-analytics-dlq-depth` (already existed) — Monitors Dead Letter Queue depth

---

## Key Learnings & Issues Resolved

### Issue 1: AWS_REGION Reserved Key
**Problem**: Lambda threw error: "environment variables you have provided contains reserved keys: AWS_REGION"  
**Solution**: AWS Lambda automatically sets AWS_REGION as an environment variable. Removed it from our Terraform configuration.  
**File Modified**: processor_lambda.tf

### Issue 2: Lambda Concurrency Limits
**Problem**: `Specified ReservedConcurrentExecutions=10 for function decreases account's UnreservedConcurrentExecution below its minimum value of [10]`  
**Cause**: AWS free/new accounts have minimum unresolved concurrent executions of 10. Any reserved concurrency setting would conflict.  
**Solution**: Removed the `reserved_concurrent_executions` setting entirely. Lambda will use account's default concurrency (unreserved).  
**File Modified**: processor_lambda.tf

### Issue 3: FIFO Queue Batching Window
**Problem**: `Batching window is not supported for FIFO queues`  
**Cause**: AWS Lambda's event source mapping for FIFO SQS queues doesn't support the `maximum_batching_window_in_seconds` parameter.  
**Solution**: Removed `maximum_batching_window_in_seconds` from the event source mapping configuration.  
**File Modified**: processor_lambda.tf (line 49)

---

## Processor Lambda Function Purpose

The Processor Lambda reads messages from the SQS FIFO queue, executes the following logic:

1. **Correlation** — Links query and response events into conversations
2. **Transformation** — Normalizes event data
3. **Storage** — Writes correlated events to DynamoDB:
   - `cv-analytics-query-events` table
   - `cv-analytics-analytics` table
4. **Error Handling** — Failed messages sent to DLQ for investigation

**Trigger Frequency**: Real-time as messages arrive in SQS (batch processing every 10 messages)

---

## How to Test Processor Lambda

### 1. Send a Test Event to SQS

```powershell
# Set variables
$QueueUrl = "https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo"
$ProfileName = "cv-analytics"
$MessageBody = @{
    correlationId = "test-correlation-001"
    timestamp = (Get-Date -AsUTC -Format "o")
    type = "query"
    userId = "user-123"
    query = "What is my experience?"
    response = "Based on your CV..."
} | ConvertTo-Json

# Send message (FIFO requires MessageDeduplicationId and MessageGroupId)
aws sqs send-message `
    --queue-url $QueueUrl `
    --message-body $MessageBody `
    --message-deduplication-id "dedup-001" `
    --message-group-id "user-123" `
    --profile $ProfileName
```

### 2. Check Lambda Execution

```powershell
# View recent Lambda logs
aws logs tail /aws/lambda/cv-analytics-processor --follow --profile cv-analytics

# Get Lambda metrics
aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Invocations `
    --dimensions Name=FunctionName,Value=cv-analytics-processor `
    --start-time ((Get-Date).AddHours(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss")) `
    --end-time (Get-Date -AsUTC -Format "yyyy-MM-ddTHH:mm:ss") `
    --period 300 `
    --statistics Sum `
    --profile cv-analytics
```

### 3. Verify Data in DynamoDB

```powershell
# Query cv-analytics-query-events table
aws dynamodb scan `
    --table-name cv-analytics-query-events `
    --limit 5 `
    --profile cv-analytics

# Query cv-analytics-analytics table
aws dynamodb scan `
    --table-name cv-analytics-analytics `
    --limit 5 `
    --profile cv-analytics
```

### 4. Check Alarms

```powershell
# List alarm state
aws cloudwatch describe-alarms `
    --alarm-names cv-analytics-processor-errors cv-analytics-processor-throttles `
    --profile cv-analytics
```

---

## Terraform Configuration Files

### Main Files
- `processor_lambda.tf` — Lambda function, event mapping, logs, alarms
- `main.tf` — Infrastructure (existing SQS, DynamoDB, IAM, EventBridge)
- `variables.tf` — Input variables
- `outputs.tf` — Output values

### State
- `.terraform.lock.hcl` — Provider version lock (AWS v5.100.0, Archive v2.7.1)
- `terraform.tfstate` — Local state file (contains all deployed resources)

---

## Next Steps

### Step E — Deploy Reporter Lambda
- Create `reporter_lambda.tf`
- Lambda triggers weekly (Monday 7 AM UTC) via EventBridge
- Aggregates analytics from DynamoDB
- Sends email reports via SES
- Estimated time: 1-2 hours

### Step F — Integrate Cloudflare Worker
- Configure cv-ai-agent (cv-ai-agent project) with SQS credentials
- Deploy to Cloudflare Workers
- Enable fire-and-forget logging: each API response sends query+response to SQS
- Estimated time: 1 hour

### Step G — Integration Testing
- End-to-end test: Query through cv-ai-agent → SQS → Processor Lambda → DynamoDB
- Verify correlation and analytics data
- Test email reporting
- Estimated time: 2 hours

---

## Deployment Artifacts

```
d:\Code\MyCV\cv-analytics-infrastructure\terraform\
├── processor_lambda.tf          ← New (Step D)
├── main.tf                      ← Infrastructure (Step B)
├── variables.tf
├── outputs.tf
├── terraform.tfstate            ← Updated with Lambda resources
└── .terraform.lock.hcl          ← Updated with archive provider

d:\Code\MyCV\cv-analytics-processor\
├── src/                         ← TypeScript source
├── dist/                        ← Compiled JavaScript (deployed to Lambda)
└── package.json
```

---

## Summary

✅ **Processor Lambda successfully deployed and ready to process analytics events**

All infrastructure is in place:
- SQS FIFO queues (main + DLQ) — ✅ Deployed (Step B)
- DynamoDB tables — ✅ Deployed (Step B)
- Processor Lambda — ✅ Deployed (Step D)
- EventBridge rule — ✅ Created (Step B, waiting for Reporter Lambda)

**Ready for: Step E (Reporter Lambda deployment)**
