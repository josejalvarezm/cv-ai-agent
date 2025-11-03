# CV Analytics Pipeline - Operational Runbook

**Version**: 1.0  
**Last Updated**: November 3, 2025  
**Owner**: Jose Alvarez  
**Contact**: contact@{YOUR_DOMAIN}

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Deployment Guide](#deployment-guide)
3. [Operational Procedures](#operational-procedures)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Emergency Response](#emergency-response)
7. [Rollback Procedures](#rollback-procedures)
8. [Maintenance Tasks](#maintenance-tasks)

---

## System Overview

### Architecture

The CV Analytics Pipeline is a serverless AWS infrastructure that collects, processes, and reports on chatbot query analytics.

**Components:**
- **Cloudflare Worker** (`cv-ai-agent-public.{YOUR_WORKERS_SUBDOMAIN}`) - Sends query/response events
- **AWS SQS FIFO Queue** - Buffers events for processing
- **Processor Lambda** - Stores events in DynamoDB
- **Reporter Lambda** - Generates weekly analytics reports
- **DynamoDB Tables** - Stores query events and aggregated analytics
- **CloudWatch Alarms** - Monitors system health via email alerts

### Critical Endpoints

| Component | Endpoint/ARN |
|-----------|--------------|
| **Cloudflare Worker** | `https://cv-ai-agent-public.{YOUR_WORKERS_SUBDOMAIN}` |
| **SQS Queue** | `https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo` |
| **SQS DLQ** | `https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo` |
| **Processor Lambda** | `arn:aws:lambda:us-east-1:{AWS_ACCOUNT_ID}:function:cv-analytics-processor` |
| **Reporter Lambda** | `arn:aws:lambda:us-east-1:{AWS_ACCOUNT_ID}:function:cv-analytics-reporter` |
| **Query Events Table** | `cv-analytics-query-events` (DynamoDB) |
| **Analytics Table** | `cv-analytics-analytics` (DynamoDB) |
| **SNS Alarms Topic** | `arn:aws:sns:us-east-1:{AWS_ACCOUNT_ID}:cv-analytics-alarms` |

### AWS Account Details

- **Account ID**: {AWS_ACCOUNT_ID}
- **Region**: us-east-1 (N. Virginia)
- **CLI Profile**: `cv-analytics`
- **IAM Deployer User**: `cv-analytics-deployer`

---

## Deployment Guide

### Prerequisites

**Required Tools:**
- AWS CLI v2
- Terraform v1.13.4+
- Node.js v20+ (for Lambda builds)
- Wrangler CLI (for Cloudflare Worker)
- Git

**Required Credentials:**
- AWS CLI profile `cv-analytics` configured
- Cloudflare account access for Worker deployments
- AWS SES verified email: `contact@{YOUR_DOMAIN}`

### Full Deployment (New Environment)

#### 1. Deploy AWS Infrastructure

```powershell
# Navigate to Terraform directory
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform

# Initialize Terraform
terraform init

# Review plan
terraform plan -var="recipient_email=contact@{YOUR_DOMAIN}" -var="sender_email=contact@{YOUR_DOMAIN}" -var="alarm_email=contact@{YOUR_DOMAIN}"

# Apply infrastructure
terraform apply -var="recipient_email=contact@{YOUR_DOMAIN}" -var="sender_email=contact@{YOUR_DOMAIN}" -var="alarm_email=contact@{YOUR_DOMAIN}"

# Note the outputs (SQS URL, DynamoDB tables, Lambda ARNs)
terraform output
```

**Expected Resources Created:**
- 2 SQS queues (main + DLQ)
- 2 DynamoDB tables (query-events + analytics)
- 2 Lambda functions (processor + reporter)
- 2 IAM roles + policies
- 1 EventBridge rule (weekly trigger)
- 6 CloudWatch alarms
- 1 SNS topic + email subscription
- 2 CloudWatch log groups

#### 2. Configure Cloudflare Worker Secrets

```powershell
# Navigate to Worker directory
cd d:\Code\MyCV\cv-ai-agent

# Get SQS URL from Terraform output
$SQS_URL = terraform output -raw sqs_queue_url

# Configure secrets (production environment)
wrangler secret put AWS_SQS_URL --env production
# Enter: https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo

wrangler secret put AWS_REGION --env production
# Enter: us-east-1

wrangler secret put AWS_ACCESS_KEY_ID --env production
# Enter: <cv-analytics-deployer access key>

wrangler secret put AWS_SECRET_ACCESS_KEY --env production
# Enter: <cv-analytics-deployer secret key>
```

#### 3. Deploy Cloudflare Worker

```powershell
# Still in cv-ai-agent directory
wrangler deploy --env production

# Verify deployment
curl https://cv-ai-agent-public.{YOUR_WORKERS_SUBDOMAIN}/health
```

#### 4. Verify End-to-End Integration

```powershell
# Send test query
curl -X POST https://cv-ai-agent-public.{YOUR_WORKERS_SUBDOMAIN}/query `
  -H "Content-Type: application/json" `
  -d '{\"query\": \"Test deployment verification\"}'

# Wait 10-15 seconds for processing

# Check DynamoDB for event
aws dynamodb scan --table-name cv-analytics-query-events --limit 5 --profile cv-analytics

# Check SQS queue depth (should be 0 if processing)
aws sqs get-queue-attributes `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo `
  --attribute-names ApproximateNumberOfMessages `
  --profile cv-analytics
```

#### 5. Confirm SNS Email Subscription

```powershell
# Check subscription status
aws sns list-subscriptions-by-topic `
  --topic-arn arn:aws:sns:us-east-1:{AWS_ACCOUNT_ID}:cv-analytics-alarms `
  --profile cv-analytics `
  --query "Subscriptions[?Endpoint=='contact@{YOUR_DOMAIN}'].SubscriptionArn"

# If status is "PendingConfirmation", check email and click confirmation link
```

---

### Lambda Function Updates

#### Updating Processor Lambda

```powershell
# Navigate to processor project
cd d:\Code\MyCV\cv-analytics-infrastructure\lambda\processor

# Build TypeScript
npm run build

# Terraform will auto-deploy on next apply (detects source_code_hash change)
cd ..\..\terraform
terraform apply -var="recipient_email=contact@{YOUR_DOMAIN}" -var="sender_email=contact@{YOUR_DOMAIN}" -var="alarm_email=contact@{YOUR_DOMAIN}"

# Verify new version deployed
aws lambda get-function --function-name cv-analytics-processor --profile cv-analytics --query 'Configuration.LastModified'
```

#### Updating Reporter Lambda

```powershell
# Navigate to reporter project
cd d:\Code\MyCV\cv-analytics-infrastructure\lambda\reporter

# Build TypeScript
npm run build

# Terraform will auto-deploy on next apply
cd ..\..\terraform
terraform apply -var="recipient_email=contact@{YOUR_DOMAIN}" -var="sender_email=contact@{YOUR_DOMAIN}" -var="alarm_email=contact@{YOUR_DOMAIN}"
```

#### Updating Cloudflare Worker

```powershell
# Navigate to worker project
cd d:\Code\MyCV\cv-ai-agent

# Deploy to production
wrangler deploy --env production

# Verify deployment
wrangler deployments list --env production
```

---

## Operational Procedures

### Daily Health Checks

**Automated Monitoring:**
- CloudWatch alarms automatically monitor all critical metrics
- Email alerts sent to `contact@{YOUR_DOMAIN}` on any issues

**Manual Verification (Weekly):**

```powershell
# 1. Check CloudWatch alarm status
aws cloudwatch describe-alarms `
  --profile cv-analytics `
  --query "MetricAlarms[?starts_with(AlarmName, 'cv-analytics')].{Name:AlarmName, State:StateValue}" `
  --output table

# 2. Check SQS queue depth (should be ~0)
aws sqs get-queue-attributes `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo `
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible `
  --profile cv-analytics

# 3. Check DLQ (should be 0)
aws sqs get-queue-attributes `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo `
  --attribute-names ApproximateNumberOfMessages `
  --profile cv-analytics

# 4. Check recent DynamoDB writes
aws dynamodb scan --table-name cv-analytics-query-events `
  --limit 5 `
  --profile cv-analytics `
  --query "Items[*].{RequestID:requestId.S,Timestamp:timestamp.N,Query:query.S}"

# 5. Check Lambda execution counts (last 24 hours)
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Invocations `
  --dimensions Name=FunctionName,Value=cv-analytics-processor `
  --start-time (Get-Date).AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 3600 `
  --statistics Sum `
  --profile cv-analytics
```

### Weekly Reports

The Reporter Lambda automatically runs every **Monday at 7:00 AM UTC** (via EventBridge).

**Report Delivery:**
- Sent via AWS SES to: `contact@{YOUR_DOMAIN}`
- Subject: `CV Analytics Weekly Report - Week [YYYY-Www]`
- Contains: Query counts, match quality metrics, performance stats

**Manual Report Trigger:**

```powershell
# Invoke Reporter Lambda manually
aws lambda invoke `
  --function-name cv-analytics-reporter `
  --profile cv-analytics `
  --log-type Tail `
  response.json

# Check execution result
cat response.json

# View logs
aws logs tail /aws/lambda/cv-analytics-reporter --follow --profile cv-analytics
```

---

## Monitoring & Alerts

### CloudWatch Alarms

| Alarm Name | Metric | Threshold | Action |
|------------|--------|-----------|--------|
| **cv-analytics-dlq-depth** | DLQ messages | > 10 | Investigate processing failures |
| **cv-analytics-processor-errors** | Lambda errors | > 5 in 5 min | Check processor logs |
| **cv-analytics-processor-throttles** | Lambda throttles | > 1 | Increase concurrency or reduce load |
| **cv-analytics-reporter-errors** | Lambda errors | > 1 | Check reporter logs + SES config |
| **cv-analytics-reporter-throttles** | Lambda throttles | > 1 | Review Lambda settings |
| **cv-analytics-reporter-duration** | Execution time | > 45 sec | Optimize code or increase timeout |

### Email Alert Response

When you receive an alarm email:

1. **Identify the alarm** from subject line
2. **Check AWS Console** → CloudWatch → Alarms for details
3. **Review CloudWatch Logs** for the related Lambda function
4. **Follow troubleshooting steps** (see section below)
5. **Document the incident** if resolution required code changes
6. **Monitor alarm state** until it returns to OK

### CloudWatch Logs

**Processor Lambda Logs:**

```powershell
# Tail live logs
aws logs tail /aws/lambda/cv-analytics-processor --follow --profile cv-analytics

# Filter for errors
aws logs tail /aws/lambda/cv-analytics-processor --filter-pattern "ERROR" --profile cv-analytics

# Get specific log stream
aws logs get-log-events `
  --log-group-name /aws/lambda/cv-analytics-processor `
  --log-stream-name <stream-name> `
  --profile cv-analytics
```

**Reporter Lambda Logs:**

```powershell
# Tail live logs
aws logs tail /aws/lambda/cv-analytics-reporter --follow --profile cv-analytics

# Filter for errors
aws logs tail /aws/lambda/cv-analytics-reporter --filter-pattern "ERROR" --profile cv-analytics
```

---

## Troubleshooting Guide

### Issue: Messages in Dead Letter Queue

**Symptom:** `cv-analytics-dlq-depth` alarm triggered

**Diagnosis:**

```powershell
# 1. Check DLQ message count
aws sqs get-queue-attributes `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo `
  --attribute-names ApproximateNumberOfMessages `
  --profile cv-analytics

# 2. Peek at DLQ messages
aws sqs receive-message `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo `
  --max-number-of-messages 5 `
  --profile cv-analytics

# 3. Check processor Lambda logs for errors
aws logs tail /aws/lambda/cv-analytics-processor --filter-pattern "ERROR" --profile cv-analytics
```

**Common Causes:**
- **Invalid event structure** - Worker sending malformed JSON
- **DynamoDB throttling** - Too many concurrent writes
- **Missing requestId** - Event schema mismatch
- **Lambda timeout** - Processing taking > 30 seconds

**Resolution:**

1. **If malformed events**: Update Worker code and redeploy
2. **If DynamoDB throttling**: Increase WCU or use on-demand billing
3. **If schema issues**: Verify event structure matches types.ts
4. **If timeouts**: Increase Lambda timeout in Terraform

**After fixing root cause:**

```powershell
# Redrive messages from DLQ back to main queue
aws sqs start-message-move-task `
  --source-arn arn:aws:sqs:us-east-1:{AWS_ACCOUNT_ID}:cv-analytics-dlq.fifo `
  --destination-arn arn:aws:sqs:us-east-1:{AWS_ACCOUNT_ID}:cv-analytics-queue.fifo `
  --profile cv-analytics

# Monitor progress
aws sqs get-queue-attributes `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo `
  --attribute-names ApproximateNumberOfMessages `
  --profile cv-analytics
```

---

### Issue: Processor Lambda Errors

**Symptom:** `cv-analytics-processor-errors` alarm triggered

**Diagnosis:**

```powershell
# Check recent errors
aws logs tail /aws/lambda/cv-analytics-processor --filter-pattern "ERROR" --since 1h --profile cv-analytics

# Check Lambda metrics
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Errors `
  --dimensions Name=FunctionName,Value=cv-analytics-processor `
  --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 300 `
  --statistics Sum `
  --profile cv-analytics
```

**Common Causes:**
- **DynamoDB permission errors** - IAM role missing PutItem permission
- **Invalid data types** - Type coercion failures in event parsing
- **Network timeouts** - DynamoDB temporarily unavailable
- **Memory exhaustion** - Lambda OOM (check Duration vs Memory)

**Resolution:**

1. **Check IAM permissions**: Review `cv-analytics-lambda-role` policy
2. **Validate event schema**: Check Worker is sending correct types
3. **Review Lambda metrics**: Memory usage, duration, concurrent executions
4. **Update code if needed**: Fix bugs and redeploy

---

### Issue: Reporter Lambda Not Sending Emails

**Symptom:** `cv-analytics-reporter-errors` alarm or no weekly email received

**Diagnosis:**

```powershell
# Check Reporter Lambda logs
aws logs tail /aws/lambda/cv-analytics-reporter --since 24h --profile cv-analytics

# Check SES sending quota
aws ses get-send-quota --profile cv-analytics --region us-east-1

# Verify email identity
aws ses list-identities --profile cv-analytics --region us-east-1

# Check EventBridge rule is enabled
aws events describe-rule --name cv-analytics-weekly-reporter --profile cv-analytics
```

**Common Causes:**
- **SES sandbox mode** - Can only send to verified emails
- **Email not verified** - Sender/recipient not verified in SES
- **IAM permissions** - Lambda role missing SES:SendEmail
- **EventBridge disabled** - Rule not triggering Lambda
- **Lambda timeout** - Email generation taking > 60 seconds

**Resolution:**

1. **SES Sandbox**: Request production access in SES console
2. **Verify emails**: 
   ```powershell
   aws ses verify-email-identity --email-address contact@{YOUR_DOMAIN} --profile cv-analytics --region us-east-1
   ```
3. **Check IAM role**: Ensure `ses:SendEmail` permission exists
4. **Enable EventBridge rule**: 
   ```powershell
   aws events enable-rule --name cv-analytics-weekly-reporter --profile cv-analytics
   ```
5. **Test manually**: Invoke Lambda and check logs

---

### Issue: High Lambda Costs

**Symptom:** Unexpected AWS bill increase

**Diagnosis:**

```powershell
# Check Lambda invocation counts (last 7 days)
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Invocations `
  --dimensions Name=FunctionName,Value=cv-analytics-processor `
  --start-time (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 86400 `
  --statistics Sum `
  --profile cv-analytics

# Check Lambda duration (average)
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Duration `
  --dimensions Name=FunctionName,Value=cv-analytics-processor `
  --start-time (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 86400 `
  --statistics Average `
  --profile cv-analytics
```

**Common Causes:**
- **Excessive invocations** - Worker sending duplicate events
- **Long execution times** - Inefficient code or large data processing
- **High memory allocation** - Lambda configured with more memory than needed
- **DynamoDB throttling** - Causing retries and extra executions

**Resolution:**

1. **Review Worker logic**: Ensure no duplicate event sending
2. **Optimize Lambda code**: Reduce processing time
3. **Adjust memory**: Lower to minimum needed (currently 512MB)
4. **Enable DynamoDB on-demand**: Or increase provisioned capacity
5. **Add request deduplication**: Use SQS FIFO deduplication ID

---

### Issue: No Events in DynamoDB

**Symptom:** DynamoDB query_events table is empty despite Worker traffic

**Diagnosis:**

```powershell
# 1. Check Worker is sending to SQS
aws sqs get-queue-attributes `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo `
  --attribute-names NumberOfMessagesSent,NumberOfMessagesReceived `
  --profile cv-analytics

# 2. Check Lambda is processing
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Invocations `
  --dimensions Name=FunctionName,Value=cv-analytics-processor `
  --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 300 `
  --statistics Sum `
  --profile cv-analytics

# 3. Check event source mapping
aws lambda list-event-source-mappings `
  --function-name cv-analytics-processor `
  --profile cv-analytics

# 4. Check DLQ for failed messages
aws sqs get-queue-attributes `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-dlq.fifo `
  --attribute-names ApproximateNumberOfMessages `
  --profile cv-analytics
```

**Common Causes:**
- **Worker not calling SQS** - Missing or invalid AWS credentials in Wrangler secrets
- **SigV4 auth failure** - Incorrect signing implementation
- **Event source mapping disabled** - Lambda not consuming SQS
- **All messages in DLQ** - Processing failures (see DLQ troubleshooting)
- **DynamoDB write failures** - IAM permissions or throttling

**Resolution:**

1. **Verify Worker secrets**: `wrangler secret list --env production`
2. **Test SQS directly**: Send test message via AWS CLI
3. **Enable event source mapping**: 
   ```powershell
   aws lambda update-event-source-mapping --uuid <uuid> --enabled --profile cv-analytics
   ```
4. **Check DLQ**: Process failed messages
5. **Review Lambda logs**: Check for DynamoDB errors

---

## Emergency Response

### Complete System Outage

**Symptoms:**
- Multiple CloudWatch alarms firing
- No events being processed
- User queries failing

**Immediate Actions:**

1. **Check AWS Service Health Dashboard**: <https://health.aws.amazon.com/health/status>
2. **Verify Cloudflare Worker status**: <https://www.cloudflarestatus.com/>
3. **Check Lambda function states**:
   ```powershell
   aws lambda get-function --function-name cv-analytics-processor --profile cv-analytics
   aws lambda get-function --function-name cv-analytics-reporter --profile cv-analytics
   ```
4. **Review recent deployments**: Check if issue started after deployment

**If AWS service degradation:**
- Monitor AWS Health Dashboard for updates
- No action needed - AWS will restore service

**If deployment-related:**
- Proceed to Rollback Procedures (below)

---

### Rollback Procedures

#### Rollback Lambda Function

```powershell
# 1. List recent Lambda versions
aws lambda list-versions-by-function --function-name cv-analytics-processor --profile cv-analytics

# 2. Get current alias/version
aws lambda get-alias --function-name cv-analytics-processor --name LIVE --profile cv-analytics

# 3. Rollback to previous version using Terraform
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform

# 4. Check git history for last working version
git log --oneline lambda/processor/

# 5. Revert to previous commit
git revert <commit-hash>

# 6. Rebuild and redeploy
cd lambda/processor
npm run build
cd ../../terraform
terraform apply -var="recipient_email=contact@{YOUR_DOMAIN}" -var="sender_email=contact@{YOUR_DOMAIN}" -var="alarm_email=contact@{YOUR_DOMAIN}"
```

#### Rollback Cloudflare Worker

```powershell
# 1. List recent deployments
cd d:\Code\MyCV\cv-ai-agent
wrangler deployments list --env production

# 2. Rollback to specific deployment
wrangler rollback --deployment-id <deployment-id> --env production

# Verify rollback
wrangler deployments list --env production
```

#### Rollback Terraform Infrastructure

```powershell
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform

# 1. Check git history
git log --oneline

# 2. Revert to previous commit
git revert <commit-hash>

# 3. Review plan
terraform plan -var="recipient_email=contact@{YOUR_DOMAIN}" -var="sender_email=contact@{YOUR_DOMAIN}" -var="alarm_email=contact@{YOUR_DOMAIN}"

# 4. Apply rollback
terraform apply -var="recipient_email=contact@{YOUR_DOMAIN}" -var="sender_email=contact@{YOUR_DOMAIN}" -var="alarm_email=contact@{YOUR_DOMAIN}"
```

---

### Disaster Recovery

#### DynamoDB Table Deletion

**Prevention:**
- Terraform manages table lifecycle - always use Terraform
- Never manually delete tables via AWS Console/CLI

**If table accidentally deleted:**

```powershell
# Recreate via Terraform
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform
terraform apply -var="recipient_email=contact@{YOUR_DOMAIN}" -var="sender_email=contact@{YOUR_DOMAIN}" -var="alarm_email=contact@{YOUR_DOMAIN}"

# Note: Historical data will be lost (no backups currently enabled)
# Consider enabling Point-in-Time Recovery (PITR) for future protection
```

**Enable PITR for future protection:**

Add to `main.tf`:
```hcl
resource "aws_dynamodb_table" "query_events" {
  # ... existing config ...
  
  point_in_time_recovery {
    enabled = true
  }
}
```

#### SQS Queue Purged

```powershell
# If main queue purged - events will be lost but system continues
# If DLQ purged - failed events lost but system continues

# No recovery possible for purged messages
# Prevent by not using `aws sqs purge-queue` command
```

---

## Maintenance Tasks

### Monthly Tasks

**1. Review CloudWatch Costs**

```powershell
# Check log group sizes
aws logs describe-log-groups --profile cv-analytics --query "logGroups[?starts_with(logGroupName, '/aws/lambda/cv-analytics')].{Name:logGroupName,Size:storedBytes}"

# Consider reducing retention if logs too large
aws logs put-retention-policy --log-group-name /aws/lambda/cv-analytics-processor --retention-in-days 7 --profile cv-analytics
```

**2. Review DynamoDB Usage**

```powershell
# Check table sizes
aws dynamodb describe-table --table-name cv-analytics-query-events --profile cv-analytics --query "Table.TableSizeBytes"
aws dynamodb describe-table --table-name cv-analytics-analytics --profile cv-analytics --query "Table.TableSizeBytes"

# Check RCU/WCU consumption (if provisioned)
aws cloudwatch get-metric-statistics `
  --namespace AWS/DynamoDB `
  --metric-name ConsumedReadCapacityUnits `
  --dimensions Name=TableName,Value=cv-analytics-query-events `
  --start-time (Get-Date).AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 86400 `
  --statistics Average,Maximum `
  --profile cv-analytics
```

**3. Verify TTL Cleanup**

```powershell
# Check TTL status on query_events (7 day retention)
aws dynamodb describe-time-to-live --table-name cv-analytics-query-events --profile cv-analytics

# Check old records are being deleted
aws dynamodb scan --table-name cv-analytics-query-events --profile cv-analytics --limit 5 --query "Items[*].timestamp.N"
```

**4. Test Alarm Notifications**

```powershell
# Set alarm to ALARM state manually (for testing)
aws cloudwatch set-alarm-state `
  --alarm-name cv-analytics-dlq-depth `
  --state-value ALARM `
  --state-reason "Manual test of notification system" `
  --profile cv-analytics

# Verify email received
# Reset to OK
aws cloudwatch set-alarm-state `
  --alarm-name cv-analytics-dlq-depth `
  --state-value OK `
  --state-reason "Test complete" `
  --profile cv-analytics
```

### Quarterly Tasks

**1. Review IAM Permissions**

```powershell
# Check deployer user permissions
aws iam get-user-policy --user-name cv-analytics-deployer --policy-name cv-analytics-deploy-policy --profile admin

# Check Lambda role permissions
aws iam get-role-policy --role-name cv-analytics-lambda-role --policy-name cv-analytics-lambda-policy --profile cv-analytics
```

**2. Update Dependencies**

```powershell
# Update Lambda dependencies
cd d:\Code\MyCV\cv-analytics-infrastructure\lambda\processor
npm outdated
npm update
npm audit fix

cd ..\reporter
npm outdated
npm update
npm audit fix

# Rebuild and redeploy
npm run build
cd ..\..\terraform
terraform apply
```

**3. Review and Archive Old Analytics Data**

```powershell
# Export analytics data older than 90 days (if needed for long-term storage)
aws dynamodb scan --table-name cv-analytics-analytics --profile cv-analytics --filter-expression "weekId < :cutoff" --expression-attribute-values '{":cutoff":{"S":"2025-W01"}}' > analytics-archive-2024.json

# Consider S3 archival for long-term retention
```

---

## Additional Resources

### Related Documentation
- [AWS Setup Steps](./AWS_SETUP_STEPS.md) - Initial deployment guide
- [Step H Completion Summary](./STEP_H_COMPLETION_SUMMARY.md) - Monitoring setup details
- [Terraform Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

### Useful AWS CLI Commands Reference

```powershell
# Quick health check
aws cloudwatch describe-alarms --alarm-names cv-analytics-dlq-depth cv-analytics-processor-errors --profile cv-analytics

# View Lambda logs (last 10 minutes)
aws logs tail /aws/lambda/cv-analytics-processor --since 10m --profile cv-analytics

# Count recent events in DynamoDB
aws dynamodb scan --table-name cv-analytics-query-events --select COUNT --profile cv-analytics

# Check SQS queue depth
aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo --attribute-names ApproximateNumberOfMessages --profile cv-analytics

# Get Terraform outputs
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform && terraform output
```

### Support Contacts
- **Primary**: Jose Alvarez (contact@{YOUR_DOMAIN})
- **AWS Support**: Enterprise Support Plan (if applicable)
- **Cloudflare Support**: Dashboard → Support

---

## Document Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-03 | 1.0 | Initial runbook creation | Jose Alvarez |

---

**End of Runbook**
