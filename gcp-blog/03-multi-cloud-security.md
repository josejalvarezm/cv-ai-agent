# Multi-Cloud Security: HMAC, IAM, and Secrets Management

*Securing cross-cloud webhooks with HMAC-SHA256, enforcing least-privilege IAM policies across AWS and GCP, managing secrets in GitHub Actions, and protecting databases with Firestore security rules, all validated under real attack attempts.*

- [Quick Summary](#quick-summary)
- [Introduction](#introduction)
- [Cross-Cloud Webhook Authentication: HMAC Signatures](#cross-cloud-webhook-authentication-hmac-signatures)
- [Cloudflare Worker Authentication to AWS](#cloudflare-worker-authentication-to-aws)
- [GCP IAM: Service Accounts and Roles](#gcp-iam-service-accounts-and-roles)
- [AWS IAM: Roles and Policies](#aws-iam-roles-and-policies)
- [Secrets Management: Multi-Cloud Strategy](#secrets-management-multi-cloud-strategy)
- [Database Security](#database-security)
- [Encryption](#encryption)
- [Audit Logging and Monitoring](#audit-logging-and-monitoring)
- [Practical Takeaways](#practical-takeaways)
- [What's Next](#whats-next)
- [Further Reading](#further-reading)

## Quick Summary

- ✓ **HMAC-SHA256** validates webhook authenticity (no replay attacks)
- ✓ **GCP service accounts** and **AWS IAM roles** enforce least privilege
- ✓ **GitHub Secrets** manage credentials securely in CI/CD
- ✓ **Firestore security rules** protect database access
- ✓ **Encryption** at-rest and in-transit across both clouds

---

## Introduction

Security isn't a feature you add at the end. It's a foundation you build from the start.

Multi-cloud microservices multiply the attack surface across three clouds. **Cloudflare Workers** need IAM credentials to write to AWS DynamoDB. **AWS Lambda** needs HMAC signatures to authenticate when calling **GCP Cloud Functions**. Cloud Functions and Lambda need IAM roles to limit permissions. Databases need security rules to control access. Secrets need secure storage across three providers (AWS Secrets Manager, GCP Secret Manager, Cloudflare environment variables). Each cloud provider has different security mechanisms, patterns, and best practices.

CV Analytics implements defense in depth: multiple security layers that work together across three clouds. **Cloudflare Workers** use AWS IAM credentials to write events securely. **AWS Lambda** signs webhook payloads with HMAC-SHA256 before sending to GCP. **GCP Cloud Functions** validate HMAC signatures from AWS Lambda. Service accounts and IAM roles enforce least privilege within each cloud. GitHub Secrets store cross-cloud credentials securely in CI/CD pipelines. Firestore security rules and DynamoDB policies control database access. Encryption protects data at-rest and in-transit.

**The complete security flow:**

1. **Angular app** → **Cloudflare Worker** (user authentication, if needed)
2. **Cloudflare Worker** → **AWS DynamoDB** (IAM role authentication)
3. **AWS Lambda** → **GCP Cloud Function** (HMAC-SHA256 signed webhook)
4. **GCP Cloud Function** → **Firestore** (GCP service account)
5. **React Dashboard** → **Firestore** (Firebase Authentication)

This post explains the security patterns used in CV Analytics: how IAM credentials authenticate Cloudflare Workers writing to AWS, how HMAC-SHA256 prevents cross-cloud webhook spoofing between AWS and GCP, how service accounts enforce least privilege, how GitHub Secrets manage multi-cloud credentials in automated deployments, and how database security rules protect sensitive data.

**What you'll learn:**

- ✓ How Cloudflare Workers authenticate to AWS DynamoDB (IAM credentials)
- ✓ How HMAC signatures authenticate cross-cloud webhooks (AWS Lambda → GCP Cloud Function)
- ✓ How GCP service accounts and AWS IAM roles enforce least privilege
- ✓ How to store secrets across three clouds (AWS, GCP, Cloudflare)
- ✓ How GitHub Secrets secure multi-cloud credentials in CI/CD pipelines
- ✓ How Firestore security rules and DynamoDB policies control data access
- ✓ How encryption protects data at-rest and in-transit across three clouds

---

## Cross-Cloud Webhook Authentication: HMAC Signatures

### The Cross-Cloud Security Problem

**The architecture:** AWS Lambda processes chatbot analytics, then needs to notify GCP Cloud Function to update Firestore (which triggers real-time dashboard updates). This requires AWS Lambda to call a public GCP Cloud Function URL across cloud boundaries.

**The security challenge:** GCP Cloud Function URLs are publicly accessible. Without authentication, anyone could:

**Spoof events:** Send fake analytics data pretending to be from AWS Lambda. Your Firestore database fills with garbage, dashboard shows wrong data.

**Replay attacks:** Capture a legitimate webhook payload from AWS Lambda and resend it 1,000 times. Your system processes the same analytics event repeatedly.

**DoS attacks:** Flood your GCP endpoint with fake webhooks, overwhelming your Cloud Function and exhausting your free tier quota.

**Why not use cloud-native auth?** AWS IAM and GCP IAM don't talk to each other. You can't give AWS Lambda a GCP service account, and you can't configure GCP Cloud Functions to trust AWS IAM roles. Cross-cloud authentication requires a shared secret.

### HMAC-SHA256: Cross-Cloud Authentication

HMAC (Hash-based Message Authentication Code) creates a cryptographic signature from a message and a secret key. The same message and key always produce the same signature. Without the key, you can't forge the signature.

**The shared secret:** Both AWS Lambda (sender) and GCP Cloud Function (receiver) have the same secret key:

- **AWS:** Stored in AWS Secrets Manager
- **GCP:** Stored in GCP Secret Manager
- **Secret value:** Random 256-bit key (never committed to Git)

**AWS Lambda's process (sender):**

1. Lambda retrieves shared secret from AWS Secrets Manager
2. Lambda prepares JSON payload with analytics data
3. Lambda computes: `signature = HMAC-SHA256(payload, secret)`
4. Lambda includes signature in `X-Webhook-Signature` header (format: `sha256=<hex>`)
5. Lambda sends HTTP POST to GCP Cloud Function URL

**GCP Cloud Function's process (receiver):**

1. Receive HTTP POST request
2. Extract payload body (raw bytes, not parsed JSON)
3. Extract `X-Webhook-Signature` header (format: `sha256=<hex_signature>`)
4. Retrieve shared secret from GCP Secret Manager
5. Compute: `expected_signature = HMAC-SHA256(payload, secret)`
6. Compare `expected_signature` with header signature (constant-time comparison)
7. If they match exactly → Process analytics, write to Firestore
8. If they don't match → Return HTTP 401, log the attempt, alert monitoring

**Critical implementation details:**

**Use raw payload bytes:** Compute HMAC on the exact bytes AWS Lambda sent. If you parse JSON first and re-serialize, the bytes might differ (whitespace, key order). HMAC will fail.

**Use constant-time comparison:** Don't use `==` to compare signatures. It's vulnerable to timing attacks. Use `hmac.Equal()` (Go) or `crypto.timingSafeEqual()` (Node.js).

**Include the algorithm prefix:** Header format is `sha256=abc123...`. Strip the `sha256=` prefix before comparing.

**Cost:** HMAC validation is pure cryptography. Zero cost. No third-party service needed.

### Code Example: Go Cloud Function

```go
package webhook

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
    "os"
    "strings"
)

// WebhookHandler validates GitHub webhooks and writes to Firestore
func WebhookHandler(w http.ResponseWriter, r *http.Request) {
    // Only accept POST requests
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Read raw payload body (needed for HMAC validation)
    payload, err := io.ReadAll(r.Body)
    if err != nil {
        log.Printf("Failed to read request body: %v", err)
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }
    defer r.Body.Close()

    // Extract AWS Lambda webhook signature from header
    lambdaSignature := r.Header.Get("X-Webhook-Signature")
    if lambdaSignature == "" {
        log.Printf("Missing X-Webhook-Signature header")
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // Validate HMAC signature (shared secret with AWS Lambda)
    webhookSecret := os.Getenv("WEBHOOK_SHARED_SECRET")
    if !validateHMAC(payload, githubSignature, webhookSecret) {
        log.Printf("HMAC validation failed for signature: %s", githubSignature)
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // Signature valid, parse JSON payload
    var webhookData map[string]interface{}
    if err := json.Unmarshal(payload, &webhookData); err != nil {
        log.Printf("Failed to parse JSON: %v", err)
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }

    // Process webhook (write to Firestore, etc.)
    log.Printf("Valid webhook received: %v", webhookData["action"])
    
    // In production: write validated webhook data to Firestore
    // For this example, we've validated the signature successfully
    
    w.WriteHeader(http.StatusOK)
    fmt.Fprintf(w, "Webhook processed successfully")
}

// validateHMAC computes HMAC-SHA256 and compares with AWS Lambda's signature
func validateHMAC(payload []byte, lambdaSignature string, secret string) bool {
    // AWS Lambda signature format: "sha256=<hex_digest>"
    // Strip the "sha256=" prefix
    if !strings.HasPrefix(lambdaSignature, "sha256=") {
        return false
    }
    signatureHex := strings.TrimPrefix(lambdaSignature, "sha256=")

    // Compute HMAC-SHA256 of payload with secret
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expectedMAC := mac.Sum(nil)
    expectedHex := hex.EncodeToString(expectedMAC)

    // Constant-time comparison (prevents timing attacks)
    // hmac.Equal() is timing-safe
    return hmac.Equal([]byte(expectedHex), []byte(signatureHex))
}
```

**Key security practices:**

**Environment variables for secrets:** Never hardcode the webhook secret. Use `os.Getenv("WEBHOOK_SHARED_SECRET")` to read from GCP Secret Manager (accessed as environment variable via Terraform).

**Log failed attempts:** Log HMAC validation failures with timestamps and source IPs. Monitor for repeated failures (indicates attack attempts).

**Return 401, not 403:** HTTP 401 (Unauthorized) means "authentication failed". HTTP 403 (Forbidden) means "authenticated but not authorized". Use 401 for HMAC failures.

**Don't leak information:** When HMAC fails, don't tell the attacker why. Return generic "Unauthorized" message. Log details server-side.

### Preventing Replay Attacks

HMAC validates that AWS Lambda sent the webhook, but it doesn't prevent replay attacks. An attacker could capture a legitimate webhook and resend it.

**Solution: Timestamp validation**

AWS Lambda includes a `timestamp` field (Unix seconds) in the webhook payload. Validate that the timestamp is recent (within 5 minutes). Reject old webhooks.

```go
func validateTimestamp(webhookData map[string]interface{}) bool {
    // Extract timestamp from payload (if present)
    timestamp, ok := webhookData["timestamp"].(float64)
    if !ok {
        // No timestamp in payload, reject for security
        // (AWS Lambda should always include timestamp)
        return false
    }

    now := time.Now().Unix()
    age := now - int64(timestamp)

    // Reject webhooks older than 5 minutes (300 seconds)
    if age > 300 || age < -300 {
        log.Printf("Webhook too old or future-dated: %d seconds", age)
        return false
    }

    return true
}
```

**Alternative: Idempotency keys**

Store processed webhook IDs (requestId from AWS Lambda payload) in Firestore or Memorystore. When a webhook arrives, check if you've processed it before. If yes, return HTTP 200 but don't process again. This prevents duplicate processing from any source (replay attacks or legitimate AWS Lambda retries).

### Secret Rotation Strategies

Webhook shared secrets should rotate periodically (every 90 days) to limit exposure if compromised.

**Cross-cloud rotation process:**

1. Generate new secret (32+ random bytes)
2. Update secret in **both clouds simultaneously**:
   - AWS Secrets Manager: `cv-analytics/webhook-secret`
   - GCP Secret Manager: `webhook-shared-secret`
3. Redeploy AWS Lambda Processor (reads new secret from AWS Secrets Manager)
4. Redeploy GCP Cloud Function (reads new secret from GCP Secret Manager)
5. Test webhook delivery end-to-end
6. Delete old secret versions from both clouds

**Zero-downtime rotation:**

Support two secrets simultaneously during rotation. Validate against both old and new secrets for 24 hours, then remove the old one.

```go
func validateHMACWithRotation(payload []byte, signature string) bool {
    oldSecret := os.Getenv("WEBHOOK_SHARED_SECRET_OLD")
    newSecret := os.Getenv("WEBHOOK_SHARED_SECRET_NEW")

    // Try new secret first
    if newSecret != "" && validateHMAC(payload, signature, newSecret) {
        return true
    }

    // Fall back to old secret during rotation period
    if oldSecret != "" && validateHMAC(payload, signature, oldSecret) {
        log.Printf("Validated with old secret (rotation in progress)")
        return true
    }

    return false
}
```

```mermaid
sequenceDiagram
    participant Lambda as AWS Lambda<br/>(Processor)
    participant CF as GCP Cloud Function<br/>(Webhook Receiver)
    participant FS as Firestore<br/>(Database)
    
    Lambda->>Lambda: Read secret from<br/>AWS Secrets Manager
    Lambda->>Lambda: Compute signature<br/>HMAC-SHA256(payload, secret)
    Lambda->>CF: POST https://<region>-<project>.cloudfunctions.net<br/>X-Webhook-Signature: sha256=abc123...
    
    CF->>CF: Read raw payload bytes
    CF->>CF: Extract signature from header
    CF->>CF: Read secret from<br/>GCP Secret Manager
    CF->>CF: Compute expected signature<br/>HMAC-SHA256(payload, secret)
    
    alt Signatures match
        CF->>CF: Parse JSON payload
        CF->>FS: Write analytics data
        CF->>Lambda: 200 OK
    else Signatures don't match
        CF->>CF: Log failed attempt<br/>(timestamp, source IP)
        CF->>Lambda: 401 Unauthorized
        Note over CF,Lambda: Cross-cloud security failure<br/>Alert DevOps team
    end
    
    style CF fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style FS fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
```

---

## Cloudflare Worker Authentication to AWS

### The Edge-to-Cloud Security Challenge

**The architecture:** Cloudflare Worker runs at the edge (250+ global locations) and processes CV chatbot queries in 12ms. After returning the answer to the user, it needs to write analytics events to AWS DynamoDB (us-east-1) for later processing by AWS Lambda.

**The constraint:** Cloudflare Workers have a **50ms CPU time limit**. Every millisecond counts. Fire-and-forget pattern required: Worker writes to DynamoDB but doesn't wait for Lambda processing.

**The security challenge:** How does a Cloudflare Worker authenticate to AWS DynamoDB across cloud boundaries without storing long-lived IAM keys in code?

### IAM Credentials in Cloudflare Environment Variables

**Solution:** Store AWS IAM credentials as **Cloudflare Worker secrets** (encrypted environment variables). The Worker uses these credentials to sign AWS API requests with IAM Signature Version 4 (SigV4).

**AWS IAM user for Cloudflare Worker:**

```json
// AWS IAM Policy: cv-chatbot-worker-policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789:table/cv-analytics-queries"
    }
  ]
}
```

**Least privilege principle:**

- ✅ Only `PutItem` (can't read existing data or delete)
- ✅ Only on Query Events table (can't access Analytics table)
- ✅ No Lambda permissions, no S3, no other AWS services
- ✅ If Worker credentials leak, damage limited to fake query events (not analytics or financial data)

### Setting Cloudflare Worker Secrets

```bash
# Set AWS IAM credentials (encrypted by Cloudflare)
wrangler secret put AWS_ACCESS_KEY_ID
# Enter: AKIA... (IAM access key)

wrangler secret put AWS_SECRET_ACCESS_KEY
# Enter: (40-character secret key)

wrangler secret put AWS_REGION
# Enter: us-east-1
```

**Worker code (TypeScript):**

```typescript
// cv-chatbot-worker/src/index.ts
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Process chatbot query (semantic search, LLM)
    const answer = await processQuery(request);
    
    // Write analytics event to AWS DynamoDB (fire-and-forget)
    const dynamodb = new DynamoDBClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    // Don't await - fire-and-forget to stay under 50ms CPU limit
    dynamodb.send(new PutItemCommand({
      TableName: 'cv-analytics-queries',
      Item: {
        requestId: { S: crypto.randomUUID() },
        timestamp: { N: String(Date.now()) },
        query: { S: request.body.query },
        // ... other fields
      },
    })).catch(err => console.error('DynamoDB write failed:', err));
    
    // Return answer immediately (don't wait for DynamoDB)
    return Response.json({ answer });
  }
};
```

**Key security practices:**

- **Environment variables, not hardcoded:** Never commit AWS credentials to git. Use `wrangler secret put` to encrypt and store in Cloudflare's infrastructure.
- **Fire-and-forget pattern:** Worker doesn't wait for DynamoDB response. If write fails, logs error but doesn't block user response. Acceptable for analytics (occasional missing events OK).
- **IAM key rotation:** Rotate AWS IAM keys every 90 days. Update Cloudflare secrets via `wrangler secret put` (zero downtime).
- **Monitor failed writes:** CloudWatch Logs captures DynamoDB `PutItem` failures. Alert if failure rate exceeds 1% (indicates credential or network issues).

### Why Not AWS Cognito or OIDC?

**Alternative:** AWS Cognito Identity Pools or OIDC token exchange could avoid long-lived IAM keys. But:

- ❌ **Latency:** Token exchange adds 50-100ms (unacceptable for 12ms Worker)
- ❌ **Complexity:** Requires Cognito setup, token refresh logic, error handling
- ❌ **Cost:** Cognito Identity Pool charges per token exchange
- ✅ **IAM credentials:** Simple, zero latency, £0 cost, acceptable risk with least privilege

**Risk mitigation:** If IAM credentials leak, attacker can only write fake events to Query Events table. Can't read Analytics table, can't access other AWS services, can't escalate privileges. DynamoDB TTL (24 hours) limits damage. Monitor CloudWatch Logs for unusual write patterns (e.g., 10,000 events in 1 minute).

---

## GCP IAM: Service Accounts and Roles

### Understanding GCP Service Accounts

GCP service accounts are special Google accounts representing applications, not humans. They enable secure, programmatic access to GCP resources without storing credentials in code.

**Key concepts:**

**Identity:** A service account has an email address (e.g., `webhook-receiver@project-id.iam.gserviceaccount.com`) and unique ID.

**Authentication:** Services authenticate as a service account using:

- Service account keys (JSON files, avoid in production)
- Workload Identity Federation (preferred for GitHub Actions)
- Default Application Credentials (automatic in GCP services)

**Authorization:** IAM roles grant permissions to service accounts. Roles are collections of permissions (e.g., `roles/datastore.user` grants Firestore read/write).

### Least Privilege Principle

Grant the minimum permissions required for a service to function. Don't use `roles/owner` or `roles/editor` (too broad). Use specific roles like `roles/cloudfunctions.invoker` or `roles/datastore.user`.

**CV Analytics service accounts:**

**Webhook Receiver Cloud Function:**

- Role: `roles/datastore.user` (read/write Firestore documents)
- Why: Function writes webhook data to Firestore, doesn't need broader access
- Doesn't need: Cloud Functions deployment, Firebase Hosting, other services

**GitHub Actions (for deployment):**

- Role: `roles/cloudfunctions.developer` (deploy Cloud Functions)
- Role: `roles/iam.serviceAccountUser` (act as service account)
- Role: `roles/firebase.admin` (deploy Firebase Hosting)
- Why: CI/CD needs deployment permissions, not runtime permissions
- Doesn't need: Firestore data access, other resources

**Dashboard (Firebase Hosting):**

- No service account needed
- Firebase Authentication handles user identity
- Firestore security rules control data access

### Creating Service Accounts with Terraform

```hcl
# Terraform: Create service account for Cloud Function
resource "google_service_account" "webhook_receiver" {
  account_id   = "webhook-receiver"
  display_name = "Webhook Receiver Cloud Function"
  description  = "Service account for AWS Lambda webhook receiver (cross-cloud analytics)"
  project      = var.project_id
}

# Grant Firestore access
resource "google_project_iam_member" "webhook_firestore_access" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.webhook_receiver.email}"
}

# Assign service account to Cloud Function
resource "google_cloudfunctions_function" "webhook_receiver" {
  name                  = "webhook-receiver"
  runtime              = "go121"
  entry_point          = "WebhookHandler"
  service_account_email = google_service_account.webhook_receiver.email
  
  # ... other configuration
}
```

### Service Account Keys: Why to Avoid

Service account keys are JSON files containing private keys. If leaked, an attacker gains full access to the service account's permissions.

**Problems:**

- Keys don't expire automatically (manual rotation required)
- Keys can be accidentally committed to git
- Keys can be stolen from developer machines
- Keys are hard to audit (who has copies?)

**Better alternatives:**

**Workload Identity Federation (for GitHub Actions):**
GitHub Actions authenticates to GCP without keys. GitHub provides OIDC tokens that GCP trusts.

**Default Application Credentials (for GCP services):**
Cloud Functions automatically authenticate as their service account. No keys needed.

**Code example (no keys required):**

```go
import (
    "cloud.google.com/go/firestore"
    "context"
)

func writeToFirestore() error {
    ctx := context.Background()
    
    // Automatically uses Cloud Function's service account
    // No keys, no credentials in code
    client, err := firestore.NewClient(ctx, "project-id")
    if err != nil {
        return err
    }
    defer client.Close()
    
    // Write data (authorized by IAM role)
    _, err = client.Collection("analytics").Doc("test").Set(ctx, map[string]interface{}{
        "message": "Hello from Cloud Function",
    })
    return err
}
```

### IAM Role Reference for CV Analytics

**roles/cloudfunctions.developer:**

- Permissions: Deploy and update Cloud Functions
- Used by: GitHub Actions CI/CD pipeline
- Scope: Project-level

**roles/datastore.user:**

- Permissions: Read and write Firestore documents
- Used by: Webhook receiver Cloud Function
- Scope: Project-level

**roles/firebase.admin:**

- Permissions: Deploy to Firebase Hosting, configure Firebase
- Used by: GitHub Actions CI/CD pipeline
- Scope: Project-level

**roles/iam.serviceAccountUser:**

- Permissions: Act as a service account (impersonation)
- Used by: GitHub Actions to deploy Cloud Functions as specific service accounts
- Scope: Service account resource

---

## AWS IAM: Roles and Policies

### Understanding AWS IAM Roles

AWS IAM roles are identities with permission policies. Unlike IAM users (permanent credentials), roles provide temporary security credentials. Lambda functions assume roles to access AWS resources.

**Key concepts:**

**Trust policy:** Defines who can assume the role (e.g., Lambda service principal)

**Permission policy:** Defines what the role can do (e.g., read DynamoDB, write to SQS)

**Temporary credentials:** When Lambda assumes a role, it gets temporary access keys (valid for duration of invocation)

**Role assumption flow:**

1. Lambda function starts
2. Lambda service calls STS AssumeRole API
3. STS validates trust policy
4. STS returns temporary credentials
5. Lambda uses credentials to access DynamoDB, SQS, etc.
6. Credentials expire when function completes

### Lambda Execution Roles

Every Lambda function has an execution role. This role grants permissions for the function to access AWS services.

**CV Analytics Lambda roles:**

**Processor Lambda:**

- Read messages from SQS queue
- Write results to DynamoDB table
- Write logs to CloudWatch Logs

**Reporter Lambda:**

- Read aggregated data from DynamoDB table
- Send emails via AWS SES
- Write logs to CloudWatch Logs

### IAM Policy Example: Processor Lambda

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadFromSQS",
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:eu-west-2:123456789012:cv-analytics-processor"
    },
    {
      "Sid": "WriteToDynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:eu-west-2:123456789012:table/cv-analytics-aggregated"
    },
    {
      "Sid": "WriteLogsToCloudWatch",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:eu-west-2:123456789012:log-group:/aws/lambda/cv-analytics-processor:*"
    }
  ]
}
```

**Key principles:**

**Specific resources:** Use exact ARNs, not wildcards (`*`). This limits access to specific tables and queues.

**Minimum actions:** Only grant actions the function actually uses. Don't grant `dynamodb:*` if you only need `PutItem` and `GetItem`.

**Separate policies per concern:** One policy for SQS, one for DynamoDB, one for CloudWatch. Easier to audit and modify.

### Creating IAM Roles with Terraform

```hcl
# Terraform: Create Lambda execution role
resource "aws_iam_role" "processor_lambda_role" {
  name = "cv-analytics-processor-lambda-role"

  # Trust policy: Allow Lambda service to assume this role
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Attach permission policy to role
resource "aws_iam_role_policy" "processor_lambda_policy" {
  name = "cv-analytics-processor-policy"
  role = aws_iam_role.processor_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.processor_queue.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.analytics.arn
      }
    ]
  })
}

# Attach AWS managed policy for CloudWatch Logs
resource "aws_iam_role_policy_attachment" "processor_lambda_logs" {
  role       = aws_iam_role.processor_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Assign role to Lambda function
resource "aws_lambda_function" "processor" {
  function_name = "cv-analytics-processor"
  role          = aws_iam_role.processor_lambda_role.arn
  runtime       = "nodejs18.x"
  handler       = "index.handler"
  
  # ... other configuration
}
```

### EventBridge Role Assumptions

EventBridge needs permissions to send events to SQS queues. This requires a resource-based policy on the SQS queue granting EventBridge access.

**SQS queue policy:**

```hcl
# Allow EventBridge to send messages to SQS queue
resource "aws_sqs_queue_policy" "processor_queue_policy" {
  queue_url = aws_sqs_queue.processor_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action = "sqs:SendMessage"
        Resource = aws_sqs_queue.processor_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.dynamodb_streams.arn
          }
        }
      }
    ]
  })
}
```

**Security note:** The `Condition` block limits access to a specific EventBridge rule. Without this, any EventBridge rule could send to your queue.

```mermaid
sequenceDiagram
    participant LAMBDA as Lambda Function<br/>(Processor)
    participant STS as AWS STS<br/>(Security Token Service)
    participant SQS as SQS Queue
    participant DDB as DynamoDB Table
    participant CW as CloudWatch Logs
    
    LAMBDA->>STS: AssumeRole<br/>(Lambda execution role)
    STS->>STS: Validate trust policy<br/>(Lambda service principal)
    STS->>LAMBDA: Temporary credentials<br/>(Access Key + Secret + Token)
    
    LAMBDA->>SQS: ReceiveMessage<br/>(using temp credentials)
    SQS->>SQS: Check IAM policy<br/>(sqs:ReceiveMessage allowed?)
    SQS->>LAMBDA: Return messages
    
    LAMBDA->>DDB: PutItem<br/>(using temp credentials)
    DDB->>DDB: Check IAM policy<br/>(dynamodb:PutItem allowed?)
    DDB->>LAMBDA: Success
    
    LAMBDA->>CW: PutLogEvents<br/>(using temp credentials)
    CW->>LAMBDA: Success
    
    Note over LAMBDA,CW: Credentials expire<br/>after function completes
    
    style STS fill:#fff3e0,stroke:#f57c00,stroke-width:3px
    style SQS fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style DDB fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style CW fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
```

---

## Secrets Management: Multi-Cloud Strategy

### The Secrets Challenge

Microservices across 3 clouds need credentials and shared secrets. These must be stored securely, never committed to git, accessible only to authorized services, and synchronized across cloud providers.

**Three types of secrets:**

1. **Cross-cloud shared secrets:** HMAC webhook secret (AWS Secrets Manager + GCP Secret Manager)
2. **Cloud-specific credentials:** Cloudflare Worker IAM keys (environment variables), AWS IAM access keys, GCP service account keys
3. **CI/CD secrets:** GitHub Secrets for deployment automation (stores credentials for all 3 clouds)

### AWS Secrets Manager (Runtime Secrets)

**AWS Lambda Processor needs:**

1. **HMAC Webhook Shared Secret**
   - Secret name: `cv-analytics/webhook-secret`
   - Used by: Lambda Processor when calling GCP Cloud Function
   - Rotation: Every 90 days (coordinated with GCP)
   - Access: Lambda execution role with `secretsmanager:GetSecretValue`

2. **DynamoDB Table Names** (not sensitive, but centralized)
   - Secret name: `cv-analytics/config`
   - JSON: `{"queryTable": "cv-analytics-queries", "analyticsTable": "cv-analytics-analytics"}`

**Creating secrets with AWS CLI:**

```bash
# Create webhook shared secret
aws secretsmanager create-secret \
  --name cv-analytics/webhook-secret \
  --description "HMAC shared secret for AWS Lambda → GCP Cloud Function webhooks" \
  --secret-string "$(openssl rand -hex 32)"

# Grant Lambda access
aws secretsmanager put-resource-policy \
  --secret-id cv-analytics/webhook-secret \
  --resource-policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::123456789:role/lambda-processor-role"},"Action":"secretsmanager:GetSecretValue"}]}'
```

### GCP Secret Manager (Runtime Secrets)

**GCP Cloud Function needs:**

1. **HMAC Webhook Shared Secret** (same value as AWS)
   - Secret name: `webhook-shared-secret`
   - Used by: Cloud Function to validate AWS Lambda signatures
   - Rotation: Every 90 days (coordinated with AWS)
   - Access: Cloud Function service account with `secretmanager.secretAccessor`

**Creating secrets with gcloud CLI:**

```bash
# Create webhook shared secret (MUST match AWS secret value)
echo -n "<same-32-byte-hex-from-aws>" | gcloud secrets create webhook-shared-secret \
  --data-file=- \
  --replication-policy="automatic" \
  --labels="service=webhook-receiver,cloud=gcp"

# Grant Cloud Function access
gcloud secrets add-iam-policy-binding webhook-shared-secret \
  --member="serviceAccount:webhook-receiver@project-id.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Cloudflare Worker Secrets (Environment Variables)

**CV Chatbot Worker needs:**

1. **AWS IAM Credentials** (for DynamoDB writes)
   - Variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - Used by: Worker to write query events to DynamoDB
   - IAM Policy: Least privilege (only `dynamodb:PutItem` on Query Events table)

**Setting Cloudflare Worker secrets:**

```bash
# Set environment variables (encrypted by Cloudflare)
wrangler secret put AWS_ACCESS_KEY_ID
wrangler secret put AWS_SECRET_ACCESS_KEY
wrangler secret put AWS_REGION
```

### GitHub Secrets (CI/CD Deployment)

**Deployment credentials for all 6 services across 4 repositories:**

**Dashboard repository (React + Firebase Hosting):**

- `FIREBASE_TOKEN`: Firebase CLI authentication token
- `GCP_PROJECT_ID`: GCP project identifier

**Webhook Receiver repository (Go Cloud Function):**

- `GCP_SA_KEY`: GCP service account JSON key (or Workload Identity Federation)
- `GCP_PROJECT_ID`: GCP project identifier
- `WEBHOOK_SECRET_NAME`: Secret Manager secret name (`webhook-shared-secret`)

**Processor repository (Node.js Lambda - AWS):**

- `AWS_ACCESS_KEY_ID`: AWS credentials for Lambda deployment
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: Deployment region

**Reporter repository (Node.js Lambda - AWS):**

- `AWS_ACCESS_KEY_ID`: AWS credentials for Lambda deployment
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: Deployment region

### Creating GitHub Secrets

**Step 1: Navigate to repository settings**

- Go to repository → Settings → Secrets and variables → Actions
- Click "New repository secret"

**Step 2: Add secret**

- Name: `FIREBASE_TOKEN` (uppercase, underscores only)
- Value: Paste token value (no quotes, no whitespace)
- Click "Add secret"

**Step 3: Verify secret is hidden**

- Secret values are never displayed after creation
- Workflows can access via `${{ secrets.FIREBASE_TOKEN }}`
- Secret values don't appear in logs (GitHub automatically masks them)

### Accessing Secrets in GitHub Actions Workflows

**Dashboard deployment workflow:**

```yaml
name: Deploy Dashboard
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Firebase Hosting
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
        run: |
          npm install -g firebase-tools
          firebase deploy --only hosting --token "$FIREBASE_TOKEN"
```

**Key points:**

**Environment variables:** Secrets are accessed as `${{ secrets.SECRET_NAME }}` and passed to steps as environment variables.

**Log masking:** GitHub automatically replaces secret values with `***` in logs. Never use `echo "$SECRET"` as this bypasses masking.

**Scope:** Secrets are scoped to the repository. Cross-repository access requires organization-level secrets.

### Never Commit Secrets to Git

**Common mistakes:**

`.env` files committed to git:

```bash
# WRONG: Committed to repository
# .env
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Solution:** Add `.env` to `.gitignore`:

```bash
# .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
```

**Hardcoded credentials in code:**

```javascript
// WRONG: Hardcoded secret
const apiKey = 'sk-1234567890abcdef';

// RIGHT: Environment variable
const apiKey = process.env.API_KEY;
```

**Service account keys in repositories:**

```bash
# WRONG: Service account key committed
gcp-service-account-key.json

# RIGHT: Add to .gitignore
*.json # All JSON files (if they contain keys)
service-account-*.json # Specific pattern
```

**If you accidentally commit a secret:**

1. **Rotate the secret immediately** (generate new credentials, invalidate old ones)
2. **Remove from git history** (use `git filter-branch` or BFG Repo-Cleaner)
3. **Update GitHub Secrets** with new values
4. **Audit access logs** to check if secret was used maliciously

### Secret Rotation Procedures

**Rotate secrets periodically** (every 90 days recommended) or immediately after:

- Team member leaves
- Secret possibly leaked
- Security incident
- Compliance requirement

**Rotation steps (AWS example):**

1. **Generate new credentials:**
   - AWS Console → IAM → Users → Security credentials → Create access key
   - Copy new `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

2. **Update GitHub Secrets:**
   - Repository → Settings → Secrets → Edit `AWS_ACCESS_KEY_ID`
   - Paste new value → Update secret
   - Repeat for `AWS_SECRET_ACCESS_KEY`

3. **Test deployment:**
   - Trigger workflow manually or push commit
   - Verify deployment succeeds with new credentials

4. **Deactivate old credentials:**
   - AWS Console → IAM → Users → Security credentials
   - Find old access key → Make inactive → Delete

5. **Document rotation:**
   - Record date in internal documentation
   - Set reminder for next rotation (90 days)

```mermaid
graph LR
    GH[GitHub Actions<br/>Workflow] -->|Reads secrets| SEC[GitHub Secrets<br/>Encrypted Storage]
    SEC -->|FIREBASE_TOKEN| FB[Firebase CLI<br/>Deploy Dashboard]
    SEC -->|GCP_SA_KEY| GCP[GCP Cloud Functions<br/>Deploy Webhook]
    SEC -->|AWS Credentials| AWS[AWS Lambda<br/>Deploy Processor/Reporter]
    
    FB -->|Deploy| FBH[Firebase Hosting]
    GCP -->|Deploy| CF[Cloud Functions]
    AWS -->|Deploy| LAM[Lambda Functions]
    
    style GH fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style SEC fill:#fff3e0,stroke:#f57c00,stroke-width:3px
    style FB fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style GCP fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style AWS fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
```

---

## Database Security

### Firestore Security Rules

Firestore security rules control client access to data. Rules are evaluated server-side before read/write operations. They protect against unauthorized access from compromised frontend code.

**CV Analytics Firestore rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Analytics data collection
    match /analytics/{documentId} {
      // Allow authenticated users to read analytics
      allow read: if request.auth != null;
      
      // Only Cloud Functions can write (not clients)
      // Cloud Functions use service accounts, not Firebase Auth
      allow write: if false;
    }
    
    // Aggregated reports collection
    match /reports/{reportId} {
      // Allow authenticated users to read reports
      allow read: if request.auth != null;
      
      // Only Cloud Functions can write
      allow write: if false;
    }
  }
}
```

**Rule components:**

**`request.auth`:** Contains authenticated user information (Firebase Authentication). Null if user is not authenticated.

**`request.resource.data`:** Contains data being written (for validation).

**`resource.data`:** Contains existing document data (for update validation).

**`allow read`:** Controls `get()` and `onSnapshot()` operations.

**`allow write`:** Controls `set()`, `update()`, and `delete()` operations.

**Why `allow write: if false`?**

Dashboard clients should only read data, not write. Writes come from Cloud Functions (which use service accounts, bypassing security rules).

**Prevents:**

- Malicious users injecting fake analytics
- Compromised frontend code modifying data
- Accidental writes from buggy client code

### DynamoDB Resource Policies

DynamoDB doesn't have security rules like Firestore. Access control happens entirely through IAM policies on Lambda execution roles.

**CV Analytics DynamoDB access pattern:**

**Aggregated table (stores processed analytics):**

- Lambda writes: Processor Lambda writes aggregated data
- Lambda reads: Reporter Lambda reads for weekly reports
- No direct client access: Frontend doesn't query DynamoDB (reads from Firestore instead)

**IAM policy (already covered):**

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:GetItem",
    "dynamodb:Query"
  ],
  "Resource": "arn:aws:dynamodb:eu-west-2:123456789012:table/cv-analytics-aggregated"
}
```

**Row-level security:**

DynamoDB doesn't support row-level security natively. Implement in application code:

```javascript
// Lambda function: Validate user can access requested data
exports.handler = async (event) => {
  const userId = event.requestContext.authorizer.claims.sub; // From JWT
  const requestedUserId = event.pathParameters.userId;
  
  // Enforce: Users can only read their own data
  if (userId !== requestedUserId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Forbidden' })
    };
  }
  
  // Query DynamoDB for user's data
  const result = await dynamodb.getItem({
    TableName: 'cv-analytics-aggregated',
    Key: { userId: { S: userId } }
  }).promise();
  
  return {
    statusCode: 200,
    body: JSON.stringify(result.Item)
  };
};
```

### Encryption at Rest

**GCP Firestore:**

- Default encryption: AES-256 encryption enabled by default (no configuration needed)
- Encryption key management: Google-managed keys (automatic rotation)
- Customer-managed keys (CMEK): Optional, use Cloud KMS for custom keys

**AWS DynamoDB:**

- Default encryption: AES-256 encryption enabled by default
- Encryption key management: AWS-managed keys (automatic rotation)
- Customer-managed keys (CMK): Optional, use AWS KMS for custom keys

**CV Analytics choice:**
Use default encryption (Google-managed and AWS-managed keys). Customer-managed keys add complexity without security benefit for this use case.

**When to use customer-managed keys:**

- Regulatory requirements (e.g., HIPAA, PCI-DSS)
- Need audit trail of key usage
- Require ability to revoke access immediately
- Multi-region data residency requirements

### Network Isolation

**Firestore:**

- Public endpoint with authentication
- Security rules enforce access control
- VPC Service Controls (optional): Restrict access to specific VPCs

**DynamoDB:**

- Public endpoint with IAM authentication
- VPC Endpoints (optional): Access DynamoDB without internet gateway
- Lambda in VPC: Add VPC configuration to Lambda function

**CV Analytics network configuration:**

- Public endpoints for both databases (simpler, lower cost)
- Security through authentication (IAM, Firebase Auth) and authorization (IAM policies, Firestore rules)
- No VPC required for serverless architecture

**When to use VPC:**

- Hybrid cloud with on-premises connectivity
- Compliance requires private networking
- Need static IP addresses (NAT gateway)
- Complex security zones

---

## Encryption

### Data in Transit: TLS/HTTPS

All network communication in CV Analytics uses TLS (Transport Layer Security) 1.2 or higher. This encrypts data between services, preventing eavesdropping and man-in-the-middle attacks.

**TLS is enforced:**

**AWS Lambda → GCP Cloud Functions (cross-cloud webhooks):**

- AWS Lambda sends webhooks over HTTPS (TLS 1.3)
- GCP Cloud Function endpoint: `https://us-central1-project.cloudfunctions.net/cv-analytics-webhook`
- Certificate: Managed by Google (automatic renewal, Let's Encrypt)
- HMAC signature in header: `X-Webhook-Signature: sha256=...`
- Cost: £0 (TLS included in Cloud Functions)

**Cloudflare Worker → AWS DynamoDB:**

- Cloudflare Worker uses AWS SDK v3 over HTTPS
- DynamoDB endpoint: `https://dynamodb.us-east-1.amazonaws.com`
- IAM SigV4 signing (request authentication)
- Certificate: Managed by AWS
- Cost: £0 (TLS included)

**Dashboard → Firestore:**

- Firebase SDK uses HTTPS for all API calls
- WebSocket connections use WSS (WebSocket Secure)
- Certificate: Managed by Google

**Lambda → DynamoDB:**

- AWS SDK uses HTTPS for all API calls
- Certificate: Managed by AWS

**Firebase Hosting:**

- Dashboard served over HTTPS
- Custom domain: `your-dashboard.com`
- Certificate: Automatic Let's Encrypt (Firebase provisions and renews)

**Enforcing HTTPS (Firebase Hosting example):**

```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains"
          }
        ]
      }
    ]
  }
}
```

**Strict-Transport-Security (HSTS):** Forces browsers to use HTTPS for all requests (even if user types `http://`).

### Data at Rest: AES-256 Encryption

All data stored in Firestore and DynamoDB is encrypted at rest using AES-256 (Advanced Encryption Standard with 256-bit keys).

**GCP Firestore encryption:**

**Default encryption:**

- Enabled automatically (no configuration required)
- Google-managed keys: Google generates, rotates, and manages keys
- Key rotation: Automatic, transparent to applications
- Encryption scope: Entire database encrypted

**Customer-Managed Encryption Keys (CMEK):**

- Use Cloud KMS to manage your own keys
- Requires: Enable Cloud KMS API, create key ring and crypto key
- Use case: Regulatory compliance, audit requirements

**Example (Terraform with CMEK):**

```hcl
# Create Cloud KMS key ring
resource "google_kms_key_ring" "firestore_keyring" {
  name     = "firestore-encryption"
  location = "europe-west2"
}

# Create Cloud KMS crypto key
resource "google_kms_crypto_key" "firestore_key" {
  name     = "firestore-key"
  key_ring = google_kms_key_ring.firestore_keyring.id
  
  rotation_period = "7776000s" # 90 days
}

# Grant Firestore service account access to key
resource "google_kms_crypto_key_iam_binding" "firestore_key_binding" {
  crypto_key_id = google_kms_crypto_key.firestore_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  
  members = [
    "serviceAccount:service-${data.google_project.project.number}@gcp-sa-firestore.iam.gserviceaccount.com"
  ]
}
```

**AWS DynamoDB encryption:**

**Default encryption:**

- Enabled automatically (AWS-managed keys)
- Key rotation: Automatic every 3 years
- Encryption scope: Entire table encrypted

**Customer-Managed Keys (AWS KMS):**

- Use AWS KMS to manage your own keys
- Requires: Create KMS key, grant DynamoDB service access
- Cost: KMS charges per API call

**Example (Terraform with KMS):**

```hcl
# Create KMS key for DynamoDB
resource "aws_kms_key" "dynamodb_key" {
  description             = "KMS key for DynamoDB encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true
}

# Create DynamoDB table with KMS encryption
resource "aws_dynamodb_table" "analytics" {
  name         = "cv-analytics-aggregated"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb_key.arn
  }
}
```

### Certificate Management

**Firebase Hosting:**

- Automatic SSL certificates via Let's Encrypt
- Renewal: Firebase handles automatically (60 days before expiry)
- Custom domains: Add domain in Firebase Console, update DNS, certificate provisioned
- Cost: Free

**Cloud Functions:**

- Automatic SSL certificates for `.cloudfunctions.net` domains
- Custom domains: Use Cloud Load Balancer with Google-managed certificates
- Cost: Load Balancer charges apply

**API Gateway (AWS):**

- Automatic certificates for API Gateway default domains
- Custom domains: Use AWS Certificate Manager (ACM)
- Cost: Free for ACM certificates

**CV Analytics certificate strategy:**

- Use automatic certificates (Firebase, Cloud Functions, API Gateway)
- No manual certificate management required
- Zero cost for certificates

---

## Audit Logging and Monitoring

### Why Audit Logging Matters

Security isn't complete without visibility. Audit logs answer critical questions:

- Did HMAC validation fail? (Potential attack)
- Which service accounts accessed which resources? (Audit trail)
- Are there unusual access patterns? (Anomaly detection)
- How do we investigate a security incident? (Forensics)

### CloudWatch Logs (AWS)

AWS Lambda automatically sends logs to CloudWatch Logs. Each Lambda function gets a log group: `/aws/lambda/function-name`.

**CV Analytics Lambda logging:**

**Processor Lambda:**

```javascript
console.log('Received SQS message', {
  messageId: record.messageId,
  timestamp: new Date().toISOString()
});

console.log('Processing analytics data', {
  cvId: data.cvId,
  eventType: data.eventType
});

console.log('Wrote to DynamoDB', {
  tableName: 'cv-analytics-aggregated',
  key: aggregatedKey
});
```

**Reporter Lambda:**

```javascript
console.log('Generating weekly report', {
  weekStart: startDate,
  weekEnd: endDate
});

console.log('Sending email via SES', {
  recipient: process.env.REPORT_EMAIL,
  cvCount: totalCVs
});
```

**Structured logging:**
Log objects (not strings) for easier querying in CloudWatch Insights.

**CloudWatch Insights query (find failed DynamoDB writes):**

```
fields @timestamp, @message
| filter @message like /DynamoDB/
| filter @message like /error/
| sort @timestamp desc
| limit 20
```

### Cloud Logging (GCP)

GCP Cloud Functions automatically send logs to Cloud Logging. Each function gets a log stream.

**CV Analytics Cloud Function logging:**

```go
import (
    "log"
    "encoding/json"
)

func WebhookHandler(w http.ResponseWriter, r *http.Request) {
    // Log structured data
    log.Printf("Webhook received: %s", toJSON(map[string]interface{}{
        "method":     r.Method,
        "path":       r.URL.Path,
        "userAgent":  r.Header.Get("User-Agent"),
        "ipAddress":  r.Header.Get("X-Forwarded-For"),
    }))
    
    // Validate HMAC
    if !validateHMAC(payload, signature, secret) {
        log.Printf("HMAC validation failed: %s", toJSON(map[string]interface{}{
            "signature": signature,
            "ipAddress": r.Header.Get("X-Forwarded-For"),
            "timestamp": time.Now().Unix(),
        }))
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    
    log.Printf("HMAC validation succeeded")
    
    // Write to Firestore
    _, err := firestoreClient.Collection("analytics").Doc(docID).Set(ctx, data)
    if err != nil {
        log.Printf("Firestore write failed: %s", toJSON(map[string]interface{}{
            "error":  err.Error(),
            "docID":  docID,
        }))
        http.Error(w, "Internal Server Error", http.StatusInternalServerError)
        return
    }
    
    log.Printf("Successfully processed webhook: %s", docID)
}

func toJSON(data interface{}) string {
    bytes, _ := json.Marshal(data)
    return string(bytes)
}
```

**Cloud Logging query (find failed HMAC validations):**

```
resource.type="cloud_function"
resource.labels.function_name="webhook-receiver"
jsonPayload.message=~"HMAC validation failed"
```

### Failed Authentication Tracking

Track authentication failures to detect brute-force attacks or misconfigured clients.

**Metrics to monitor:**

**HMAC validation failures (Cloud Functions):**

- Count: Number of failed validations per hour
- Threshold: > 10 failures per hour = potential attack
- Response: Alert security team, temporarily block IP (Cloud Armor)

**IAM permission denied errors (Lambda):**

- Count: Number of IAM AccessDenied errors
- Threshold: > 0 (should never happen in production)
- Response: Check IAM policies, verify Lambda execution role

**Firebase Authentication failures (Dashboard):**

- Count: Number of failed login attempts
- Threshold: > 5 from same IP in 10 minutes
- Response: Temporarily block IP, require CAPTCHA

### CloudWatch Alarms (Example)

```hcl
# Terraform: CloudWatch alarm for Lambda errors
resource "aws_cloudwatch_metric_alarm" "processor_errors" {
  alarm_name          = "processor-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300" # 5 minutes
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert when Processor Lambda has > 5 errors in 5 minutes"
  
  dimensions = {
    FunctionName = aws_lambda_function.processor.function_name
  }
  
  alarm_actions = [aws_sns_topic.security_alerts.arn]
}

# SNS topic for security alerts
resource "aws_sns_topic" "security_alerts" {
  name = "security-alerts"
}

# Email subscription
resource "aws_sns_topic_subscription" "security_email" {
  topic_arn = aws_sns_topic.security_alerts.arn
  protocol  = "email"
  endpoint  = "security-team@example.com"
}
```

### Log Retention Policies

**CloudWatch Logs:**

- Default: Logs retained indefinitely (cost increases over time)
- Recommended: 30 days for application logs, 90 days for security logs

```hcl
resource "aws_cloudwatch_log_group" "processor_logs" {
  name              = "/aws/lambda/cv-analytics-processor"
  retention_in_days = 30
}
```

**Cloud Logging:**

- Default: 30 days retention
- Extended retention: Configure log sinks to Cloud Storage (long-term archival)

```hcl
# Export logs to Cloud Storage for long-term retention
resource "google_logging_project_sink" "security_logs_sink" {
  name        = "security-logs-archive"
  destination = "storage.googleapis.com/${google_storage_bucket.logs_archive.name}"
  
  filter = "resource.type=\"cloud_function\" AND jsonPayload.message=~\"HMAC validation failed\""
  
  unique_writer_identity = true
}

resource "google_storage_bucket" "logs_archive" {
  name     = "cv-analytics-security-logs"
  location = "EU"
  
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 365 # Delete after 1 year
    }
  }
}
```

### Anomaly Detection

Implement automated anomaly detection for unusual patterns:

**Volume anomalies:**

- Sudden spike in webhook calls (> 10x normal rate) = potential DoS
- Sudden drop in events (< 10% normal rate) = potential outage

**Pattern anomalies:**

- Webhook calls from unexpected IP addresses
- Lambda invocations outside business hours (if unexpected)
- Database queries for unusual data patterns

**Implementation:**

- Use CloudWatch Anomaly Detection (AWS) or Cloud Monitoring anomaly detection (GCP)
- Define baseline metrics (normal behaviour)
- Alert when current metrics deviate significantly from baseline

---

## Practical Takeaways

### Implementation Priority

**Phase 1: Authentication (Week 1)**

✓ Implement HMAC signature validation for all webhooks  
✓ Use constant-time comparison (`hmac.Equal()` in Go)  
✓ Store webhook secrets in environment variables  
✓ Log failed validation attempts with IP addresses  
✓ Return generic error messages (don't leak information)

**Phase 2: Authorization (Week 2)**

✓ Create dedicated service accounts for each service (GCP) or Lambda execution roles (AWS)  
✓ Grant minimum required permissions (least privilege)  
✓ Use specific resource ARNs (not wildcards)  
✓ Test IAM policies with actual service operations  
✓ Document why each permission is needed

**Phase 3: Secrets Management (Week 3)**

✓ Store all credentials in GitHub Secrets  
✓ Add `.env`, `*.key`, `*.json` to `.gitignore`  
✓ Use Workload Identity Federation (GCP) instead of service account keys  
✓ Rotate secrets every 90 days  
✓ Test secret rotation process before production

**Phase 4: Monitoring (Week 4)**

✓ Enable structured logging in all services  
✓ Create CloudWatch alarms for authentication failures  
✓ Set up log retention policies (30-90 days)  
✓ Configure security alerts (SNS topics, email notifications)  
✓ Define incident response procedures

### What Not to Do

✗ **Don't commit secrets to git**  
Even if you delete the commit, secrets remain in git history. Use `git filter-branch` to remove, then rotate immediately.

✗ **Don't use service account keys in production**  
Keys don't expire automatically and are easily leaked. Use Workload Identity Federation (GitHub Actions → GCP) or IAM roles (Lambda).

✗ **Don't use overly permissive IAM roles**  
`roles/owner`, `roles/editor`, `dynamodb:*` grant excessive permissions. Use specific roles like `roles/datastore.user` or `dynamodb:PutItem`.

✗ **Don't ignore failed authentication attempts**  
Failed HMAC validations or IAM permission errors indicate misconfigurations or attacks. Set up alerts.

✗ **Don't log secret values**  
`console.log(process.env.API_KEY)` exposes secrets in CloudWatch Logs. Log non-sensitive context only.

✗ **Don't disable encryption**  
Default encryption (AES-256) is free and requires no configuration. Disabling it gains nothing.

✗ **Don't skip timestamp validation**  
HMAC signatures without timestamps are vulnerable to replay attacks. Validate timestamps (< 5 minutes old).

### Security Metrics to Monitor

**Daily metrics:**

- HMAC validation failures per hour
- IAM permission denied errors
- Lambda/Cloud Function error rates

**Weekly metrics:**

- Total webhook volume (detect anomalies)
- Authentication success rate
- Log storage costs (optimize retention)

**Monthly metrics:**

- Secret rotation status (overdue rotations)
- Security audit findings
- Cost per security control

### When to Use These Patterns

**Use HMAC validation when:**

- Receiving webhooks from external services (GitHub, Stripe, Twilio)
- Need to verify sender authenticity
- Webhook endpoint is publicly accessible

**Use service accounts/IAM roles when:**

- Services need programmatic access to cloud resources
- Running in GCP (Cloud Functions, Cloud Run, GKE)
- Running in AWS (Lambda, ECS, EC2)

**Use GitHub Secrets when:**

- CI/CD pipelines need credentials for deployment
- Secrets must be shared across workflows
- Team members shouldn't have direct access to production credentials

**Use customer-managed encryption keys when:**

- Regulatory compliance requires key control (HIPAA, PCI-DSS)
- Need audit trail of encryption key usage
- Multi-region data residency requirements
- Willing to accept increased complexity and cost

### Cost Considerations

**Free security controls:**

- HMAC validation (no cost)
- IAM policies (no cost)
- GitHub Secrets (no cost)
- Default encryption (no cost)
- CloudWatch Logs (within free tier: 5GB ingestion/month)
- Cloud Logging (within free tier: 50GB/month)

**Paid security controls:**

- Customer-managed keys (KMS API calls: $0.03 per 10,000 requests)
- VPC endpoints ($0.01 per hour + $0.01 per GB processed)
- Cloud Armor (DDoS protection: $5 per policy + $1 per million requests)
- Extended log retention (CloudWatch: $0.50 per GB stored)
- Security auditing tools (third-party services)

**CV Analytics security cost:** £0/month (uses only free-tier controls)

### Testing Your Security Implementation

**HMAC validation test:**

```bash
# Test with invalid signature (should return 401)
curl -X POST https://your-cloud-function.net/webhook \
  -H "X-Hub-Signature-256: sha256=invalid" \
  -d '{"test": "data"}'

# Test with valid signature
SECRET="your-webhook-secret"
PAYLOAD='{"test": "data"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -X POST https://your-cloud-function.net/webhook \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

**IAM policy test:**

```bash
# AWS: Test Lambda can write to DynamoDB
aws lambda invoke \
  --function-name cv-analytics-processor \
  --payload '{"test": "data"}' \
  response.json

# Check CloudWatch Logs for IAM errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/cv-analytics-processor \
  --filter-pattern "AccessDenied"
```

**Firestore security rules test:**

```bash
# Install Firebase emulator
npm install -g firebase-tools
firebase init emulators

# Run security rules tests
firebase emulators:exec --only firestore "npm test"
```

---

## What's Next

**Part 4: Infrastructure as Code with Terraform**

Security patterns established. Now: how to provision all this infrastructure consistently across GCP and AWS.

Part 4 covers:

- ✓ Multi-cloud Terraform patterns
- ✓ Remote state management with Terraform Cloud
- ✓ Secrets handling and environment variables
- ✓ Rollback strategies and disaster recovery
- ✓ Cost optimization through serverless architecture

**Focus:** Reproducible infrastructure across cloud providers.

---

## Further Reading

- [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
- [GCP IAM Best Practices](https://cloud.google.com/iam/docs/best-practices)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
