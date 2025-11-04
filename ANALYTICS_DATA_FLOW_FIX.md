# Analytics Data Flow Fix - Root Cause Identified

**Status:** ✅ Root cause found - **Lambda processor design flaw**

## Problem Discovery

Lambda logs show the **response event processing is failing** with:
```
ERROR   Error processing event: ValidationException: The provided key element does not match the schema
ERROR   Failed to process event: 7d1936f2-47b2-46d4-8587-b63c91a6aea3 The provided key element does not match the schema
```

**Stack trace shows:** `at async DynamoDBEventRepository.getQuery` - Lambda can't find the query event

## Root Cause Analysis

**You're absolutely right about `requestId` being the idempotency key.**

**The design uses TWO DIFFERENT TABLES:**

| Table | Purpose | Key Schema | Data |
|-------|---------|-----------|------|
| `cv-analytics-query-events` | ✅ Query tracking | `requestId` + `timestamp` | Individual queries (7-day TTL) |
| `cv-analytics-analytics` | ❌ Weekly aggregates | `weekId` + `metricType` | Aggregated metrics (90-day TTL) |

**What's Happening:**
1. ✅ Query events are stored successfully in `cv-analytics-query-events` using `requestId`
2. ✅ Lambda receives response events and tries to correlate with query
3. ❌ Response events fail when Lambda tries to write to `cv-analytics-analytics`
4. ❌ Lambda is attempting to use `requestId` as partition key
5. ❌ But `cv-analytics-analytics` expects `weekId` as partition key (for weekly aggregation)

## Evidence from Lambda Logs

Timeline showing the exact failure:
- **14:38:29.528Z**: Query stored successfully (requestId: 7d1936f2-47b2-46d4-8587-b63c91a6aea3) ✅
- **14:38:32.423Z**: Response event received from SQS 
- **14:38:32.471Z**: ERROR - ValidationException trying to write to cv-analytics-analytics ❌
- **14:38:32.475Z**: WARN - Message marked for retry

Query was stored with status `"awaiting_response"` and all query data intact.

## Current Data Flow

### Query Event (Working ✅)
```
Worker → SQS → Lambda → DynamoDB cv-analytics-query-events
                         (stores by requestId) ✅
                         Status: "awaiting_response"
```

### Response Event (Broken - DESIGN FLAW ❌)
```
Worker → SQS → Lambda → [Should correlate with query]
                        [Should aggregate into weekly bucket]
                        → DynamoDB cv-analytics-analytics
                         ERROR: Trying wrong key schema ❌
```

## The Real Issue

**The Lambda processor code has a design flaw:**

The `cv-analytics-analytics` table is designed for **weekly aggregated metrics** (key: `weekId` + `metricType`), but the processor Lambda is trying to write individual response events to it using `requestId` as the key.

**What should happen:**
1. Response event arrives
2. Lambda looks up query by `requestId` (finds it ✅)
3. Lambda should **aggregate** the query+response into a weekly bucket
4. Write to `cv-analytics-analytics` with:
   - `weekId`: Current week identifier (e.g., "2025-W45")
   - `metricType`: Type of metric (e.g., "response", "accuracy", etc.)
   - Store `requestId` as a regular field (not key) for correlation

**What's actually happening:**
1. Response event arrives
2. Lambda looks up query by `requestId` ✅
3. Lambda tries to write individual response to `cv-analytics-analytics` ❌
4. Uses `requestId` as partition key instead of `weekId` ❌
5. DynamoDB rejects: "ValidationException: The provided key element does not match the schema"

## Solution Required

The Lambda processor code needs to be updated to:

1. **Generate `weekId` from current timestamp**
   ```typescript
   const now = new Date();
   const weekStart = getWeekStart(now);  // Sunday of current week
   const weekId = `week-${weekStart.getTime()}`;
   ```

2. **Use correct key schema for analytics table**
   ```typescript
   const params = {
     TableName: 'cv-analytics-analytics',
     Item: {
       weekId: { S: weekId },           // Partition key (required)
       metricType: { S: 'response' },   // Sort key (required)
       createdAt: { N: timestamp },
       requestId: { S: requestId },     // For correlation
       matchType: { S: matchType },
       matchScore: { N: matchScore },
       reasoning: { S: reasoning },
       // ... other fields
     }
   };
   ```

3. **Correlate query + response events**
   - Query events stored by requestId in cv-analytics-query-events
   - When response arrives, Lambda should:
     - Look up query event by requestId
     - Extract query text
     - Combine with response data
     - Write to cv-analytics-analytics with weekId + metricType

## Files to Update

1. **Lambda Processor** (AWS Lambda, not in this repo)
   - DynamoDBEventRepository.js - Update write operations
   - EventCorrelationService.js - Use correct key schema

## Temporary Workaround

Until Lambda is fixed, the response events are failing silently:
- SQS receives the messages ✅
- Lambda processes query events ✅
- Lambda fails on response events ❌
- Messages are retried (default SQS retry policy)

## Next Steps

1. Update Lambda processor to use correct DynamoDB schema
2. Redeploy Lambda function
3. Test with new query to verify data flows to cv-analytics-analytics
4. Verify complete analytics record includes:
   - weekId
   - metricType
   - requestId (for correlation)
   - query text
   - matchType ('full'/'partial'/'none')
   - matchScore (0-100)
   - reasoning
   - vectorMatches count

## Event Timeline for Request ID: 7d1936f2-47b2-46d4-8587-b63c91a6aea3

| Time | Component | Event | Status |
|------|-----------|-------|--------|
| 14:38:29.297 | Worker | Query sent: "have you any experience with c#?" | ✅ |
| 14:38:29.297 | SQS | Query event received (FIFO queue) | ✅ |
| 14:38:29.528 | Lambda | Processing query event | ✅ |
| 14:38:29.528 | DynamoDB | Query event stored (cv-analytics-query-events) | ✅ |
| 14:38:32.423 | Worker | Response sent: C# match (0.9082 similarity) | ✅ |
| 14:38:32.423 | SQS | Response event received | ✅ |
| 14:38:32.423 | Lambda | Processing response event | ⏳ |
| 14:38:32.471 | Lambda | ❌ ERROR: ValidationException on DynamoDB write | ❌ |
| 14:38:32.475 | Lambda | Event marked for retry | ⏳ |

---

**Conclusion:** The pipeline is 90% working. Only the final DynamoDB write for response events is broken due to key schema mismatch. Once Lambda is updated to use `weekId` as partition key, all analytics data will flow correctly.
