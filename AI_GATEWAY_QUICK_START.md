# 🚀 Quick Start: AI Gateway Analytics

This guide will get you up and running with AI Gateway analytics in **under 30 minutes**.

---

## ✅ What You'll Get

- **Hourly breakdown** of AI model usage
- **Token tracking** (input and output separately)
- **Cost monitoring** in USD
- **Cache hit rates** to optimize performance
- **Error tracking** for reliability insights
- **Exportable data** (JSON/CSV) for further analysis

---

## 📋 Prerequisites

- ✅ Cloudflare account with Workers AI access
- ✅ Node.js 18+ installed
- ✅ Existing CV Assistant worker deployed

---

## 🎯 Step 1: Install Dependencies (2 minutes)

```bash
npm install
```

That's it! Dependencies are already configured in `package.json`.

---

## 🎯 Step 2: Set Up AI Gateway (10 minutes)

### 2.1: Create Gateway in Cloudflare Dashboard

1. Open: https://dash.cloudflare.com
2. Navigate: **AI** → **AI Gateway**
3. Click: **Create Gateway**
4. Configure:
   - **Name:** `cv-assistant-gateway`
   - **Rate Limiting:** Leave default or customize
   - **Caching:** ✅ Enable (recommended for cost savings)
   - **Logging:** ✅ Enable (required for analytics)
5. Click: **Create**

**Result:** You'll get a gateway URL like:
```
https://gateway.ai.cloudflare.com/v1/{account_id}/cv-assistant-gateway
```

### 2.2: Get Your Account ID

**Option A - From Wrangler:**
```bash
npx wrangler whoami
```

**Option B - From Dashboard:**
1. Dashboard → **Workers & Pages**
2. Right sidebar → **Account ID**
3. Copy the ID

### 2.3: Create API Token

1. Dashboard → **My Profile** → **API Tokens**
2. Click: **Create Token**
3. Use template: **Read Analytics** (or create custom)
4. Permissions required:
   - ✅ **Account** → **Analytics** → **Read**
   - ✅ **Account** → **AI Gateway** → **Read**
5. Account Resources: **Include** → Your account
6. Click: **Create Token**
7. **Copy the token immediately** (you won't see it again!)

---

## 🎯 Step 3: Configure Environment (3 minutes)

### 3.1: Create .env File

```bash
cp .env.example .env
```

### 3.2: Add Your Credentials

Edit `.env` and replace placeholders:

```bash
# Your API token from Step 2.3
CLOUDFLARE_API_TOKEN=cloudflare_token_abc123xyz...

# Your account ID from Step 2.2
ACCOUNT_ID=abc123def456...

# Gateway name from Step 2.1 (default: cv-assistant-gateway)
GATEWAY_NAME=cv-assistant-gateway
```

**⚠️ Important:** Never commit `.env` to Git! It's already in `.gitignore`.

---

## 🎯 Step 4: Update Worker Code (5 minutes)

### Option A: Simple Gateway Integration (Recommended)

Update `src/query-d1-vectors.ts` at line ~520 where you call the AI model:

**BEFORE:**
```typescript
const response = await env.AI.run(
  '@cf/meta/llama-3.1-70b-instruct',
  {
    messages: [...],
    max_tokens: 100
  }
);
```

**AFTER:**
```typescript
const response = await env.AI.run(
  '@cf/meta/llama-3.1-70b-instruct',
  {
    messages: [...],
    max_tokens: 100,
    gateway: {
      id: 'cv-assistant-gateway',  // Your gateway name
      skipCache: false,             // Enable caching
      cacheTtl: 3600               // Cache for 1 hour
    }
  }
);
```

That's it! Just add the `gateway` parameter to your existing AI.run() call.

### Deploy Updated Worker

```bash
# Test in development first
npx wrangler deploy --env development

# Then production
npx wrangler deploy --env production
```

---

## 🎯 Step 5: Test & Validate (5 minutes)

### 5.1: Generate Some Traffic

Run a few test queries:

```bash
# Test query 1
curl https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/query \
  -H "Content-Type: application/json" \
  -d '{"question":"what you know about wpf?"}'

# Test query 2
curl https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/query \
  -H "Content-Type: application/json" \
  -d '{"question":"tell me about your cloud experience"}'

# Test query 3
curl https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/query \
  -H "Content-Type: application/json" \
  -d '{"question":"what databases have you worked with?"}'
```

### 5.2: Verify Gateway Logs

1. Dashboard → **AI** → **AI Gateway** → **cv-assistant-gateway**
2. Click **Logs** tab
3. You should see your test requests appearing

**⚠️ Note:** Logs may take 2-5 minutes to appear

### 5.3: Run Analytics Script

Wait 5-10 minutes for analytics to populate, then:

```bash
npm run analytics:today
```

**Expected Output:**

```
═══════════════════════════════════════════════════════════
  🚀 Cloudflare AI Gateway Analytics
═══════════════════════════════════════════════════════════

🔍 Fetching AI Gateway analytics...
   Account: abc123def456...
   Gateway: cv-assistant-gateway
   Period: today (2025-10-18T00:00:00.000Z to 2025-10-18T15:30:00.000Z)

┌──────────────────┬────────────────────────┬──────────┬──────────┬───────────┬────────┬───────────┬───────────┬────────────┐
│ Hour (UTC)       │ Model                  │ Requests │ Tokens In│ Tokens Out│ Errors │ Cache Hits│ Cache Miss│ Cost (USD) │
├──────────────────┼────────────────────────┼──────────┼──────────┼───────────┼────────┼───────────┼───────────┼────────────┤
│ 2025-10-18 15:00 │ llama-3.1-70b          │ 3        │ 600      │ 300       │ 0      │ 0 (0.0%)  │ 3         │ $0.0012    │
│ 2025-10-18 14:00 │ llama-3.1-70b          │ 5        │ 1,000    │ 500       │ 0      │ 2 (40.0%) │ 3         │ $0.0020    │
├──────────────────┼────────────────────────┼──────────┼──────────┼───────────┼────────┼───────────┼───────────┼────────────┤
│                  │                 TOTALS │ 8        │ 1,600    │ 800       │ 0      │ 2 (25.0%) │ 6         │ $0.0032    │
└──────────────────┴────────────────────────┴──────────┴──────────┴───────────┴────────┴───────────┴───────────┴────────────┘

📈 Summary
────────────────────────────────────────────────────────────
Total Requests:        8
Total Tokens:          2,400 (1,600 in, 800 out)
Avg Tokens/Request:    300.0
Total Errors:          0 (0.00%)
Cache Hit Rate:        25.0% (2 hits, 6 misses)
Total Cost:            $0.0032
Models Used:           1 (@cf/meta/llama-3.1-70b-instruct)
────────────────────────────────────────────────────────────

✅ Done!
```

---

## 🎯 Usage Examples

### Daily Summary
```bash
npm run analytics:today
```

### Weekly Report
```bash
npm run analytics:week
```

### Monthly Analysis
```bash
npm run analytics:month
```

### Export to JSON
```bash
npm run analytics:export
# Creates: ai-analytics-2025-10-18.json
```

### Export to CSV
```bash
npm run analytics:csv
# Creates: ai-analytics-2025-10-18.csv
```

### Custom Period with Export
```bash
node scripts/fetch-ai-analytics.js --week --export --csv
```

---

## 🎉 Success Checklist

- ✅ AI Gateway created and configured
- ✅ API token created with Analytics:Read permission
- ✅ .env file configured with credentials
- ✅ Worker updated with gateway parameter
- ✅ Worker deployed to production
- ✅ Test queries sent through gateway
- ✅ Gateway logs showing requests
- ✅ Analytics script fetching data successfully
- ✅ Table displaying hourly metrics

---

## 💡 Tips & Best Practices

### Caching Strategy

Enable caching to reduce costs:
```typescript
gateway: {
  id: 'cv-assistant-gateway',
  skipCache: false,      // Enable caching
  cacheTtl: 3600        // 1 hour (adjust based on needs)
}
```

**Benefits:**
- Identical queries return cached responses (0 neurons!)
- Reduces AI model inference costs by 20-50%
- Faster response times for repeated questions

**When to skip cache:**
- User-specific queries
- Real-time data requirements
- Privacy-sensitive queries

### Monitoring Schedule

Set up automated monitoring:

**Option A: Daily Cron Job**
```bash
# Add to crontab (runs daily at 9 AM)
0 9 * * * cd /path/to/project && npm run analytics:export >> logs/analytics.log 2>&1
```

**Option B: GitHub Actions (Weekly Report)**
```yaml
# .github/workflows/analytics.yml
name: Weekly Analytics Report
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run analytics:week --export
      - uses: actions/upload-artifact@v3
        with:
          name: analytics-report
          path: ai-analytics-*.json
```

### Cost Tracking

Monitor your spending:
```bash
# Check daily costs
npm run analytics:today | grep "Total Cost"

# Weekly trends
npm run analytics:week --export
# Then open CSV in Excel/Google Sheets for charts
```

### Alerting Thresholds

Set up alerts for:
- **Cost spike:** >$1.00/day (unexpected usage)
- **Error rate:** >5% (system issues)
- **Cache hit rate:** <20% (optimization opportunity)
- **Token usage:** >10,000 tokens/day (quota approaching)

---

## 🐛 Troubleshooting

### "No analytics data found"

**Causes:**
1. Analytics delay (wait 10-15 minutes after first request)
2. Gateway not receiving requests (check logs)
3. Wrong gateway name in .env

**Solution:**
```bash
# Verify gateway name matches
echo $GATEWAY_NAME  # Should match dashboard gateway name

# Check gateway logs in dashboard
# AI → AI Gateway → Your Gateway → Logs
```

### "401 Unauthorized"

**Cause:** Invalid API token

**Solution:**
```bash
# Verify token in .env is correct
cat .env | grep CLOUDFLARE_API_TOKEN

# Regenerate token if needed (Step 2.3)
```

### "403 Forbidden"

**Cause:** Missing Analytics:Read permission

**Solution:**
- Recreate token with correct permissions (Step 2.3)
- Ensure **Account:Analytics:Read** is checked

### Script Errors

**Module not found:**
```bash
# Reinstall dependencies
npm install
```

**Syntax errors:**
```bash
# Ensure Node.js 18+
node --version
```

---

## 📚 Next Steps

1. ✅ **Set up daily exports** to track trends over time
2. ✅ **Create cost dashboard** with Chart.js or Google Sheets
3. ✅ **Enable caching** to reduce costs by 20-50%
4. ✅ **Set up alerting** for quota limits and errors
5. ✅ **Optimize prompts** based on token usage data

---

## 🔗 Resources

- [AI Gateway Documentation](https://developers.cloudflare.com/ai-gateway/)
- [GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Full Roadmap](./AI_GATEWAY_ANALYTICS_ROADMAP.md)

---

## 🎯 Total Time: ~25 minutes

- Step 1: 2 min (Install dependencies)
- Step 2: 10 min (Gateway setup)
- Step 3: 3 min (Environment config)
- Step 4: 5 min (Update worker)
- Step 5: 5 min (Test & validate)

**Ready to start? Let's do this! 🚀**
