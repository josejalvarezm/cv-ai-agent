# AI Quota Management & Circuit Breaker

## Overview

The CV Assistant implements a **circuit breaker pattern** to manage Cloudflare Workers AI free tier limits (10,000 neurons/day).

## How It Works

### 1. **Quota Tracking**
- Every AI inference call is counted
- Counter is stored in KV with daily expiration (resets at midnight UTC)
- Limit set to **9,500** (500 safety margin below 10k)

### 2. **Circuit Breaker**
Before each AI call, the system checks:
```typescript
const { allowed, status } = await canUseAI(env.KV);

if (!allowed) {
  // Return friendly fallback message
  responseData.assistantReply = getQuotaExceededMessage(query, topResults);
} else {
  // Proceed with AI inference
  const aiResponse = await env.AI.run(...);
  await incrementQuota(env.KV); // Track usage
}
```

### 3. **Friendly Fallback**
When quota is exceeded, users see:
> "I've found highly relevant skills matching your query: [skill names]. However, I've reached my daily AI response limit (10,000 inferences). The system will reset at midnight UTC. In the meantime, you can review the detailed skill information provided above..."

## API Endpoints

### **GET `/quota`**
Check current quota status:
```json
{
  "date": "2025-10-16",
  "count": 1250,
  "limit": 9500,
  "remaining": 8250,
  "isExceeded": false,
  "resetAt": "2025-10-17T00:00:00.000Z"
}
```

### **GET `/health`**
Health check includes quota status:
```json
{
  "status": "healthy",
  "database": "connected",
  "total_skills": 64,
  "ai_quota": {
    "count": 1250,
    "remaining": 8250,
    "isExceeded": false
  }
}
```

### **POST `/quota/reset`** (Admin Only)
Manually reset quota counter:
```bash
curl -X POST https://cv-assistant-worker.your-subdomain.workers.dev/quota/reset
```

⚠️ **Note:** This endpoint should be protected with authentication in production.

## Benefits

1. **Cost Control**: Prevents unexpected overages beyond free tier
2. **Graceful Degradation**: System continues to work, just without AI-generated responses
3. **User Transparency**: Users know why AI responses are unavailable
4. **Automatic Recovery**: Resets daily at midnight UTC
5. **Monitoring**: Easy to track usage via `/quota` endpoint

## Configuration

Located in `src/ai-quota.ts`:

```typescript
const DAILY_QUOTA_LIMIT = 9500; // Adjust as needed
```

## Monitoring Commands

```bash
# Check current quota
npm run health

# Manual reset (if needed)
curl -X POST https://your-worker.workers.dev/quota/reset

# Watch quota during testing
watch -n 5 'curl -s https://your-worker.workers.dev/quota | jq'
```

## Future Enhancements

1. **Rate limiting per user** (using JWT session IDs)
2. **Different quota tiers** for authenticated vs anonymous users
3. **Alerting** when quota reaches 80% threshold
4. **Analytics dashboard** for quota usage patterns
5. **Graceful upgrade prompt** when consistently hitting limits

## Testing the Circuit Breaker

To test, you can temporarily lower the limit:

```typescript
// In src/ai-quota.ts
const DAILY_QUOTA_LIMIT = 5; // Set low for testing
```

Then make several queries and observe:
- First 5 queries: AI responses
- Query 6+: Friendly fallback messages

## Deployment

Already deployed in version: `f9007ac6-bb34-418d-af24-ac9b9e2488c3`

Status: ✅ **ACTIVE**
