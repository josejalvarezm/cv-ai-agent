# Pure Microservices Migration Plan

## Executive Summary

This plan migrates the CV Analytics system from **pragmatic microservices** (shared infrastructure, shared database) to **pure microservices** (independent infrastructure, separate databases, independent CI/CD). This is a learning exercise to gain hands-on experience with enterprise-grade microservices patterns.

## Rollback Points Created ✅

All repositories tagged for safe rollback:

| Repository | Tag | Commit State |
|------------|-----|--------------|
| `cv-analytics-infrastructure` | `v1.0-pragmatic-microservices` | Clean (shared Terraform state) |
| `cv-analytics-processor` | `v1.0-shared-db` | Clean (shared DynamoDB access) |
| `cv-analytics-reporter` | `v1.0-shared-db` | Clean (shared DynamoDB access) |
| `MyAIAgentPrivate` | `v1.0-shared-infrastructure` | Clean (shared SQS access) |

**Rollback Command:**
```bash
# From any repo
git checkout <tag-name>
# Example: git checkout v1.0-pragmatic-microservices
```

---

## Current Architecture (Pragmatic Microservices)

### Infrastructure
- **Single Terraform state** managing all resources
- **Shared DynamoDB table** (`cv-events`) for all services
- **Shared SQS queue** (`cv-analytics-events.fifo`) for Worker → Processor
- **Centralized IAM roles** and permissions
- **Manual deployments** (PowerShell scripts)

### Services
1. **Worker** (`MyAIAgentPrivate`): Tracks user events → SQS
2. **Processor** (`cv-analytics-processor`): SQS → DynamoDB correlation logic
3. **Reporter** (`cv-analytics-reporter`): EventBridge → Weekly email reports

### Pros
- ✅ Simpler infrastructure management
- ✅ Single point of deployment
- ✅ Faster initial setup
- ✅ Lower operational overhead

### Cons
- ❌ Services coupled through shared database
- ❌ Schema changes affect all services
- ❌ Cannot scale databases independently
- ❌ Single point of failure (infrastructure)
- ❌ No independent CI/CD per service

---

## Target Architecture (Pure Microservices)

### Infrastructure (Per Service)
- **Separate Terraform states** (worker-infra, processor-infra, reporter-infra)
- **Dedicated databases** per service:
  - Worker DB: Raw events storage
  - Processor DB: Correlation data
  - Reporter DB: Read-only replica OR cross-service API
- **Service-owned queues** (each service owns its SQS queues)
- **Independent IAM roles** per service
- **Automated CI/CD** (GitHub Actions per repo)

### Services (Independent)
1. **Worker Service**: Full ownership (code + infra + DB + CI/CD)
2. **Processor Service**: Full ownership (code + infra + DB + CI/CD)
3. **Reporter Service**: Full ownership (code + infra + DB/API + CI/CD)

### Pros
- ✅ True service independence
- ✅ Independent scaling (code AND data)
- ✅ Fault isolation (one service failure doesn't cascade)
- ✅ Team ownership (each service fully owned)
- ✅ Independent deployment cycles
- ✅ Technology flexibility per service

### Cons
- ⚠️ Higher operational complexity
- ⚠️ Cross-service data access requires APIs or replication
- ⚠️ More infrastructure to manage
- ⚠️ Potential data consistency challenges

---

## Migration Phases

### Phase 0: Preparation & Backup ✅
**Status:** COMPLETE

**Objectives:**
- Create rollback points
- Document current state
- Backup Terraform state

**Completed:**
- ✅ Git tags created on all repos
- ✅ Working trees clean
- ✅ Migration plan created

**Validation:**
```bash
# Verify tags exist
cd d:\Code\MyCV\cv-analytics-infrastructure && git tag
cd d:\Code\MyCV\cv-analytics-processor && git tag
cd d:\Code\MyCV\cv-analytics-reporter && git tag
cd d:\Code\MyCV\MyAIAgentPrivate && git tag
```

---

### Phase 1: Separate Terraform States
**Duration:** 2-4 hours  
**Risk:** MEDIUM (infrastructure changes)

#### Objectives
- Split single Terraform state into 3 independent states
- Each service owns its infrastructure code
- Maintain existing resources (no recreation)

#### Current State
```
cv-analytics-infrastructure/
  terraform/
    main.tf          # All 28+ resources
    variables.tf
    outputs.tf
    terraform.tfstate # Single state file
```

#### Target State
```
cv-analytics-infrastructure/
  shared/            # Shared resources (VPC, etc. if needed)
  worker-infra/      # Worker's Terraform
  processor-infra/   # Processor's Terraform  
  reporter-infra/    # Reporter's Terraform
```

#### Steps

**1.1 Backup Current State**
```bash
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform
terraform state pull > backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').json
```

**1.2 Create New Directory Structure**
```bash
cd d:\Code\MyCV\cv-analytics-infrastructure
mkdir shared, worker-infra, processor-infra, reporter-infra
```

**1.3 Split Resources by Ownership**

**Worker-Infra** (owns):
- SQS queue: `cv-analytics-events.fifo`
- SQS DLQ: `cv-analytics-dlq.fifo`
- Lambda permissions for Worker (if any)
- IAM role for Worker

**Processor-Infra** (owns):
- Lambda function: `cv-analytics-processor`
- Lambda IAM role
- CloudWatch log group
- Event source mapping (SQS → Lambda)
- Processor DynamoDB table (new, separate)

**Reporter-Infra** (owns):
- Lambda function: `cv-analytics-reporter`
- Lambda IAM role
- CloudWatch log group
- EventBridge rule
- Reporter DynamoDB table (new, separate) OR API access

**Shared** (optional):
- Common tags
- Shared variables
- Cross-account roles (if any)

**1.4 Initialize Separate States**
```bash
# Worker
cd worker-infra
terraform init
terraform import <resource_type>.<resource_name> <resource_id>
# Repeat for all Worker resources

# Processor
cd ../processor-infra
terraform init
terraform import <resource_type>.<resource_name> <resource_id>
# Repeat for all Processor resources

# Reporter
cd ../reporter-infra
terraform init
terraform import <resource_type>.<resource_name> <resource_id>
```

**1.5 Use Data Sources for Cross-References**

Example: Processor needs Worker's SQS queue ARN
```hcl
# processor-infra/main.tf
data "aws_sqs_queue" "worker_events" {
  name = "cv-analytics-events.fifo"
}

resource "aws_lambda_event_source_mapping" "processor_trigger" {
  event_source_arn = data.aws_sqs_queue.worker_events.arn
  function_name    = aws_lambda_function.processor.arn
}
```

#### Validation
```bash
# Each service should plan with no changes
cd worker-infra && terraform plan      # Should show 0 to add, 0 to change, 0 to destroy
cd processor-infra && terraform plan
cd reporter-infra && terraform plan
```

#### Rollback Procedure
```bash
cd d:\Code\MyCV\cv-analytics-infrastructure
git checkout v1.0-pragmatic-microservices
terraform init
terraform plan  # Verify state matches
```

---

### Phase 2: Separate Databases
**Duration:** 4-6 hours  
**Risk:** HIGH (data migration)

#### Objectives
- Create separate DynamoDB tables per service
- Migrate data to new tables
- Update service code to use dedicated tables
- Maintain backward compatibility during transition

#### Current State
```
Single DynamoDB table: cv-events
Schema:
  - PK: userId
  - SK: timestamp#eventType
  - Attributes: sessionId, url, timestamp, eventType, correlationId
```

#### Target State
```
Worker DB: cv-events-raw
  - PK: userId
  - SK: timestamp
  - Purpose: Raw event ingestion
  
Processor DB: cv-events-processed
  - PK: correlationId
  - SK: timestamp
  - Purpose: Correlated sessions
  - GSI: userId-index
  
Reporter DB: Option A (Read Replica) OR Option B (API)
  - Option A: DynamoDB stream → replica table
  - Option B: REST API from Processor service
```

#### Steps

**2.1 Create New Tables (Terraform)**

**worker-infra/dynamodb.tf**
```hcl
resource "aws_dynamodb_table" "worker_events" {
  name           = "cv-events-raw"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"
  range_key      = "timestamp"
  
  attribute {
    name = "userId"
    type = "S"
  }
  
  attribute {
    name = "timestamp"
    type = "S"
  }
  
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
  
  tags = {
    Service = "Worker"
    Purpose = "Raw event storage"
  }
}
```

**processor-infra/dynamodb.tf**
```hcl
resource "aws_dynamodb_table" "processor_correlations" {
  name           = "cv-events-processed"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "correlationId"
  range_key      = "timestamp"
  
  attribute {
    name = "correlationId"
    type = "S"
  }
  
  attribute {
    name = "timestamp"
    type = "S"
  }
  
  attribute {
    name = "userId"
    type = "S"
  }
  
  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }
  
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
  
  tags = {
    Service = "Processor"
    Purpose = "Correlated sessions"
  }
}
```

**2.2 Deploy New Tables**
```bash
cd worker-infra && terraform apply
cd processor-infra && terraform apply
```

**2.3 Data Migration Strategy**

**Option A: Dual-Write Pattern** (Recommended for learning)
- Worker writes to BOTH old and new tables
- Processor reads from old table, writes to new table
- Gradual migration over time
- Decommission old table after validation

**Option B: Bulk Migration**
- Export old table to S3
- Transform data
- Import to new tables
- Risky, requires downtime

**2.4 Update Worker Code**

**Before:**
```typescript
// worker/analytics-service.ts
await dynamodb.putItem({
  TableName: 'cv-events',
  Item: { userId, timestamp, eventType }
});
```

**After (Dual-Write):**
```typescript
// worker/analytics-service.ts
await Promise.all([
  // Old table (backward compatibility)
  dynamodb.putItem({
    TableName: 'cv-events',
    Item: { userId, timestamp, eventType }
  }),
  // New table (Worker-owned)
  dynamodb.putItem({
    TableName: 'cv-events-raw',
    Item: { userId, timestamp, eventType }
  })
]);
```

**2.5 Update Processor Code**

**Before:**
```typescript
// processor/repositories/event-repository.ts
async getEventsForCorrelation(userId: string) {
  return dynamodb.query({
    TableName: 'cv-events',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  });
}
```

**After:**
```typescript
// processor/repositories/event-repository.ts
async getEventsForCorrelation(userId: string) {
  // Read from Processor's own table
  return dynamodb.query({
    TableName: 'cv-events-processed',
    KeyConditionExpression: 'userId = :userId',
    IndexName: 'userId-index',
    ExpressionAttributeValues: { ':userId': userId }
  });
}

async saveCorrelation(correlation: Correlation) {
  // Write to Processor's table
  return dynamodb.putItem({
    TableName: 'cv-events-processed',
    Item: correlation
  });
}
```

**2.6 Reporter Data Access**

**Option A: DynamoDB Streams + Read Replica**
```hcl
# reporter-infra/dynamodb.tf
resource "aws_dynamodb_table" "reporter_read_replica" {
  name           = "cv-events-reporter-replica"
  billing_mode   = "PAY_PER_REQUEST"
  
  # Lambda triggered by Processor's stream
  # Replicates data for Reporter's read-only access
}
```

**Option B: REST API (More "pure" microservices)**
```typescript
// processor/api/routes.ts
app.get('/api/correlations/:userId', async (req, res) => {
  const correlations = await getCorrelationsByUser(req.params.userId);
  res.json(correlations);
});

// reporter/services/data-service.ts
async fetchCorrelations(userId: string) {
  const response = await fetch(
    `${PROCESSOR_API_URL}/api/correlations/${userId}`
  );
  return response.json();
}
```

#### Validation
```bash
# Insert test event via Worker
# Verify appears in cv-events-raw table

# Trigger Processor manually
# Verify correlation in cv-events-processed table

# Run Reporter
# Verify can read data via API or replica
```

#### Rollback Procedure
```bash
# Revert Worker code
git checkout v1.0-shared-db

# Revert Processor code
git checkout v1.0-shared-db

# Keep new tables (don't destroy data)
# Switch back to old table reads
```

---

### Phase 3: Independent CI/CD
**Duration:** 3-5 hours  
**Risk:** LOW (no data impact)

#### Objectives
- GitHub Actions workflow per service
- Automated testing on PR
- Automated deployment on merge to main
- Independent release cycles

#### Current State
- Manual deployments via PowerShell scripts
- No automated testing
- No PR validation

#### Target State
- Each repo has `.github/workflows/deploy.yml`
- PR triggers: lint + test + build
- Merge to main: deploy to AWS
- Independent versioning (semver tags)

#### Steps

**3.1 Worker CI/CD**

Create `MyAIAgentPrivate/.github/workflows/deploy.yml`:
```yaml
name: Deploy Worker Service

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-infrastructure:
    needs: test
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infrastructure/worker-infra
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      - name: Terraform Init
        run: terraform init
      - name: Terraform Plan
        run: terraform plan
      - name: Terraform Apply
        run: terraform apply -auto-approve
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

  deploy-code:
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - name: Deploy to production
        run: npm run deploy
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

**3.2 Processor CI/CD**

Create `cv-analytics-processor/.github/workflows/deploy.yml`:
```yaml
name: Deploy Processor Service

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-infrastructure:
    needs: test
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infrastructure/processor-infra
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      - name: Terraform Init
        run: terraform init
      - name: Terraform Plan
        run: terraform plan
      - name: Terraform Apply
        run: terraform apply -auto-approve
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

  deploy-lambda:
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - name: Deploy Lambda
        run: ./scripts/deploy.sh
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

**3.3 Reporter CI/CD**

Create `cv-analytics-reporter/.github/workflows/deploy.yml`:
```yaml
name: Deploy Reporter Service

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-infrastructure:
    needs: test
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infrastructure/reporter-infra
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      - name: Terraform Init
        run: terraform init
      - name: Terraform Plan
        run: terraform plan
      - name: Terraform Apply
        run: terraform apply -auto-approve
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

  deploy-lambda:
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - name: Deploy Lambda
        run: ./scripts/deploy.sh
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

**3.4 GitHub Secrets Setup**
```bash
# In each repo's Settings → Secrets → Actions
# Add:
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=us-east-1
```

#### Validation
```bash
# Create test branch
git checkout -b test-ci-cd

# Make trivial change
echo "# Test" >> README.md

# Push and create PR
git add . && git commit -m "Test CI/CD"
git push origin test-ci-cd

# Verify GitHub Actions runs:
# - Lint passes
# - Tests pass
# - Build succeeds
# - (PR doesn't deploy)

# Merge PR
# Verify GitHub Actions deploys to AWS
```

#### Rollback Procedure
```bash
# Delete workflows
rm -rf .github/workflows

# Continue manual deployments
```

---

### Phase 4: Service Communication Patterns
**Duration:** 2-3 hours  
**Risk:** MEDIUM (architectural changes)

#### Objectives
- Implement proper async communication (SQS, EventBridge)
- Add API Gateway for synchronous calls (if needed)
- Event-driven communication between services
- Proper error handling and retries

#### Current State
- Worker → Processor: Direct SQS write
- Processor → Reporter: Implicit (shared database)
- No APIs, all async

#### Target State
- Worker → Processor: SQS (event-driven) ✅ Already good
- Processor → Reporter: EventBridge events OR API
- Reporter → Processor: REST API for data queries (if needed)

#### Steps

**4.1 Processor Publishes Events**

**processor/services/event-publisher.ts**
```typescript
import { EventBridge } from '@aws-sdk/client-eventbridge';

export class EventPublisher {
  private eventBridge = new EventBridge();
  
  async publishCorrelationCompleted(correlation: Correlation) {
    await this.eventBridge.putEvents({
      Entries: [{
        Source: 'cv-analytics.processor',
        DetailType: 'CorrelationCompleted',
        Detail: JSON.stringify({
          correlationId: correlation.id,
          userId: correlation.userId,
          timestamp: correlation.timestamp,
          sessionDuration: correlation.duration
        }),
        EventBusName: 'cv-analytics-events'
      }]
    });
  }
}
```

**4.2 Reporter Consumes Events**

**reporter-infra/eventbridge.tf**
```hcl
resource "aws_cloudwatch_event_rule" "correlation_completed" {
  name        = "correlation-completed-rule"
  description = "Triggered when Processor completes correlation"
  
  event_pattern = jsonencode({
    source      = ["cv-analytics.processor"]
    detail-type = ["CorrelationCompleted"]
  })
}

resource "aws_cloudwatch_event_target" "reporter_lambda" {
  rule      = aws_cloudwatch_event_rule.correlation_completed.name
  target_id = "ReporterLambda"
  arn       = aws_lambda_function.reporter.arn
}
```

**4.3 Add API for Cross-Service Queries** (Optional)

**processor-infra/api-gateway.tf**
```hcl
resource "aws_api_gateway_rest_api" "processor_api" {
  name        = "processor-service-api"
  description = "Processor Service REST API"
}

resource "aws_api_gateway_resource" "correlations" {
  rest_api_id = aws_api_gateway_rest_api.processor_api.id
  parent_id   = aws_api_gateway_rest_api.processor_api.root_resource_id
  path_part   = "correlations"
}

resource "aws_api_gateway_method" "get_correlations" {
  rest_api_id   = aws_api_gateway_rest_api.processor_api.id
  resource_id   = aws_api_gateway_resource.correlations.id
  http_method   = "GET"
  authorization = "AWS_IAM"
}
```

**processor/src/api-handler.ts**
```typescript
export const apiHandler = async (event: APIGatewayEvent) => {
  const userId = event.queryStringParameters?.userId;
  
  if (!userId) {
    return { statusCode: 400, body: 'Missing userId' };
  }
  
  const correlations = await correlationRepo.getByUserId(userId);
  
  return {
    statusCode: 200,
    body: JSON.stringify(correlations)
  };
};
```

#### Validation
```bash
# Test event publishing
# Trigger Processor → Should publish CorrelationCompleted event

# Test API (if implemented)
curl -X GET "https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/correlations?userId=test"
```

---

### Phase 5: Observability & Monitoring
**Duration:** 2-3 hours  
**Risk:** LOW (additive changes)

#### Objectives
- Centralized logging per service
- Service-level metrics (latency, errors, throughput)
- Distributed tracing (X-Ray)
- Alerting on failures

#### Steps

**5.1 Enable X-Ray Tracing**

**All services (Terraform)**
```hcl
resource "aws_lambda_function" "processor" {
  # ... existing config
  
  tracing_config {
    mode = "Active"
  }
}
```

**All services (Code)**
```typescript
import AWSXRay from 'aws-xray-sdk-core';
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
```

**5.2 Custom Metrics**

**processor/services/metrics-service.ts**
```typescript
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

export class MetricsService {
  private cloudwatch = new CloudWatch();
  
  async recordCorrelationTime(durationMs: number) {
    await this.cloudwatch.putMetricData({
      Namespace: 'CVAnalytics/Processor',
      MetricData: [{
        MetricName: 'CorrelationDuration',
        Value: durationMs,
        Unit: 'Milliseconds',
        Timestamp: new Date()
      }]
    });
  }
}
```

**5.3 CloudWatch Dashboards**

**Create unified dashboard showing all 3 services:**
- Worker: Events ingested/sec, errors
- Processor: Correlation latency, SQS queue depth
- Reporter: Report generation time, email delivery rate

**5.4 Alarms**

```hcl
resource "aws_cloudwatch_metric_alarm" "processor_errors" {
  alarm_name          = "processor-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Processor Lambda errors > 10 in 5 min"
  
  dimensions = {
    FunctionName = aws_lambda_function.processor.function_name
  }
}
```

#### Validation
```bash
# Generate test traffic
# Check X-Ray console for traces
# Check CloudWatch dashboard
# Trigger alarm (intentionally cause errors)
```

---

## Success Criteria

### Phase 1 (Terraform)
- [ ] 3 separate Terraform directories created
- [ ] Each service's resources imported into new state
- [ ] `terraform plan` shows 0 changes for all services
- [ ] Cross-service references work via data sources

### Phase 2 (Databases)
- [ ] 3 separate DynamoDB tables created
- [ ] Worker writes to `cv-events-raw`
- [ ] Processor writes to `cv-events-processed`
- [ ] Reporter reads via API or replica
- [ ] Old table still receives writes (dual-write)
- [ ] Data consistency validated

### Phase 3 (CI/CD)
- [ ] GitHub Actions workflows in all 3 repos
- [ ] PRs trigger: lint, test, build
- [ ] Merges trigger: deploy infrastructure + code
- [ ] All pipelines green ✅

### Phase 4 (Communication)
- [ ] Processor publishes EventBridge events
- [ ] Reporter subscribes to events
- [ ] API Gateway configured (if using sync calls)
- [ ] Event flow validated end-to-end

### Phase 5 (Observability)
- [ ] X-Ray tracing enabled
- [ ] Custom metrics published
- [ ] CloudWatch dashboard created
- [ ] Alarms configured and tested

---

## Learning Outcomes

By completing this migration, you will gain hands-on experience with:

1. **Terraform State Management**
   - Splitting monolithic states
   - Cross-state references with data sources
   - State migration strategies

2. **Database Patterns**
   - Database-per-service pattern
   - Data migration strategies (dual-write, bulk)
   - Cross-service data access (APIs vs replication)

3. **CI/CD for Microservices**
   - Independent deployment pipelines
   - Infrastructure-as-code automation
   - Testing strategies per service

4. **Event-Driven Architecture**
   - Async communication (SQS, EventBridge)
   - Event publishing/subscribing patterns
   - Event schema design

5. **Observability**
   - Distributed tracing with X-Ray
   - Service-level metrics
   - Centralized logging and alerting

6. **Operational Complexity**
   - Managing multiple repositories
   - Coordinating deployments
   - Debugging across service boundaries

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 0: Preparation | 30 min | 30 min |
| Phase 1: Terraform | 3 hours | 3.5 hours |
| Phase 2: Databases | 5 hours | 8.5 hours |
| Phase 3: CI/CD | 4 hours | 12.5 hours |
| Phase 4: Communication | 2 hours | 14.5 hours |
| Phase 5: Observability | 2 hours | **16.5 hours total** |

**Recommendation:** Tackle one phase per day over 5 days for best learning retention.

---

## Next Steps

**Ready to proceed?** Let's start with Phase 1: Separate Terraform States.

**Command to start:**
```bash
# Create backup of current Terraform state
cd d:\Code\MyCV\cv-analytics-infrastructure\terraform
terraform state pull > backup-pragmatic-microservices-$(Get-Date -Format 'yyyyMMdd-HHmmss').json

# Verify backup
cat backup-pragmatic-microservices-*.json | head -20
```

**Questions to answer before proceeding:**
1. Do you want to keep shared infrastructure (e.g., VPC, common IAM)? Or fully separate?
2. For Reporter data access: API pattern or read replica pattern?
3. Should we automate the entire migration or go phase-by-phase with manual validation?

Let me know when you're ready to start Phase 1! 🚀
