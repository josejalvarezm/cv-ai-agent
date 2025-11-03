# CV Analytics - Quick Troubleshooting Reference

**Quick Access Guide** - Common issues and their immediate fixes

---

## 🚨 Emergency Commands

### Check System Health (30 seconds)

```powershell
# All-in-one health check
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform

# 1. Alarm status
aws cloudwatch describe-alarms --profile cv-analytics --query "MetricAlarms[?starts_with(AlarmName, 'cv-analytics')].{Name:AlarmName, State:StateValue}" --output table

# 2. Queue depth
aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo --attribute-names ApproximateNumberOfMessages --profile cv-analytics

# 3. DLQ depth
aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo --attribute-names ApproximateNumberOfMessages --profile cv-analytics

# 4. Recent Lambda errors
aws logs tail /aws/lambda/cv-analytics-processor --filter-pattern "ERROR" --since 1h --profile cv-analytics
```

---

## 📊 Common Issues

### Issue 1: DLQ Alarm - Messages Failing to Process

**Immediate Check:**

```powershell
# How many messages in DLQ?
aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo --attribute-names ApproximateNumberOfMessages --profile cv-analytics

# What do the messages look like?
aws sqs receive-message --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo --max-number-of-messages 1 --profile cv-analytics
```

**Quick Fix:**

```powershell
# Check processor logs for error pattern
aws logs tail /aws/lambda/cv-analytics-processor --filter-pattern "ERROR" --since 2h --profile cv-analytics

# If error is fixed, redrive messages
aws sqs start-message-move-task --source-arn arn:aws:sqs:us-east-1:{AWS_ACCOUNT_ID}:cv-analytics-dlq.fifo --destination-arn arn:aws:sqs:us-east-1:{AWS_ACCOUNT_ID}:cv-analytics-queue.fifo --profile cv-analytics
```

---

### Issue 2: Processor Lambda Errors

**Immediate Check:**

```powershell
# Recent error logs
aws logs tail /aws/lambda/cv-analytics-processor --filter-pattern "ERROR" --since 1h --profile cv-analytics

# Error count
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=cv-analytics-processor --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") --period 300 --statistics Sum --profile cv-analytics
```

**Common Error Patterns:**

| Error Message | Cause | Fix |
|---------------|-------|-----|
| `Missing the key requestId` | Schema mismatch | Update Worker event structure |
| `ResourceNotFoundException` | DynamoDB table deleted | Run `terraform apply` |
| `AccessDeniedException` | IAM permission issue | Check Lambda role policy |
| `ProvisionedThroughputExceededException` | DynamoDB throttling | Increase WCU or use on-demand |

---

### Issue 3: No Events in DynamoDB

**Immediate Check:**

```powershell
# Check if Worker is sending to SQS
aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo --attribute-names NumberOfMessagesSent --profile cv-analytics

# Check if Lambda is running
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --dimensions Name=FunctionName,Value=cv-analytics-processor --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") --period 300 --statistics Sum --profile cv-analytics

# Check event source mapping
aws lambda list-event-source-mappings --function-name cv-analytics-processor --profile cv-analytics
```

**Quick Fix:**

```powershell
# If event source mapping is disabled
aws lambda update-event-source-mapping --uuid <mapping-uuid> --enabled --profile cv-analytics

# If Worker secrets are wrong
cd d:\Code\MyCV\cv-ai-agent
wrangler secret put AWS_SQS_URL --env production
# Enter: https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo
```

---

### Issue 4: Reporter Not Sending Emails

**Immediate Check:**

```powershell
# Check recent Reporter execution
aws logs tail /aws/lambda/cv-analytics-reporter --since 24h --profile cv-analytics

# Check SES sandbox status
aws ses get-send-quota --profile cv-analytics --region us-east-1

# Verify sender email
aws ses list-identities --profile cv-analytics --region us-east-1
```

**Quick Fix:**

```powershell
# Verify email identity if unverified
aws ses verify-email-identity --email-address contact@{YOUR_DOMAIN} --profile cv-analytics --region us-east-1

# Test manual invocation
aws lambda invoke --function-name cv-analytics-reporter --profile cv-analytics response.json
cat response.json
```

---

### Issue 5: Cloudflare Worker Not Sending Events

**Immediate Check:**

```powershell
# Check Worker logs
cd d:\Code\MyCV\cv-ai-agent
wrangler tail --env production

# Check Worker secrets
wrangler secret list --env production

# Test Worker endpoint
curl https://cv-ai-agent-public.{YOUR_WORKERS_SUBDOMAIN}/health
```

**Quick Fix:**

```powershell
# Redeploy Worker
wrangler deploy --env production

# Verify secrets are set
wrangler secret put AWS_ACCESS_KEY_ID --env production
wrangler secret put AWS_SECRET_ACCESS_KEY --env production
```

---

## 🔧 Quick Fixes

### Restart Event Processing

```powershell
# Disable event source mapping
aws lambda update-event-source-mapping --uuid <uuid> --no-enabled --profile cv-analytics

# Wait 10 seconds
Start-Sleep -Seconds 10

# Re-enable
aws lambda update-event-source-mapping --uuid <uuid> --enabled --profile cv-analytics
```

### Clear Queue (Caution!)

```powershell
# Only if queue has bad messages that should be discarded
aws sqs purge-queue --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo --profile cv-analytics
```

### Force Reporter Run

```powershell
# Manually trigger weekly report
aws lambda invoke --function-name cv-analytics-reporter --profile cv-analytics --log-type Tail response.json
```

### Rollback Worker

```powershell
cd d:\Code\MyCV\cv-ai-agent
wrangler deployments list --env production
wrangler rollback --deployment-id <previous-deployment-id> --env production
```

---

## 📈 Monitoring Shortcuts

### Live Log Tailing

```powershell
# Processor Lambda
aws logs tail /aws/lambda/cv-analytics-processor --follow --profile cv-analytics

# Reporter Lambda
aws logs tail /aws/lambda/cv-analytics-reporter --follow --profile cv-analytics

# Filter for errors only
aws logs tail /aws/lambda/cv-analytics-processor --follow --filter-pattern "ERROR" --profile cv-analytics
```

### Quick Metrics

```powershell
# Lambda invocations (last hour)
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --dimensions Name=FunctionName,Value=cv-analytics-processor --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") --period 300 --statistics Sum --profile cv-analytics

# Lambda errors (last hour)
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=cv-analytics-processor --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") --period 300 --statistics Sum --profile cv-analytics

# DynamoDB item count
aws dynamodb scan --table-name cv-analytics-query-events --select COUNT --profile cv-analytics
```

---

## 🎯 Emergency Contacts

| Scenario | Action |
|----------|--------|
| **Multiple alarms firing** | Check AWS Service Health: <https://health.aws.amazon.com> |
| **Worker down** | Check Cloudflare Status: <https://www.cloudflarestatus.com> |
| **Infrastructure issue** | Review recent commits: `git log --oneline` |
| **Unknown error** | Check full runbook: `CV_ANALYTICS_RUNBOOK.md` |

---

## 📝 Useful One-Liners

```powershell
# Get all Terraform outputs
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform && terraform output

# Check all alarm states
aws cloudwatch describe-alarms --profile cv-analytics --query "MetricAlarms[?starts_with(AlarmName, 'cv-analytics')].{Name:AlarmName, State:StateValue}"

# Count events in last 24 hours
aws dynamodb scan --table-name cv-analytics-query-events --profile cv-analytics --filter-expression "timestamp > :since" --expression-attribute-values '{":since":{"N":"'$(( (Get-Date).AddDays(-1).ToUniversalTime() - [datetime]'1970-01-01' ).TotalMilliseconds -as [long] )'"}}' --select COUNT

# Get latest 5 events
aws dynamodb scan --table-name cv-analytics-query-events --profile cv-analytics --limit 5 --query "Items[*].{RequestID:requestId.S,Query:query.S,Timestamp:timestamp.N}"

# Check if SNS subscription confirmed
aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:us-east-1:{AWS_ACCOUNT_ID}:cv-analytics-alarms --profile cv-analytics --query "Subscriptions[?Endpoint=='contact@{YOUR_DOMAIN}'].SubscriptionArn"
```

---

**For comprehensive troubleshooting, see:** [CV_ANALYTICS_RUNBOOK.md](./CV_ANALYTICS_RUNBOOK.md)
