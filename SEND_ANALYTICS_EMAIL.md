# 📧 How to Send Analytics Email Report

Your project has a complete **AWS Lambda-based email reporting system** that generates and sends weekly analytics via AWS SES.

---

## 🚀 Quick Start

### Option 1: Manual Lambda Invocation (Immediate)

Trigger the reporter Lambda manually to send a report immediately:

```bash
# Invoke the reporter Lambda
aws lambda invoke \
  --function-name cv-analytics-reporter-production \
  --region eu-west-2 \
  response.json

# View response
cat response.json
```

**What happens:**
1. Lambda queries DynamoDB for analytics from the last week
2. Aggregates statistics (queries, tokens, costs, performance)
3. Generates beautiful HTML email
4. Sends via AWS SES to configured recipient
5. Email arrives in inbox (~1-2 minutes)

---

### Option 2: Scheduled (Automatic - Already Set Up)

Your **EventBridge rule** automatically triggers every Monday at 9 AM UTC:

```
cron(0 9 ? * MON *)
```

**This means:**
- ✅ Every Monday morning → Report is automatically sent
- ✅ No manual action needed
- ✅ Email covers previous week's analytics
- ✅ Already configured and deployed

---

## 📊 What the Email Contains

### Sections in the Analytics Report:

1. **📈 Overview**
   - Total queries last week
   - Unique sessions/users
   - Average response time
   - Cache hit rate

2. **💰 Cost Analysis**
   - Total tokens used
   - Estimated cost in £ (British pounds)
   - Breakdown by LLM model used

3. **⚡ Performance Metrics**
   - Min/Max response times
   - P50, P95, P99 percentiles
   - Performance trends

4. **🔥 Top Queries**
   - Most frequently asked questions
   - How many times asked
   - Match quality scores

5. **📚 Top Sources**
   - Most referenced CV sections
   - How many times cited

---

## 🔧 Configuration

### Current Setup

```
Recipient Email:  ${{ secrets.ANALYTICS_EMAIL }}  (from GitHub secrets)
Sender Email:     noreply@{YOUR_DOMAIN}         (AWS SES verified)
Region:           eu-west-2                        (London)
Schedule:         Monday 9 AM UTC                  (automatic)
```

### Change Recipient Email

To send reports to a different email address:

**Option A: GitHub Secrets (Recommended)**
```bash
# Update in GitHub: Settings → Secrets → ANALYTICS_EMAIL
# Then redeploy via GitHub Actions
```

**Option B: AWS Parameter Store**
```bash
aws ssm put-parameter \
  --name /cv-analytics/recipient-email \
  --value "new-email@example.com" \
  --overwrite \
  --region eu-west-2
```

### Change Schedule

Edit `cv-analytics-reporter/infrastructure/lambda.yaml`:

```yaml
# Change this line:
ScheduleExpression: 'cron(0 9 ? * MON *)'

# Examples:
# Daily 9 AM:         'cron(0 9 ? * * *)'
# Every 6 hours:      'cron(0 */6 ? * * *)'
# Tuesday 10 AM:      'cron(0 10 ? * TUE *)'
# Monday 14:00 UTC:   'cron(0 14 ? * MON *)'
```

Then redeploy:
```bash
cd cv-analytics-reporter
npm run build
npm run deploy
```

---

## 📧 Verify Email Setup

### Check SES Sender Email is Verified

```bash
# List verified emails in SES
aws ses list-verified-email-addresses --region eu-west-2

# Should show:
# "VerifiedEmailAddresses": [
#   "noreply@{YOUR_DOMAIN}"
# ]
```

### If NOT verified, verify it:

```bash
# Request verification
aws ses verify-email-identity \
  --email-address noreply@{YOUR_DOMAIN} \
  --region eu-west-2

# Then check your email for verification link
# Click the link to complete verification
```

---

## 🧪 Test Email Delivery

### Send Test Email Manually

```bash
# Send simple test email
aws ses send-email \
  --from noreply@{YOUR_DOMAIN} \
  --destination ToAddresses=your-email@example.com \
  --message Subject={Data="Test",Charset=UTF-8},Body={Text={Data="Test from cv-analytics",Charset=UTF-8}} \
  --region eu-west-2
```

### Full Lambda Test with Mock Data

```bash
# Invoke Lambda (will generate report from real DynamoDB data)
aws lambda invoke \
  --function-name cv-analytics-reporter-production \
  --region eu-west-2 \
  response.json

# Check if successful
cat response.json
# Should show: { "statusCode": 200, "body": "Report sent successfully" }
```

### Check CloudWatch Logs

```bash
# View Lambda execution logs
aws logs tail /aws/lambda/cv-analytics-reporter-production --follow

# Should show:
# [INFO] Querying analytics for week 2025-W45
# [INFO] Aggregating statistics...
# [INFO] Generating HTML report...
# [INFO] Sending email to: your-email@example.com
# [INFO] Email sent successfully. MessageId: ...
```

---

## 🔐 Troubleshooting

### Problem: "Email not verified"

**Error:**
```
MessageRejected: Email address not verified
```

**Solution:**
```bash
# Verify the sender email
aws ses verify-email-identity \
  --email-address noreply@{YOUR_DOMAIN} \
  --region eu-west-2
```

### Problem: "Email not received"

**Diagnosis:**
1. Check spam folder
2. Check CloudWatch logs for errors
3. Verify recipient email is correct
4. Make sure SES is not in sandbox mode

**Check SES Account Status:**
```bash
aws ses get-account-sending-enabled --region eu-west-2
```

### Problem: "No data in report (empty stats)"

**Cause:** Analytics pipeline not running or no queries last week

**Solution:**
```bash
# Check if processor is running
aws logs tail /aws/lambda/cv-analytics-processor-production

# Check if data exists in DynamoDB
aws dynamodb scan \
  --table-name cv-analytics-production \
  --limit 5 \
  --region eu-west-2
```

---

## 💡 Advanced: Manually Trigger Report Generation

### Generate Report Without Sending Email

```bash
# In cv-analytics-reporter directory
cd d:\Code\MyCV\cv-analytics-reporter

# Build
npm run build

# Run locally (requires AWS credentials)
npm run build && node dist/index.js
```

### With Specific Week

Modify `src/index.ts` to specify a week:

```typescript
// In Lambda handler, change from:
const currentWeek = getCurrentWeek(); // This week

// To:
const currentWeek = '2025-W43'; // Specific week
```

---

## 📋 Full Email Deployment

If you need to modify the reporter or redeploy:

```bash
cd d:\Code\MyCV\cv-analytics-reporter

# Build
npm run build

# Test locally
npm run test

# Deploy to AWS
npm run deploy

# Or via PowerShell with parameters:
.\scripts\deploy.ps1 `
  -Environment production `
  -RecipientEmail "your-email@example.com" `
  -SenderEmail "noreply@{YOUR_DOMAIN}" `
  -Region eu-west-2
```

---

## 🎯 Your Analytics Email Pipeline

```
┌─────────────────────────────────────────────────────┐
│           Your CV Chatbot Activity                   │
│  (queries, responses, cache hits, token usage)       │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  Analytics Events   │
        │  (SQS Queue)        │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │  Processor Lambda   │
        │  (Correlate events) │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │  DynamoDB          │
        │  (Store analytics) │
        └──────────┬──────────┘
                   │
     ┌─────────────┴─────────────┐
     │                           │
┌────▼────────────┐   ┌─────────▼──────────┐
│ EventBridge     │   │ Manual Invocation  │
│ (Mon 9 AM UTC)  │   │ (Any time)        │
└────┬────────────┘   └─────────┬──────────┘
     │                          │
     └──────────┬───────────────┘
                │
     ┌──────────▼──────────┐
     │ Reporter Lambda    │
     │ (Generate report)  │
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │ AWS SES             │
     │ (Send email)        │
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │ Your Inbox ✉️        │
     │ Beautiful report!   │
     └─────────────────────┘
```

---

## 📊 Example Email Report Content

```
CV CHATBOT WEEKLY ANALYTICS REPORT
==================================================

Week: 2025-W45
Period: 04 Nov 2025 - 10 Nov 2025

OVERVIEW
--------------------------------------------------
Total Queries: 1,248
Unique Sessions: 347
Average Response Time: 142ms
Cache Hit Rate: 82.3%

COST ANALYSIS
--------------------------------------------------
Total Tokens Used: 425,600
Estimated Cost: £2.34

LLM Usage Breakdown:
  GPT-4: 156 requests, 125,400 tokens, £0.89
  GPT-3.5: 1,092 requests, 300,200 tokens, £1.45

PERFORMANCE METRICS
--------------------------------------------------
Min: 45ms
Max: 2,100ms
Median (P50): 128ms
P95: 450ms
P99: 1,800ms

TOP 10 QUERIES
--------------------------------------------------
1. what are you skilled at? (45x)
2. tell me about your experience (38x)
3. what programming languages do you know (32x)
...

TOP SOURCES USED
--------------------------------------------------
1. Projects: 156 times
2. Experience: 142 times
3. Skills: 98 times
...
```

---

## 🎯 Right Now: Send an Analytics Email

**Choose one:**

### **Option 1: Immediate (Recommended)** 🟢

```bash
# This will send an email right now with last week's analytics
aws lambda invoke \
  --function-name cv-analytics-reporter-production \
  --region eu-west-2 \
  response.json

# Check inbox for email (~1-2 minutes)
```

### **Option 2: Wait for Monday 9 AM UTC**

The scheduled report will automatically send Monday morning.

---

**Email is set up and ready! Just invoke Lambda or wait for the scheduled time.** 📧✨
