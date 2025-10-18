# AI Gateway Analytics Implementation Roadmap

## 📋 Overview

Implement comprehensive Workers AI analytics using Cloudflare AI Gateway and GraphQL API.

**Goal:** Track neuron usage, requests, tokens, errors, and cache hits with hourly granularity.

---

## 🎯 Phase 1: AI Gateway Setup (15-20 minutes)

### Step 1.1: Create AI Gateway in Cloudflare Dashboard

1. Log in to Cloudflare Dashboard
2. Navigate to **AI** → **AI Gateway**
3. Click **Create Gateway**
4. Configure:
   - **Gateway Name:** `cv-assistant-gateway` (or your choice)
   - **Rate Limiting:** Optional (can set request limits)
   - **Caching:** Enable for cost savings (caches identical requests)
   - **Logging:** Enable (required for analytics)

**Expected Result:** Gateway endpoint URL like:
```
https://gateway.ai.cloudflare.com/v1/{account_id}/cv-assistant-gateway
```

### Step 1.2: Get Your Account ID

```bash
# From wrangler
npx wrangler whoami

# Or from Cloudflare Dashboard
# Dashboard → Workers & Pages → Overview → Account ID (right sidebar)
```

### Step 1.3: Create API Token for Analytics

1. Dashboard → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use template: **Read Analytics**
4. Permissions:
   - **Account** → **Analytics** → **Read**
   - **Account** → **AI Gateway** → **Read**
5. Account Resources: **Include** → Your account
6. Copy token (save to `.env` file)

**Expected Result:** Token starting with `cloudflare_api_token_...`

---

## 🎯 Phase 2: Update Workers Code (10-15 minutes)

### Step 2.1: Update AI Calls to Use Gateway

**Current code** (direct Workers AI):
```typescript
const response = await env.AI.run(
  '@cf/meta/llama-3.1-70b-instruct',
  {
    messages: [...],
    max_tokens: 100
  }
);
```

**New code** (via AI Gateway):
```typescript
// Option A: Using AI Gateway with Workers AI binding
const response = await env.AI.run(
  '@cf/meta/llama-3.1-70b-instruct',
  {
    messages: [...],
    max_tokens: 100,
    gateway: {
      id: 'cv-assistant-gateway',
      skipCache: false,  // Enable caching
      cacheTtl: 3600     // Cache for 1 hour
    }
  }
);

// Option B: Using REST API directly through gateway
const response = await fetch(
  `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/cv-assistant-gateway/workers-ai/@cf/meta/llama-3.1-70b-instruct`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [...],
      max_tokens: 100
    })
  }
);
```

**Recommendation:** Use Option A (simpler, maintains existing code structure)

### Step 2.2: Update wrangler.toml

```toml
# Add account ID for gateway
[vars]
ACCOUNT_ID = "your_account_id_here"

# Optional: AI Gateway configuration
[ai.gateway]
id = "cv-assistant-gateway"
```

### Step 2.3: Update Environment Variables

Add to `.env` or Cloudflare dashboard secrets:
```bash
CLOUDFLARE_API_TOKEN=your_analytics_token_here
ACCOUNT_ID=your_account_id_here
GATEWAY_NAME=cv-assistant-gateway
```

---

## 🎯 Phase 3: Create Analytics Script (20-30 minutes)

### Step 3.1: Create Script File

Create `scripts/fetch-ai-analytics.js` with the following features:

**Features:**
- ✅ Query AI Gateway usage metrics
- ✅ Filter by account, gateway, model
- ✅ Group by datetime (hourly) and model
- ✅ Show requests, tokens (input/output), errors, cache hits
- ✅ Display as formatted table
- ✅ Export to CSV/JSON (optional)
- ✅ Error handling and retry logic

**GraphQL Query Structure:**
```graphql
query AIGatewayAnalytics($accountTag: string, $filter: filter) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      aiGatewayUsage(
        filter: $filter
        orderBy: [datetimeHour_DESC]
        limit: 1000
      ) {
        datetimeHour
        model
        requests
        tokensIn
        tokensOut
        errors
        cacheHits
        cacheMisses
        cost
      }
    }
  }
}
```

### Step 3.2: Install Dependencies

```bash
npm install --save-dev dotenv cli-table3
# node-fetch only if using Node < 18
```

### Step 3.3: Add NPM Script

Add to `package.json`:
```json
{
  "scripts": {
    "analytics": "node scripts/fetch-ai-analytics.js",
    "analytics:today": "node scripts/fetch-ai-analytics.js --today",
    "analytics:week": "node scripts/fetch-ai-analytics.js --week",
    "analytics:export": "node scripts/fetch-ai-analytics.js --export"
  }
}
```

---

## 🎯 Phase 4: Testing & Validation (10-15 minutes)

### Step 4.1: Deploy Updated Worker

```bash
# Deploy to development
npx wrangler deploy --env development

# Test a few queries
curl https://cv-assistant-worker-dev.{YOUR_WORKERS_SUBDOMAIN}/query \
  -H "Content-Type: application/json" \
  -d '{"question":"what you know about wpf?"}'

# Deploy to production
npx wrangler deploy --env production
```

### Step 4.2: Wait for Data (5-10 minutes)

Analytics data has a delay:
- **AI Gateway logs:** ~5 minutes
- **GraphQL API availability:** ~10 minutes
- **Hourly aggregation:** Up to 1 hour for complete data

### Step 4.3: Run Analytics Script

```bash
# Fetch today's metrics
npm run analytics:today

# Expected output:
# ┌────────────────────┬────────────────────────┬──────────┬──────────┬───────────┬────────┬───────────┐
# │ Hour               │ Model                  │ Requests │ Tokens In│ Tokens Out│ Errors │ Cache Hits│
# ├────────────────────┼────────────────────────┼──────────┼──────────┼───────────┼────────┼───────────┤
# │ 2025-10-18 14:00   │ llama-3.1-70b-instruct │ 12       │ 2,400    │ 1,200     │ 0      │ 3         │
# │ 2025-10-18 13:00   │ llama-3.1-70b-instruct │ 8        │ 1,600    │ 800       │ 0      │ 2         │
# └────────────────────┴────────────────────────┴──────────┴──────────┴───────────┴────────┴───────────┘
```

### Step 4.4: Validate Data

Compare analytics with your KV quota tracking:

```bash
# Check KV quota
curl https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/quota

# Compare:
# - KV neuronsUsed vs. GraphQL cost/neurons
# - KV inferenceCount vs. GraphQL requests
# - Verify numbers match (within ~5-10 minute delay)
```

---

## 🎯 Phase 5: Advanced Features (Optional)

### Option A: Automated Daily Reports

Create `scripts/daily-report.js`:
```javascript
// Email or Slack daily analytics summary
// Run via cron or GitHub Actions
```

### Option B: Cost Dashboard

Create simple web dashboard:
```typescript
// Fetch analytics API
// Display charts with Chart.js
// Show cost trends, model usage
```

### Option C: Alerting

```javascript
// Monitor for:
// - Quota approaching limit (>90%)
// - High error rates (>5%)
// - Unusual token usage spikes
```

---

## 📊 Expected Benefits

| Metric | Before | After |
|--------|--------|-------|
| **Visibility** | Daily totals only | Hourly granularity |
| **Tracking** | Manual checks | Automated collection |
| **Analytics** | Neuron count | Requests, tokens, errors, cache |
| **Export** | Manual copy/paste | CSV/JSON export |
| **Trends** | None | Historical analysis |
| **Cost Optimization** | Limited | Cache hit tracking |

---

## 🚧 Potential Issues & Solutions

### Issue 1: No Data in GraphQL API

**Symptoms:** Query returns empty results

**Causes:**
- Analytics delay (wait 10-15 minutes)
- Gateway not configured correctly
- Requests not routed through gateway

**Solution:**
```bash
# Verify gateway is receiving requests
# Dashboard → AI → AI Gateway → Your Gateway → Logs
# Should show recent requests
```

### Issue 2: Authentication Errors

**Symptoms:** 401 Unauthorized or 403 Forbidden

**Causes:**
- Invalid API token
- Missing Analytics:Read permission
- Token expired

**Solution:**
```bash
# Regenerate token with correct permissions
# Ensure token includes:
# - Account:Analytics:Read
# - Account:AI Gateway:Read
```

### Issue 3: Rate Limiting

**Symptoms:** 429 Too Many Requests

**Causes:**
- Too many API calls
- GraphQL query too large

**Solution:**
```javascript
// Add retry logic with exponential backoff
// Reduce query limit from 1000 to 100
// Cache results locally
```

### Issue 4: Data Mismatch

**Symptoms:** KV quota ≠ GraphQL metrics

**Causes:**
- Time zone differences (KV uses UTC, GraphQL uses account timezone)
- Analytics delay (~10 minutes)
- Different counting methods

**Solution:**
```javascript
// Always compare same time range
// Account for analytics delay
// Use UTC timestamps for consistency
```

---

## 🎯 Success Criteria

✅ **AI Gateway configured** with logging enabled
✅ **Worker updated** to route AI calls through gateway
✅ **Analytics script** fetches data successfully
✅ **Data validates** against KV quota tracking
✅ **Table output** displays readable metrics
✅ **Export works** (CSV/JSON) for further analysis

---

## 📚 Resources

- [Cloudflare AI Gateway Docs](https://developers.cloudflare.com/ai-gateway/)
- [GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/)
- [Workers AI Gateway Integration](https://developers.cloudflare.com/workers-ai/configuration/ai-gateway/)
- [API Token Permissions](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)

---

## ⏱️ Total Time Estimate

| Phase | Time | Complexity |
|-------|------|------------|
| Phase 1: Gateway Setup | 15-20 min | Easy |
| Phase 2: Update Workers | 10-15 min | Medium |
| Phase 3: Analytics Script | 20-30 min | Medium |
| Phase 4: Testing | 10-15 min | Easy |
| **Total** | **55-80 min** | **Medium** |

**Optional Advanced Features:** +30-60 minutes each

---

## 🚀 Next Steps

Ready to start? Here's what I'll create:

1. ✅ **scripts/fetch-ai-analytics.js** - Complete Node.js script
2. ✅ **Update src/query-d1-vectors.ts** - Add AI Gateway integration
3. ✅ **Update wrangler.toml** - Add gateway configuration
4. ✅ **.env.example** - Document required environment variables
5. ✅ **package.json** - Add analytics NPM scripts

Let me know if you want me to proceed with creating all files! 🎯
