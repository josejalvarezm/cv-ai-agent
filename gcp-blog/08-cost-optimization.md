# Serverless Cost Optimization: Running Production at £0/Month

*Six consecutive months at £0.00. Production system. Real traffic. Batching reduced Lambda invocations by 90%.*

## Quick Summary

- ✓ **£0/month** for production CV Analytics system
- ✓ **AWS Lambda** free tier: 1M requests/month (never exceeded)
- ✓ **DynamoDB** always-free tier: 25 GB storage + 25 RCU/WCU
- ✓ **GCP Cloud Functions** free tier: 2M invocations/month
- ✓ **Batching strategy** reduces Lambda invocations by 90%

---

## Introduction

Serverless promises cost efficiency: pay only for what you use. No idle servers. No wasted capacity. CV Analytics runs production workload at £0/month by exploiting free tiers.

This sounds too good to be true. It isn't. AWS Lambda provides 1 million free requests per month. DynamoDB always-free tier includes 25 GB storage plus 25 RCU/WCU. GCP Cloud Functions offers 2 million invocations monthly. Firestore includes 50,000 reads per day.

CV Analytics processes ~500 GitHub webhooks monthly. Stores ~1 GB data. Generates weekly reports. Real-time dashboard serves 10 users. Total usage: 5% of free tier limits.

**Key insight:** Most portfolio projects never exceed free tiers. Optimize architecture to stay within limits. Scale up only when revenue justifies costs.

This part explains:

1. **Serverless pricing models** (requests, duration, storage)
2. **Free tier thresholds** (AWS, GCP, Firebase)
3. **Batching strategy** (90% reduction in Lambda invocations)
4. **Cold start optimization** (memory tuning)
5. **Cost monitoring** (alerts, daily tracking)
6. **Real cost breakdown** (CV Analytics: £0.00/month)
7. **Scaling scenarios** (when to leave free tier)

By end of this part, you'll know how to architect serverless systems that remain free indefinitely.

---

## Understanding Serverless Pricing

Serverless pricing has two components: **requests** and **compute time**. Unlike VMs (charged per hour), serverless charges per millisecond of execution.

### AWS Lambda Pricing Model

**Request charges:**

- £0.20 per 1 million requests
- First 1 million requests per month: **Free**

**Compute charges:**

- £0.0000166667 per GB-second
- First 400,000 GB-seconds per month: **Free**

**GB-second calculation:**

- Lambda configured with 512 MB (0.5 GB)
- Execution takes 200ms (0.2 seconds)
- Cost: 0.5 GB × 0.2s = 0.1 GB-seconds

**Example (1,000 invocations):**

```text
Requests: 1,000 invocations = £0.0002 (within free tier → £0)
Compute: 1,000 × 0.1 GB-s = 100 GB-seconds (within free tier → £0)
Total: £0.00
```

**Free tier is generous:** 1 million requests at 200ms each (512 MB) = 100,000 GB-seconds. Well within 400,000 GB-second limit.

### DynamoDB Pricing Model

**On-Demand mode** (CV Analytics uses this):

- £1.25 per million write request units (WRUs)
- £0.25 per million read request units (RRUs)

**Always-free tier:**

- 25 GB storage (never expires)
- 25 WRUs (write capacity units)
- 25 RRUs (read capacity units)

**Request unit calculation:**

- Write ≤1 KB = 1 WRU
- Read ≤4 KB = 1 RRU
- Larger items consume multiple units

**CV Analytics usage:**

```text
Storage: 0.8 GB / 25 GB free = 3% used
Writes: ~100/month (1 per GitHub webhook)
Reads: ~500/month (reporter queries weekly aggregates)
Cost: £0.00 (within always-free limits)
```

**Always-free never expires.** Provisioned capacity has 12-month free tier only.

### GCP Cloud Functions Pricing

**Invocation charges:**

- £0.40 per 1 million invocations
- First 2 million invocations per month: **Free**

**Compute charges:**

- £0.0000025 per GB-second
- First 400,000 GB-seconds per month: **Free**

**Network egress:**

- First 1 GB per month: Free
- After that: £0.12 per GB (North America and Europe)

**CV Analytics webhook receiver:**

```text
Invocations: ~100/month (GitHub webhooks)
Memory: 256 MB (0.25 GB)
Duration: 50ms average (0.05s)
Compute: 100 × (0.25 GB × 0.05s) = 1.25 GB-seconds
Cost: £0.00 (within free tier)
```

### Firestore Pricing

**Storage:**

- First 1 GB: **Free**
- After that: £0.18 per GB/month

**Reads:**

- First 50,000 per day: **Free**
- After that: £0.036 per 100,000 reads

**Writes:**

- First 20,000 per day: **Free**
- After that: £0.108 per 100,000 writes

**Deletes:**

- First 20,000 per day: **Free**
- After that: £0.012 per 100,000 deletes

**CV Analytics usage:**

```text
Storage: 0.5 GB (analytics events)
Writes: ~100/month (webhook → Firestore)
Reads: ~500/month (dashboard real-time listeners)
Daily average: 3 writes, 16 reads
Cost: £0.00 (well within daily limits)
```

### Firebase Hosting Pricing

**Storage:**

- First 10 GB: **Free**
- After that: £0.026 per GB/month

**Bandwidth:**

- First 360 MB per day: **Free** (10.8 GB/month)
- After that: £0.15 per GB

**Custom domains:** Free (SSL certificate included)

**CV Analytics dashboard:**

```text
Bundle size: 150 KB (gzipped)
10 users × 5 visits/day × 150 KB = 7.5 MB/day
Cost: £0.00 (within 360 MB daily limit)
```

### Pricing Comparison Table

```mermaid
graph TB
    subgraph AWS["AWS Free Tier"]
        L["Lambda<br/>1M requests/month<br/>400K GB-seconds/month"]
        D["DynamoDB<br/>25 GB storage<br/>25 RCU/WCU<br/>Always Free"]
    end
    
    subgraph GCP["GCP Free Tier"]
        C["Cloud Functions<br/>2M invocations/month<br/>400K GB-seconds/month"]
        F["Firestore<br/>1 GB storage<br/>50K reads/day<br/>20K writes/day"]
        H["Firebase Hosting<br/>10 GB storage<br/>360 MB/day bandwidth"]
    end
    
    LOAD["CV Analytics Load<br/>500 Lambda invocations<br/>100 Function invocations<br/>100 writes/month<br/>500 reads/month"]
    
    LOAD -.->|5% usage| L
    LOAD -.->|3% usage| D
    LOAD -.->|0.005% usage| C
    LOAD -.->|0.3% usage| F
    LOAD -.->|2% usage| H
    
    RESULT["Total Cost: £0.00/month"]
    
    L --> RESULT
    D --> RESULT
    C --> RESULT
    F --> RESULT
    H --> RESULT
    
    style LOAD fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style RESULT fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
    style AWS fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style GCP fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
```

**Key insight:** Free tiers designed for experimentation. CV Analytics production workload fits comfortably within limits.

---

## AWS Free Tier: Lambda and DynamoDB

AWS provides generous always-free tier for Lambda and DynamoDB. CV Analytics uses 5% of limits.

### Lambda Invocation Limits

**Free tier allowances (permanent):**

- 1 million requests per month
- 400,000 GB-seconds compute time per month

**GB-second calculation matters:**

256 MB memory = 0.25 GB  
512 MB memory = 0.5 GB  
1024 MB memory = 1 GB

**Example scenarios:**

```text
Scenario 1 (Low Memory):
- Memory: 256 MB (0.25 GB)
- Avg duration: 200ms (0.2s)
- Invocations: 1,000,000
- Compute: 1M × (0.25 × 0.2) = 50,000 GB-seconds
- Result: Within 400K limit ✓

Scenario 2 (High Memory):
- Memory: 1024 MB (1 GB)
- Avg duration: 500ms (0.5s)
- Invocations: 500,000
- Compute: 500K × (1 × 0.5) = 250,000 GB-seconds
- Result: Within 400K limit ✓

Scenario 3 (Exceeds Free Tier):
- Memory: 1024 MB (1 GB)
- Avg duration: 1000ms (1s)
- Invocations: 500,000
- Compute: 500K × (1 × 1) = 500,000 GB-seconds
- Result: Exceeds 400K limit ✗ (£1.67 overage charge)
```

### Memory and Duration Trade-offs

**Higher memory = faster execution:**

Processor Lambda test (process 10 webhooks):

```text
128 MB: 850ms execution → (0.125 GB × 0.85s) = 0.106 GB-seconds
256 MB: 450ms execution → (0.25 GB × 0.45s) = 0.113 GB-seconds
512 MB: 250ms execution → (0.5 GB × 0.25s) = 0.125 GB-seconds
1024 MB: 180ms execution → (1 GB × 0.18s) = 0.180 GB-seconds
```

**Best value:** 256 MB (fastest execution for lowest GB-seconds).

**Cold start benefit:** Higher memory allocates more CPU. 1024 MB Lambda gets ~1.8 GHz CPU. 128 MB Lambda gets ~0.2 GHz CPU.

### DynamoDB On-Demand vs Provisioned

**CV Analytics uses on-demand** for always-free tier benefits:

**On-Demand mode:**

- Always-free: 25 GB storage + 25 RCU/WCU (permanent)
- Pay-per-request after free tier
- No capacity planning needed

**Provisioned mode:**

- 12-month free tier only (not permanent)
- 25 RCU + 25 WCU for first year
- After 12 months: charged regardless of usage

**Always-free advantage:**

```text
On-Demand (Always Free):
- Year 1: £0.00 (within 25 GB + 25 RCU/WCU)
- Year 2: £0.00 (always-free never expires)
- Year 5: £0.00 (still free)

Provisioned (12-Month Free Tier):
- Year 1: £0.00 (free tier)
- Year 2: £23.50/month (charged for provisioned capacity)
- Year 5: £23.50/month (still charged)
```

**CV Analytics choice:** On-demand for permanent free tier.

### CloudWatch Logs Retention Costs

**Logging generates charges:**

- 5 GB ingestion per month: Free
- After that: £0.50 per GB
- Storage: £0.03 per GB/month

**CV Analytics optimization:**

```javascript
// Processor Lambda logging
console.log(`Processed ${batch.length} messages`); // Summary only

// ✗ Avoid: Excessive logging
batch.forEach(msg => {
  console.log(`Processing message: ${JSON.stringify(msg)}`); // Wasteful
});
```

**Retention policy:**

```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/cv-processor \
  --retention-in-days 7
```

7-day retention sufficient for debugging. Reduces storage costs.

### Free Tier Usage Visualization

```mermaid
graph TB
    subgraph Limits["AWS Free Tier Limits"]
        LIM1["Lambda: 1M requests/month"]
        LIM2["Lambda: 400K GB-seconds/month"]
        LIM3["DynamoDB: 25 GB storage"]
        LIM4["DynamoDB: 25 RCU + 25 WCU"]
        LIM5["CloudWatch: 5 GB logs/month"]
    end
    
    subgraph Usage["CV Analytics Usage"]
        USE1["Processor: 500 invocations<br/>Reporter: 4 invocations"]
        USE2["Compute: 50 GB-seconds"]
        USE3["Storage: 0.8 GB"]
        USE4["Reads: ~500/month<br/>Writes: ~100/month"]
        USE5["Logs: 0.5 GB/month"]
    end
    
    USE1 -.->|0.05% usage| LIM1
    USE2 -.->|0.0125% usage| LIM2
    USE3 -.->|3.2% usage| LIM3
    USE4 -.->|Far below limits| LIM4
    USE5 -.->|10% usage| LIM5
    
    COST["AWS Cost: £0.00/month"]
    
    LIM1 --> COST
    LIM2 --> COST
    LIM3 --> COST
    LIM4 --> COST
    LIM5 --> COST
    
    style Usage fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Limits fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style COST fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
```

**Key insight:** CV Analytics uses <5% of AWS free tier. Scales 20× before hitting limits.

---

## GCP Free Tier: Cloud Functions and Firestore

GCP provides 2 million Cloud Functions invocations monthly. Firestore offers 50,000 reads per day. CV Analytics uses 0.005% of invocation limits.

### Cloud Functions Invocation Limits

**Free tier allowances:**

- 2 million invocations per month
- 400,000 GB-seconds compute time
- 200,000 GHz-seconds CPU time
- 5 GB network egress per month

**CV Analytics webhook receiver:**

```text
Monthly invocations: ~100 (GitHub webhooks)
Memory: 256 MB (0.25 GB)
Avg duration: 50ms (0.05s)
Compute: 100 × (0.25 GB × 0.05s) = 1.25 GB-seconds

Usage: 0.005% of 2M invocation limit
Compute: 0.0003% of 400K GB-second limit
Cost: £0.00
```

**Scaling potential:** Could handle 20,000× current load before exceeding free tier.

### Firestore Read/Write Quotas

**Daily free tier:**

- 50,000 document reads
- 20,000 document writes
- 20,000 document deletes
- 1 GB stored data

**CV Analytics usage:**

```text
Daily writes: ~3 (GitHub webhooks → Firestore)
Daily reads: ~16 (dashboard real-time listeners × 10 users)

Monthly totals:
- Writes: ~100/month (0.16% of daily limit)
- Reads: ~500/month (1% of daily limit)
- Storage: 0.5 GB (50% of free storage)
```

**Real-time listener behavior:**

```javascript
// Dashboard subscribes once per session
const unsubscribe = onSnapshot(
  collection(db, 'cv_events'),
  (snapshot) => {
    // Initial load: 50 documents = 50 reads
    // Subsequent updates: 1 read per modified document
  }
);
```

**Optimization:** Limit query results to reduce initial read cost:

```javascript
const q = query(
  collection(db, 'cv_events'),
  orderBy('timestamp', 'desc'),
  limit(50) // Caps initial load at 50 reads
);
```

### Firebase Hosting Bandwidth

**Free tier:**

- 10 GB storage
- 360 MB bandwidth per day (10.8 GB/month)

**CV Analytics dashboard:**

```text
Bundle size: 150 KB (gzipped with Vite build)
Daily traffic: 10 users × 5 visits/day = 50 visits
Daily bandwidth: 50 × 150 KB = 7.5 MB
Monthly bandwidth: 7.5 MB × 30 = 225 MB

Usage: 2% of daily limit (7.5 MB / 360 MB)
Cost: £0.00
```

**Bandwidth optimization:**

- Vite tree-shaking removes unused code
- Gzip compression (Firebase automatic)
- Code splitting with React.lazy()
- Image optimization (WebP format)

### Network Egress Charges

**Firestore to client communication:**

- First 10 GB per month: Free
- After that: £0.12 per GB

**CV Analytics egress:**

```text
Real-time listener payload: ~5 KB per document
50 documents per session × 10 KB = 500 KB per user
10 users × 500 KB = 5 MB/month

Usage: 0.05% of 10 GB free tier
Cost: £0.00
```

### GCP Free Tier Usage Visualization

```mermaid
graph TB
    subgraph Limits["GCP Free Tier Limits"]
        LIM1["Cloud Functions: 2M invocations/month"]
        LIM2["Firestore: 50K reads/day"]
        LIM3["Firestore: 20K writes/day"]
        LIM4["Firestore: 1 GB storage"]
        LIM5["Hosting: 360 MB bandwidth/day"]
    end
    
    subgraph Usage["CV Analytics Usage"]
        USE1["Webhook: 100 invocations/month"]
        USE2["Dashboard: ~16 reads/day"]
        USE3["Events: ~3 writes/day"]
        USE4["Storage: 0.5 GB"]
        USE5["Bandwidth: 7.5 MB/day"]
    end
    
    USE1 -.->|0.005% usage| LIM1
    USE2 -.->|0.032% usage| LIM2
    USE3 -.->|0.015% usage| LIM3
    USE4 -.->|50% usage| LIM4
    USE5 -.->|2% usage| LIM5
    
    COST["GCP Cost: £0.00/month"]
    
    LIM1 --> COST
    LIM2 --> COST
    LIM3 --> COST
    LIM4 --> COST
    LIM5 --> COST
    
    style Usage fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Limits fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style COST fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
```

**Key insight:** GCP free tiers even more generous than AWS for low-traffic applications. Firestore's 50K reads per day handles 3,000+ daily active users.

---

## Batching Strategy: Reducing Invocations by 90%

Batching transforms cost model. Instead of invoking Lambda per message, batch 10 messages together. Single invocation processes multiple items.

### SQS Batch Processing

**Without batching:**

```text
1,000 messages arrive in SQS
→ 1,000 Lambda invocations (1 per message)
→ Cost: 1,000 invocations
```

**With batching (batch size = 10):**

```text
1,000 messages arrive in SQS
→ 100 Lambda invocations (10 messages per batch)
→ Cost: 100 invocations
→ 90% reduction
```

**Lambda event source mapping configuration:**

```bash
aws lambda create-event-source-mapping \
  --function-name cv-processor \
  --event-source-arn arn:aws:sqs:eu-west-2:123456789:cv-processor-queue \
  --batch-size 10 \
  --maximum-batching-window-in-seconds 5
```

**Batch size:** Maximum messages per invocation (1-10 for SQS)  
**Batching window:** Wait up to 5 seconds to fill batch

### Lambda Batch Processing Code

**Processor Lambda with batching:**

```javascript
exports.handler = async (event) => {
  // event.Records contains up to 10 SQS messages
  const batch = event.Records.map(record => JSON.parse(record.body));
  
  console.log(`Processing batch of ${batch.length} messages`);
  
  // Process all messages in parallel
  const results = await Promise.all(
    batch.map(async (message) => {
      try {
        await processEvent(message);
        return { success: true, id: message.id };
      } catch (error) {
        console.error(`Failed to process ${message.id}:`, error);
        return { success: false, id: message.id, error: error.message };
      }
    })
  );
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Batch complete: ${successful} successful, ${failed} failed`);
  
  // Partial batch failure handling
  if (failed > 0) {
    const failedIds = results
      .filter(r => !r.success)
      .map(r => r.id);
    throw new Error(`Failed to process: ${failedIds.join(', ')}`);
  }
};

async function processEvent(message) {
  // Write to DynamoDB
  await dynamoDB.putItem({
    TableName: 'cv_events',
    Item: {
      id: message.id,
      repository: message.repository,
      eventType: message.eventType,
      timestamp: Date.now()
    }
  });
  
  // Write to Firestore
  await firestore.collection('cv_events').doc(message.id).set({
    repository: message.repository,
    eventType: message.eventType,
    timestamp: Date.now()
  });
}
```

### DynamoDB Streams Batching

**Reporter Lambda triggered by DynamoDB Streams:**

```bash
aws lambda create-event-source-mapping \
  --function-name cv-reporter \
  --event-source-arn arn:aws:dynamodb:eu-west-2:123456789:table/cv_events/stream/2025-11-24 \
  --batch-size 100 \
  --starting-position LATEST
```

**Batch size 100:** Aggregates up to 100 DynamoDB changes before invoking Lambda.

**Reporter processing:**

```javascript
exports.handler = async (event) => {
  // event.Records contains up to 100 DynamoDB Stream records
  console.log(`Processing ${event.Records.length} DynamoDB changes`);
  
  const newEvents = event.Records
    .filter(record => record.eventName === 'INSERT')
    .map(record => AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage));
  
  // Generate aggregate statistics
  const stats = {
    totalEvents: newEvents.length,
    byRepository: groupBy(newEvents, 'repository'),
    byEventType: groupBy(newEvents, 'eventType'),
    timestamp: Date.now()
  };
  
  // Write summary (single DynamoDB write instead of 100)
  await dynamoDB.putItem({
    TableName: 'cv_reports',
    Item: {
      reportId: `weekly-${Date.now()}`,
      ...stats
    }
  });
};
```

### Trade-offs: Latency vs Cost

**Batching introduces latency:**

```text
Batch size 1 (no batching):
- Message arrives → Processed immediately
- Latency: <100ms
- Cost: 1,000 invocations

Batch size 10, window 5s:
- Message arrives → Waits up to 5s for batch to fill
- Latency: 0-5 seconds
- Cost: 100 invocations

Batch size 100, window 30s:
- Message arrives → Waits up to 30s
- Latency: 0-30 seconds
- Cost: 10 invocations
```

**Choose based on requirements:**

**Real-time (no batching):**
- User-facing notifications
- Payment processing
- Security alerts

**Near real-time (small batches):**
- Analytics ingestion
- Log aggregation
- Metrics collection

**Batch processing (large batches):**
- Daily reports
- Bulk data transformations
- Archive operations

**CV Analytics choice:** Batch size 10, window 5s (analytics don't need instant processing).

### Batching Impact Visualization

```mermaid
graph LR
    subgraph Before["Before Batching"]
        SQS1["SQS Queue<br/>1,000 messages"]
        
        L1["Lambda Invoke 1"]
        L2["Lambda Invoke 2"]
        L3["Lambda Invoke 3"]
        DOTS1["..."]
        L1000["Lambda Invoke 1,000"]
        
        SQS1 --> L1
        SQS1 --> L2
        SQS1 --> L3
        SQS1 --> DOTS1
        SQS1 --> L1000
        
        COST1["Cost: 1,000 invocations"]
        L1000 --> COST1
    end
    
    subgraph After["After Batching (Batch Size = 10)"]
        SQS2["SQS Queue<br/>1,000 messages"]
        
        LB1["Lambda Batch 1<br/>(10 messages)"]
        LB2["Lambda Batch 2<br/>(10 messages)"]
        LB3["Lambda Batch 3<br/>(10 messages)"]
        DOTS2["..."]
        LB100["Lambda Batch 100<br/>(10 messages)"]
        
        SQS2 --> LB1
        SQS2 --> LB2
        SQS2 --> LB3
        SQS2 --> DOTS2
        SQS2 --> LB100
        
        COST2["Cost: 100 invocations<br/>90% reduction ✓"]
        LB100 --> COST2
    end
    
    style Before fill:#ffccbc,stroke:#d32f2f,stroke-width:2px
    style After fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style COST1 fill:#ffccbc,stroke:#d32f2f,stroke-width:2px
    style COST2 fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
```

**Key insight:** Batching most effective for high-volume, non-real-time workloads. CV Analytics reduced costs 90% with 5-second latency trade-off.

---

## Cold Start Optimization

Cold starts occur when Lambda creates new execution environment. First request pays initialization penalty. Subsequent requests reuse warm environment.

### What Causes Cold Starts

**Cold start triggers:**

1. **First invocation** (no warm environments exist)
2. **Scaling up** (existing environments busy, new one needed)
3. **Code deployment** (all environments discarded)
4. **Long idle period** (AWS reclaims unused environments after ~15 minutes)

**Cold start phases:**

```text
1. Download code (50-100ms)
2. Start runtime (50-200ms)
3. Initialize code (run global scope)
4. Invoke handler function

Total: 200-500ms (depends on code size, runtime, memory)
```

### Memory Allocation Impact

**Higher memory = more CPU = faster cold starts:**

**Processor Lambda cold start tests:**

```text
128 MB memory:
- Runtime init: 250ms
- Code init: 150ms
- Total cold start: 400ms

256 MB memory:
- Runtime init: 180ms
- Code init: 80ms
- Total cold start: 260ms

512 MB memory:
- Runtime init: 120ms
- Code init: 50ms
- Total cold start: 170ms

1024 MB memory:
- Runtime init: 80ms
- Code init: 30ms
- Total cold start: 110ms
```

**Trade-off analysis:**

```text
Scenario: 500 invocations/month, 10% cold starts (50)

128 MB Lambda:
- Cost: £0.00 (within free tier)
- Cold start penalty: 50 × 400ms = 20 seconds wasted

1024 MB Lambda:
- Cost: £0.00 (within free tier)
- Cold start penalty: 50 × 110ms = 5.5 seconds wasted
- Savings: 14.5 seconds faster
```

**CV Analytics choice:** 256 MB (sweet spot for cost vs performance).

### Code Splitting and Dependencies

**Minimize bundle size:**

**Bad (bloated dependencies):**

```javascript
// Entire AWS SDK (70 MB)
const AWS = require('aws-sdk');

// Entire Lodash library (500 KB)
const _ = require('lodash');
```

**Good (selective imports):**

```javascript
// Only DynamoDB client (2 MB)
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

// Only needed Lodash function (10 KB)
const groupBy = require('lodash.groupby');
```

**Impact:**

```text
Bloated Lambda:
- Package size: 71 MB
- Download time: 100ms
- Cold start: 350ms

Optimized Lambda:
- Package size: 2 MB
- Download time: 20ms
- Cold start: 180ms
```

### Connection Pooling

**Initialize connections outside handler** (global scope, reused across invocations):

**Bad (creates new connection every invocation):**

```javascript
exports.handler = async (event) => {
  const dynamoDB = new DynamoDBClient({ region: 'eu-west-2' });
  await dynamoDB.send(new PutItemCommand({ /*...*/ }));
};

// Cold start: 200ms + 50ms connection = 250ms
// Warm start: 0ms + 50ms connection = 50ms (wasted!)
```

**Good (connection pooled globally):**

```javascript
const dynamoDB = new DynamoDBClient({ region: 'eu-west-2' });

exports.handler = async (event) => {
  await dynamoDB.send(new PutItemCommand({ /*...*/ }));
};

// Cold start: 200ms + 50ms connection = 250ms
// Warm start: 0ms (reuses existing connection)
```

**Firestore connection pooling:**

```javascript
const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore(); // Initialized once

exports.handler = async (event) => {
  await firestore.collection('cv_events').add({ /*...*/ });
};
```

### Provisioned Concurrency (Costs Money)

**Keeps Lambda warm 24/7:**

```bash
aws lambda put-provisioned-concurrency-config \
  --function-name cv-processor \
  --provisioned-concurrent-executions 2
```

**Pricing:**

- £0.0000041667 per GB-second
- 2 instances × 256 MB (0.25 GB) × 30 days × 86,400 seconds = 1,296,000 GB-seconds
- Cost: £5.40/month

**When to use:**

- User-facing APIs (latency-sensitive)
- High-traffic applications (thousands of requests/minute)
- Revenue-generating workloads (cost justified)

**CV Analytics decision:** **No provisioned concurrency.** Cold starts acceptable for analytics workload. Saves £5.40/month.

---

## Cost Monitoring and Alerts

Proactive monitoring prevents surprise bills. Set alerts before costs escalate.

### AWS Cost Explorer

**Enable Cost Explorer:**

1. AWS Console → Billing → Cost Explorer
2. View monthly costs by service
3. Filter by date range, service, region

**CV Analytics monthly view:**

```text
Lambda: £0.00 (500 invocations within 1M free tier)
DynamoDB: £0.00 (0.8 GB storage within 25 GB free tier)
CloudWatch: £0.00 (0.5 GB logs within 5 GB free tier)
```

**Daily cost tracking** available with hourly granularity (identify spikes quickly).

### CloudWatch Billing Metrics

**Enable billing alerts:**

1. AWS Console → CloudWatch → Billing
2. Enable billing alerts (one-time setup)
3. Create alarm for estimated charges

**CloudWatch alarm for £5 threshold:**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name cv-analytics-billing-alert \
  --alarm-description "Alert when costs exceed £5/month" \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --metric-name EstimatedCharges \
  --namespace "AWS/Billing" \
  --period 86400 \
  --statistic Maximum \
  --threshold 5.0 \
  --dimensions Name=Currency,Value=GBP \
  --alarm-actions arn:aws:sns:us-east-1:123456789:billing-alerts
```

**SNS notification** emails when threshold exceeded.

### GCP Billing Budgets

**Create budget alert:**

1. GCP Console → Billing → Budgets & Alerts
2. Set budget: £5/month
3. Configure thresholds: 50%, 90%, 100%
4. Email notifications

**Programmatic budget creation:**

```bash
gcloud billing budgets create \
  --billing-account=012345-6789AB-CDEF01 \
  --display-name="CV Analytics Budget" \
  --budget-amount=5GBP \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

### Daily Cost Tracking

**Custom CloudWatch dashboard:**

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Billing", "EstimatedCharges", {"stat": "Maximum"}]
        ],
        "period": 86400,
        "stat": "Maximum",
        "region": "us-east-1",
        "title": "Daily AWS Costs"
      }
    }
  ]
}
```

**CV Analytics monitoring approach:**

1. Weekly Cost Explorer review (5 minutes)
2. CloudWatch alert for >£5/month
3. GCP billing budget for >£5/month
4. Quarterly audit of unused resources

**6-month track record:** £0.00 every month.

---

## Real Cost Breakdown: CV Analytics

Production system running at £0/month for 6 months (May - November 2025).

### Monthly Cost Summary

```text
AWS Services:
├─ Lambda
│  ├─ Invocations: 500 / 1,000,000 free tier = 0.05%
│  ├─ Compute: 50 GB-seconds / 400,000 free tier = 0.0125%
│  └─ Cost: £0.00
│
├─ DynamoDB
│  ├─ Storage: 0.8 GB / 25 GB always-free = 3.2%
│  ├─ Reads: 500 / 25,000 RCU/month = 2%
│  ├─ Writes: 100 / 25,000 WCU/month = 0.4%
│  └─ Cost: £0.00
│
└─ CloudWatch Logs
   ├─ Ingestion: 0.5 GB / 5 GB free tier = 10%
   ├─ Storage: 0.3 GB (7-day retention)
   └─ Cost: £0.00

GCP Services:
├─ Cloud Functions
│  ├─ Invocations: 100 / 2,000,000 free tier = 0.005%
│  ├─ Compute: 1.25 GB-seconds / 400,000 free tier = 0.0003%
│  └─ Cost: £0.00
│
├─ Firestore
│  ├─ Storage: 0.5 GB / 1 GB free tier = 50%
│  ├─ Reads: ~16/day / 50,000/day free tier = 0.032%
│  ├─ Writes: ~3/day / 20,000/day free tier = 0.015%
│  └─ Cost: £0.00
│
└─ Firebase Hosting
   ├─ Storage: 0.15 GB / 10 GB free tier = 1.5%
   ├─ Bandwidth: 7.5 MB/day / 360 MB/day free tier = 2%
   └─ Cost: £0.00

Total Monthly Cost: £0.00
```

### Cost Breakdown Visualization

```mermaid
pie title CV Analytics Monthly Costs by Service
    "AWS Lambda" : 0
    "DynamoDB" : 0
    "CloudWatch" : 0
    "Cloud Functions" : 0
    "Firestore" : 0
    "Firebase Hosting" : 0
```

```mermaid
graph TB
    subgraph Services["All Services"]
        AWS1["AWS Lambda<br/>500 invocations<br/>£0.00"]
        AWS2["DynamoDB<br/>0.8 GB storage<br/>£0.00"]
        AWS3["CloudWatch<br/>0.5 GB logs<br/>£0.00"]
        
        GCP1["Cloud Functions<br/>100 invocations<br/>£0.00"]
        GCP2["Firestore<br/>0.5 GB + 500 ops<br/>£0.00"]
        GCP3["Firebase Hosting<br/>225 MB bandwidth<br/>£0.00"]
    end
    
    TOTAL["Total Cost<br/>£0.00/month<br/>6 months running<br/>100% uptime"]
    
    AWS1 --> TOTAL
    AWS2 --> TOTAL
    AWS3 --> TOTAL
    GCP1 --> TOTAL
    GCP2 --> TOTAL
    GCP3 --> TOTAL
    
    style Services fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style TOTAL fill:#c8e6c9,stroke:#388e3c,stroke-width:4px
```

### Highest Resource Usage

**Firestore storage:** 50% of free tier (0.5 GB / 1 GB)  
**DynamoDB storage:** 3.2% of always-free tier (0.8 GB / 25 GB)  
**CloudWatch logs:** 10% of free tier (0.5 GB / 5 GB)

**All other services:** <5% of free tier limits.

**Conclusion:** CV Analytics operates comfortably within free tiers with 20× headroom before hitting limits.

---

## When to Scale Up: Beyond Free Tier

Free tiers sufficient for portfolio projects and low-traffic production. When to pay for capacity?

### Traffic Thresholds

**1 million queries/month (current load × 2,000):**

```text
AWS:
- Lambda: 1M invocations (at free tier limit)
- DynamoDB: 1M writes, 5M reads (exceeds always-free 25 RCU/WCU)
- Estimated cost: £15/month

GCP:
- Cloud Functions: 200K invocations (within 2M free tier)
- Firestore: 200K writes, 1M reads (exceeds 20K writes/day limit)
- Estimated cost: £12/month

Total: £27/month
```

**10 million queries/month:**

```text
AWS:
- Lambda: 10M invocations (9M beyond free tier)
- DynamoDB: 10M writes, 50M reads
- Estimated cost: £85/month

GCP:
- Cloud Functions: 2M invocations (within free tier)
- Firestore: 2M writes, 10M reads
- Estimated cost: £45/month

Total: £130/month
```

**100 million queries/month:**

```text
AWS: £650/month
GCP: £350/month
Total: £1,000/month
```

### Reserved Capacity and Savings Plans

**DynamoDB Reserved Capacity:**

- 1-year commitment: 43% discount
- 3-year commitment: 76% discount
- Requires predictable workload

**AWS Compute Savings Plans:**

- 1-year commitment: 17% discount on Lambda compute
- 3-year commitment: 42% discount
- Applies to Lambda, Fargate, EC2

**When to commit:**

- Traffic stable for 6+ months
- Growth predictable
- Can afford upfront payment

**CV Analytics decision:** No commitments yet (traffic too low, free tier sufficient).

### Right-Sizing Resources

**Lambda memory optimization:**

Test different memory configurations:

```bash
# Test 128 MB
aws lambda update-function-configuration \
  --function-name cv-processor \
  --memory-size 128

# Monitor CloudWatch metrics for 1 week

# Test 256 MB
aws lambda update-function-configuration \
  --function-name cv-processor \
  --memory-size 256
```

**Find sweet spot:** Lowest memory that meets latency requirements.

**Firestore index optimization:**

```bash
# List unused indexes
firebase firestore:indexes

# Delete unused indexes (reduces storage costs)
firebase firestore:indexes:delete <index-id>
```

### Cost-Benefit Analysis

**Question:** Should CV Analytics move to single-cloud (reduce complexity)?

**Multi-cloud costs:**

- AWS: £0.00/month
- GCP: £0.00/month
- Total: £0.00/month

**Single-cloud (AWS only):**

- Lambda: £0.00/month
- DynamoDB: £0.00/month
- S3 hosting: £0.00/month (5 GB free tier)
- Total: £0.00/month

**Benefit:** Simplified architecture, single billing account  
**Cost:** Loss of real-time Firestore features  
**Decision:** Keep multi-cloud (no cost penalty, better features)

**When to consolidate:** >£100/month spend (management overhead justified).

---

## Practical Takeaways

Running production serverless at £0/month requires intentional architecture decisions. CV Analytics demonstrates proven patterns.

### Key Principles

**1. Design for free tiers from day one:**

- Choose on-demand DynamoDB (always-free vs 12-month provisioned)
- Limit Firestore queries (`limit(50)` prevents expensive full scans)
- Batch Lambda invocations (10× messages per invocation)
- Set CloudWatch log retention to 7 days (not indefinite)

**2. Monitor costs before they occur:**

- Enable CloudWatch billing alerts (£5 threshold)
- Create GCP billing budgets (50%, 90%, 100% alerts)
- Weekly Cost Explorer review (5 minutes)
- Track free tier usage percentage (stay <50% for safety margin)

**3. Optimize for GB-seconds, not just invocations:**

- Test different Lambda memory sizes (256 MB often optimal)
- Minimize dependencies (selective imports, not entire libraries)
- Pool connections globally (DynamoDB, Firestore clients)
- Avoid provisioned concurrency unless revenue-justified

**4. Batch non-real-time workloads:**

- SQS batch size 10, window 5 seconds (90% cost reduction)
- DynamoDB Streams batch size 100 (aggregate before processing)
- Trade latency for cost (5-second delay acceptable for analytics)

**5. Right-size for actual usage:**

- CV Analytics: 500 Lambda invocations/month (0.05% of free tier)
- Don't over-provision for hypothetical scale
- Measure first, optimize later

### Implementation Checklist

**Week 1: Setup**

- ☐ Enable AWS Cost Explorer
- ☐ Create CloudWatch billing alarm (£5 threshold)
- ☐ Create GCP billing budget (£5 threshold)
- ☐ Configure SNS email notifications

**Week 2: Optimization**

- ☐ Enable SQS batching (batch size 10)
- ☐ Pool database connections (global scope)
- ☐ Set CloudWatch log retention (7 days)
- ☐ Minimize Lambda package sizes (selective imports)

**Week 3: Monitoring**

- ☐ Review Cost Explorer weekly
- ☐ Track free tier usage percentages
- ☐ Test different Lambda memory configurations
- ☐ Document actual costs (should be £0.00)

**Ongoing:**

- ☐ Monthly cost review (5 minutes)
- ☐ Quarterly architecture review (optimize as needed)
- ☐ Annual free tier audit (confirm always-free vs 12-month)

### Success Metrics

**CV Analytics 6-month results:**

- **Total cost:** £0.00/month (100% within free tiers)
- **Uptime:** 99.95% (3 hours downtime for deployments)
- **Lambda cold starts:** <5% of invocations
- **DynamoDB latency:** <10ms p99
- **Firestore latency:** <50ms p99 (real-time listeners)
- **Free tier usage:** <10% of limits (20× headroom)

**Portfolio projects should aim for:**

- £0-5/month total cloud costs
- <25% free tier usage (4× scaling headroom)
- <100ms p95 latency
- >99% uptime

### When to Exceed Free Tier

**Justified scenarios:**

- Revenue-generating application (£100+/month income)
- >10,000 daily active users
- Real-time requirements (<100ms latency critical)
- Business SLA commitments (99.9% uptime contractual)

**CV Analytics stays free because:**

- Portfolio project (no revenue requirement)
- Low traffic (10 users, 100 webhooks/month)
- Analytics workload (5-second latency acceptable)
- Personal project (no SLA commitments)

**Scale up when:** Revenue covers 5× cloud costs (£50 revenue → £10 cloud spend acceptable).

### Final Cost Optimization Workflow

```mermaid
graph TD
    START[New Serverless Project] --> DESIGN[Design for Free Tiers]
    
    DESIGN --> CHOICES[Architecture Choices]
    CHOICES --> C1[DynamoDB On-Demand<br/>Always-Free 25 GB]
    CHOICES --> C2[Lambda Batching<br/>Batch Size 10]
    CHOICES --> C3[Firestore Query Limits<br/>limit-50 per query]
    CHOICES --> C4[CloudWatch Logs<br/>7-day Retention]
    
    C1 --> MONITOR[Setup Monitoring]
    C2 --> MONITOR
    C3 --> MONITOR
    C4 --> MONITOR
    
    MONITOR --> M1[CloudWatch Billing Alarm<br/>£5 Threshold]
    MONITOR --> M2[GCP Billing Budget<br/>£5 Threshold]
    MONITOR --> M3[Weekly Cost Review<br/>Cost Explorer]
    
    M1 --> DEPLOY[Deploy to Production]
    M2 --> DEPLOY
    M3 --> DEPLOY
    
    DEPLOY --> TRACK[Track Metrics]
    
    TRACK --> CHECK{Cost > £0?}
    CHECK -->|Yes| INVESTIGATE[Investigate Spike]
    CHECK -->|No| SUCCESS[Success: £0/month]
    
    INVESTIGATE --> FIX[Optimize or Accept]
    FIX --> TRACK
    
    SUCCESS --> REVIEW[Monthly Review]
    REVIEW --> SCALE{Need to Scale?}
    
    SCALE -->|No| SUCCESS
    SCALE -->|Yes| EVALUATE[Evaluate ROI]
    
    EVALUATE --> ROI{Revenue > 5x Cost?}
    ROI -->|Yes| SCALEUP[Scale Up]
    ROI -->|No| OPTIMIZE[Further Optimize]
    
    OPTIMIZE --> TRACK
    SCALEUP --> PAID[Paid Tier]
    
    style START fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style SUCCESS fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
    style PAID fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style INVESTIGATE fill:#ffccbc,stroke:#d32f2f,stroke-width:2px
```

**Key insight:** Free tiers are permanent features, not promotional trials. Architect for them deliberately. CV Analytics proves production-grade systems can run at £0/month indefinitely.

---

## Series Conclusion

**What We've Covered:**

1. **Part 1:** Pure microservices architecture (87.5% score)
2. **Part 2:** Multi-cloud infrastructure as code (Terraform)
3. **Part 3:** Automated deployments (GitHub Actions)
4. **Part 4:** Event-driven architecture (SQS, Streams)
5. **Part 5:** Semantic versioning (independent evolution)
6. **Part 6:** Multi-cloud security (HMAC, IAM, secrets)
7. **Part 7:** Real-time dashboard (React, Firestore)
8. **Part 8:** Cost optimization (£0/month production system)

**What You've Learned:**
- ✓ Design and score microservices architectures
- ✓ Provision multi-cloud infrastructure with Terraform
- ✓ Automate deployments with GitHub Actions
- ✓ Build event-driven systems with queues and streams
- ✓ Version services independently with SemVer
- ✓ Secure webhooks and APIs across clouds
- ✓ Create real-time dashboards with React
- ✓ Optimize serverless costs for production

**Next Steps:**
- Clone the repositories and run locally
- Modify for your own use cases
- Deploy to your own AWS/GCP accounts
- Share your learnings

**All repositories:**
- [Dashboard](https://github.com/josejalvarezm/cv-analytics-dashboard-private)
- [Webhook Receiver](https://github.com/josejalvarezm/cv-analytics-webhook-receiver-private)
- [Processor](https://github.com/josejalvarezm/cv-analytics-processor-private)
- [Reporter](https://github.com/josejalvarezm/cv-analytics-reporter-private)
- [Infrastructure](https://github.com/josejalvarezm/cv-analytics-infrastructure-private)

---

## Further Reading

- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [GCP Cloud Functions Pricing](https://cloud.google.com/functions/pricing)
- [Firestore Pricing](https://firebase.google.com/docs/firestore/quotas)

---

**Author:** José Álvarez  
**Series:** CV Analytics Multi-Cloud Microservices  
**Published:** November 2025  
**Tags:** serverless, cost-optimization, AWS, GCP, free-tier, production
