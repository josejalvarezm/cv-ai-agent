# Step F: ACTION PLAN — Configure & Deploy

**Status**: 🟡 **Ready for Configuration**  
**Estimated Time**: 15 minutes  

---

## 🎯 What You Need To Do RIGHT NOW

### Task 1: Get AWS Credentials (5 min)

You need the access key and secret for `cv-analytics-deployer` IAM user.

**Option A: Retrieve saved credentials from Step A**
- Where you stored: `AccessKeyId` and `SecretAccessKey` from Step A.5

**Option B: Create new credentials**
```powershell
# Using admin profile from Step A
aws iam create-access-key `
  --user-name cv-analytics-deployer `
  --profile admin

# Save the output: AccessKeyId and SecretAccessKey
```

---

### Task 2: Set Wrangler Secrets (5 min)

```powershell
cd d:\Code\MyCV\cv-ai-agent

# Secret 1: SQS Queue URL
wrangler secret put AWS_SQS_URL
# Paste this value:
# https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo
# Then press Enter and Ctrl+D to save

# Secret 2: AWS Region
wrangler secret put AWS_REGION
# Paste: us-east-1

# Secret 3: Access Key ID
wrangler secret put AWS_ACCESS_KEY_ID
# Paste: Your AccessKeyId from above

# Secret 4: Secret Access Key  
wrangler secret put AWS_SECRET_ACCESS_KEY
# Paste: Your SecretAccessKey from above

# Verify all secrets are set
wrangler secret list
```

**Expected output** from `wrangler secret list`:
```
AWS_SQS_URL
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

---

### Task 3: Deploy to Cloudflare (3 min)

```powershell
cd d:\Code\MyCV\cv-ai-agent

# Build and deploy
wrangler deploy

# Or if you prefer explicit steps:
npm run build
wrangler deploy
```

**Watch for output** like:
```
✓ Deployed to https://cv-ai-agent-public.josejalvarez.dev
```

---

### Task 4: Quick Smoke Test (2 min)

Test that the integration works:

```powershell
# Test query
Invoke-WebRequest `
  -Uri "https://cv-ai-agent-public.josejalvarez.dev/api/search?q=TypeScript" `
  -Method Get

# Check SQS queue received the message
aws sqs get-queue-attributes `
  --queue-url https://sqs.us-east-1.amazonaws.com/{AWS_ACCOUNT_ID}/cv-analytics-queue.fifo `
  --attribute-names ApproximateNumberOfMessages `
  --profile cv-analytics

# Should show: "ApproximateNumberOfMessages": "1" (or more if testing multiple times)
```

---

## ✅ Step F Completion Criteria

- [ ] AWS credentials obtained
- [ ] All 4 Wrangler secrets set
- [ ] `wrangler secret list` shows all 4 secrets
- [ ] `wrangler deploy` successful
- [ ] Test query sent to chatbot
- [ ] SQS queue shows received messages

---

## 📋 If Something Goes Wrong

### Error: "Wrangler secret not found"
```powershell
# Check what secrets are actually set
wrangler secret list

# If empty, secrets didn't save. Try again:
wrangler secret put AWS_SQS_URL
# And paste the value carefully, then press Ctrl+D
```

### Error: "Failed to authenticate with SQS"
```powershell
# Verify AWS credentials work
aws sts get-caller-identity --profile cv-analytics

# If that works, verify the deployer user:
aws iam get-user --user-name cv-analytics-deployer --profile admin

# If that works, verify the user has SQS permissions:
aws iam get-user-policy `
  --user-name cv-analytics-deployer `
  --policy-name cv-analytics-deploy-policy `
  --profile admin
```

### Error: "Queue URL not found or access denied"
```powershell
# Verify the queue exists
aws sqs list-queues `
  --region us-east-1 `
  --profile cv-analytics

# Should show cv-analytics-queue.fifo in output
```

---

## 📞 Need Help?

Refer to: `STEP_F_CLOUDFLARE_INTEGRATION_COMPLETE.md` for full troubleshooting

---

## What Happens Next (Step G & Beyond)

After Step F deployment:

**Step G**: Integration Testing
- Send queries, verify SQS messages
- Verify Processor Lambda processes them
- Check DynamoDB stores the data
- Test Reporter Lambda emails

**Step H**: Monitoring
- Set up CloudWatch alarms
- Test alert notifications

**Step I**: Documentation
- Create runbook for operations

**Step J**: Cost Optimization
- Review monthly costs
- Enable billing alerts

---

## 🚀 Ready? Start with Task 1!

Get those AWS credentials and let's get this deployed! ✅
