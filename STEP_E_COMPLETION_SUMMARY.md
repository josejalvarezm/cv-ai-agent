# Step E — Reporter Lambda Deployment ✅ COMPLETE

**Date Completed**: 2025-11-03  
**Status**: ✅ Successfully deployed to AWS  
**Deployment Time**: ~30 minutes

---

## What Was Deployed

### Lambda Function
- **Name**: cv-analytics-reporter
- **ARN**: arn:aws:lambda:us-east-1:{AWS_ACCOUNT_ID}:function:cv-analytics-reporter
- **Runtime**: Node.js 20.x
- **Memory**: 512 MB
- **Timeout**: 60 seconds
- **Handler**: dist/index.handler

### Environment Variables
```
ANALYTICS_TABLE = "cv-analytics-analytics"
QUERY_EVENTS_TABLE = "cv-analytics-query-events"
RECIPIENT_EMAIL = "jose@{YOUR_DOMAIN}"
SENDER_EMAIL = "alerts@{YOUR_DOMAIN}"
ENVIRONMENT = "prod"
```

### Trigger
- **Type**: EventBridge rule (weekly schedule)
- **Schedule**: Cron expression: `0 7 ? * MON *` (Monday 7 AM UTC)
- **Rule Name**: cv-analytics-weekly-reporter
- **Retry Policy**: 2 retries, 1 hour timeout

### Monitoring
- **Log Group**: /aws/lambda/cv-analytics-reporter (14-day retention)
- **Alarms Created**:
  1. `cv-analytics-reporter-errors` — Triggers when any error occurs
  2. `cv-analytics-reporter-throttles` — Triggers on any throttle event
  3. `cv-analytics-reporter-duration` — Triggers when execution time > 45 seconds (60s timeout)

---

## Reporter Lambda Function Purpose

The Reporter Lambda executes every Monday at 7 AM UTC and:

1. **Query Analytics** — Reads aggregated data from DynamoDB for the previous week
2. **Compute Statistics** — Calculates:
   - Total queries
   - Unique sessions
   - Average response time
   - Cache hit rate
   - Total tokens used
   - LLM usage breakdown
   - Performance percentiles (P50, P95, P99)
   - Top 10 queries by frequency
   - Top query sources
3. **Generate Report** — Creates HTML and plain text email templates with:
   - Weekly summary statistics
   - Cost analysis
   - Performance metrics
   - Top queries and sources
4. **Send Email** — Sends formatted email via AWS SES to configured recipient

---

## Key Implementation Details

### Environment Variables
Both `RECIPIENT_EMAIL` and `SENDER_EMAIL` are required and must be:
- **RECIPIENT_EMAIL**: Email address to receive weekly reports
- **SENDER_EMAIL**: Verified SES sender email (must be verified in AWS SES)

**Important**: Both emails are stored as sensitive variables in Terraform state file.

### SES Configuration Required
Before the Reporter Lambda can send emails, you must:

1. **Verify SENDER_EMAIL in AWS SES**:
```powershell
aws ses verify-email-identity \
  --email-address alerts@{YOUR_DOMAIN} \
  --region us-east-1 \
  --profile cv-analytics
```

2. **Check verification status**:
```powershell
aws ses list-verified-email-addresses \
  --region us-east-1 \
  --profile cv-analytics
```

3. **Request production access** (if still in SES sandbox):
   - Go to AWS Console → SES → Account Dashboard
   - Click "Request Production Access"
   - AWS requires you to describe intended use and may take 24 hours to approve

### Retry and Error Handling
- **Failed executions**: EventBridge retries up to 2 times within 1 hour
- **Lambda duration**: If execution takes >45 seconds, `reporter_duration` alarm triggers
- **No DLQ**: EventBridge doesn't support SQS FIFO DLQs, so failed Lambda invocations log to CloudWatch only

---

## Testing Reporter Lambda

### 1. Test Manual Lambda Invocation

Create a test event (EventBridge format):
```powershell
$testEvent = @{
    source = "aws.events"
    detail = @{}
    "detail-type" = "Scheduled Event"
    account = "{AWS_ACCOUNT_ID}"
    region = "us-east-1"
} | ConvertTo-Json

# Invoke Reporter Lambda
aws lambda invoke `
    --function-name cv-analytics-reporter `
    --payload $testEvent `
    --region us-east-1 `
    --profile cv-analytics `
    response.json

# Check response
Get-Content response.json
```

### 2. Check CloudWatch Logs
```powershell
# Stream recent logs
aws logs tail /aws/lambda/cv-analytics-reporter --follow --profile cv-analytics

# View specific log group stats
aws logs describe-log-groups `
    --log-group-name-prefix /aws/lambda/cv-analytics-reporter `
    --profile cv-analytics
```

### 3. Verify SES Email Sending
```powershell
# Check SES statistics
aws ses get-account-sending-enabled --region us-east-1 --profile cv-analytics

# View bounce/complaint rates
aws ses get-account-sending-enabled --region us-east-1 --profile cv-analytics
```

### 4. Check Alarms
```powershell
# List all reporter alarms
aws cloudwatch describe-alarms `
    --alarm-name-prefix cv-analytics-reporter `
    --profile cv-analytics
```

---

## Terraform Configuration

### Files
- `reporter_lambda.tf` — Reporter Lambda, permissions, logs, alarms
- `variables.tf` — Added email variables (recipient_email, sender_email)
- `main.tf` — Updated to comment out placeholder EventBridge target

### State
- `terraform.tfstate` — Updated with Reporter Lambda resources
- `.terraform.lock.hcl` — No changes (existing AWS/Archive providers used)

---

## Weekly Report Content

The Reporter Lambda generates two email formats:

### HTML Format
- Styled report with sections:
  - Week summary (dates, total queries, unique sessions)
  - Cost analysis (total tokens, estimated cost breakdown)
  - LLM usage table (model, count, tokens, cost per model)
  - Performance metrics (min, max, percentiles)
  - Top 10 queries with match quality scores
  - Top sources used

### Plain Text Format
- Simple ASCII format suitable for plain text emails:
  - Same structure as HTML but in text format
  - No HTML tags or styling
  - More compact and email client compatible

Both formats include:
- Week identifier (ISO format: "2025-W44")
- Date range
- All statistics in human-readable format
- Footer with generation timestamp

---

## Cost Implications

### Reporter Lambda Costs
- **Execution**: ~$0.0000002 per execution + $0.0000167 per GB-second
  - 512 MB × 30 seconds ≈ $0.00000025 per run
- **CloudWatch Logs**: ~$0.50 per GB ingested (depends on logging volume)
- **DynamoDB Query**: Uses on-demand billing (read capacity consumed)
- **SES**: $0.10 per email sent (first 62,000 emails/month free with SES)

### Estimated Monthly Cost
- **Lambda**: < $0.01 (4 invocations × 52 weeks ≈ $0.0001)
- **CloudWatch**: ~$0.10 (estimated for log ingestion)
- **DynamoDB**: Variable based on data volume
- **SES**: < $1 (assuming ~50 emails/month)
- **Total**: ~$2–5/month (dominated by DynamoDB and storage)

---

## Troubleshooting

### Lambda Fails to Send Email
**Symptoms**: Logs show successful query but no email received
**Causes**:
1. SENDER_EMAIL not verified in SES
2. Account still in SES sandbox (can only send to verified recipients)
3. RECIPIENT_EMAIL not verified if in sandbox
4. SES permissions not in Lambda IAM role

**Solution**: Verify both emails in SES console or request production access

### Lambda Timeout (>60 seconds)
**Symptoms**: `Duration` alarm triggers, report not sent
**Causes**:
1. DynamoDB query slow (large dataset)
2. SES email sending delayed
3. Lambda memory too low (512 MB might be tight with large reports)

**Solution**: 
- Increase Lambda timeout to 120 seconds
- Check DynamoDB capacity
- Monitor query performance

### No Data in Report (Empty Report)
**Symptoms**: Email received with "No chatbot queries were recorded this week"
**Causes**:
1. Processor Lambda not receiving messages
2. No queries made to chatbot
3. Correlation logic not working

**Solution**: Check Processor Lambda logs and verify SQS messages are being processed

### EventBridge Not Triggering Lambda
**Symptoms**: Lambda never executes (no logs, no alarms)
**Causes**:
1. EventBridge rule disabled
2. Lambda permission not granted
3. EventBridge target ARN incorrect

**Solution**:
```powershell
# Check rule state
aws events describe-rule `
    --name cv-analytics-weekly-reporter `
    --profile cv-analytics

# Check targets
aws events list-targets-by-rule `
    --rule cv-analytics-weekly-reporter `
    --profile cv-analytics
```

---

## Next Steps

### Step F — Integrate Cloudflare Worker
- Deploy cv-ai-agent to Cloudflare Workers
- Configure SQS fire-and-forget logging
- Each chatbot query+response automatically sent to SQS queue
- Processor Lambda processes these messages → DynamoDB correlation
- Reporter Lambda aggregates weekly statistics

### Test Full End-to-End Pipeline
1. Query chatbot through Cloudflare Worker
2. Verify message in SQS queue
3. Check Processor Lambda execution
4. Verify data in DynamoDB tables
5. Manually trigger Reporter Lambda
6. Confirm email received

---

## Summary

✅ **Reporter Lambda successfully deployed and configured**

Deployment status:
- Lambda function deployed ✅
- EventBridge trigger configured ✅
- CloudWatch logs and alarms set up ✅
- Terraform infrastructure managed ✅

**Action items before going live**:
1. Verify SENDER_EMAIL and RECIPIENT_EMAIL in AWS SES
2. Request SES production access (if in sandbox)
3. Test email delivery with manual Lambda invocation
4. Verify DynamoDB has data from Processor Lambda

**Ready for: Step F (Cloudflare Worker integration)**
