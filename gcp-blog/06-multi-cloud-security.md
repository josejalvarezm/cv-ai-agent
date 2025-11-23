# Multi-Cloud Security: HMAC, IAM, and Secrets Management

## Quick Summary

- ✓ **HMAC-SHA256** validates webhook authenticity (no replay attacks)
- ✓ **GCP service accounts** and **AWS IAM roles** enforce least privilege
- ✓ **GitHub Secrets** manage credentials securely in CI/CD
- ✓ **Firestore security rules** protect database access
- ✓ **Encryption** at-rest and in-transit across both clouds

---

## Introduction

[Content to be written following guidelines: British English, ✓ symbols, no em dashes, professional tone]

**Topics to cover:**
- Security challenges in multi-cloud microservices
- Why different clouds require different patterns
- Defense in depth approach
- How CV Analytics implements security

---

## Webhook Authentication: HMAC Signatures

[Content to be written]

**Topics:**
- GitHub webhook security
- HMAC-SHA256 signature validation
- Preventing replay attacks
- Secret rotation strategies
- Time-based validation

**Code example:**
```go
// Go webhook receiver validates HMAC
func validateSignature(payload []byte, signature string, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expectedMAC := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expectedMAC))
}
```

**Mermaid diagram:** HMAC validation flow

---

## GCP IAM: Service Accounts and Roles

[Content to be written]

**Topics:**
- Service account creation
- Least privilege principle
- Cloud Functions service account
- Firestore IAM permissions
- Service account keys (and why to avoid them)

**IAM roles used:**
- `roles/cloudfunctions.developer` - Deploy functions
- `roles/datastore.user` - Read/write Firestore
- `roles/firebase.admin` - Manage Firebase Hosting

---

## AWS IAM: Roles and Policies

[Content to be written]

**Topics:**
- Lambda execution roles
- DynamoDB access policies
- SQS queue permissions
- EventBridge role assumptions
- Cross-account access (if applicable)

**Policy example:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:region:account:table/analytics"
    }
  ]
}
```

**Mermaid diagram:** IAM role assumption flow

---

## Secrets Management: GitHub Secrets

[Content to be written]

**Topics:**
- 7 secrets across 4 repositories
- Dashboard: FIREBASE_TOKEN
- Webhook: GCP_SA_KEY, GCP_PROJECT_ID
- Processor: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- Reporter: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- Never commit secrets to git
- Secret rotation procedures

**Mermaid diagram:** Secrets flow from GitHub to clouds

---

## Database Security

[Content to be written]

**Topics:**
- Firestore security rules
- DynamoDB resource policies
- Row-level security
- Encryption at-rest
- Network isolation (VPC, if applicable)

**Firestore rules example:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /analytics/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;
    }
  }
}
```

---

## Encryption

[Content to be written]

**Topics:**
- TLS/HTTPS for data in-transit
- AES-256 for data at-rest
- GCP encryption (default + CMEK)
- AWS encryption (KMS)
- Certificate management

---

## Audit Logging and Monitoring

[Content to be written]

**Topics:**
- CloudWatch Logs (AWS)
- Cloud Logging (GCP)
- Failed authentication tracking
- Anomaly detection
- Security alerts

---

## Practical Takeaways

[Content to be written]

**Key points:**
- ✓ Validate webhooks with HMAC
- ✓ Use service accounts and IAM roles
- ✓ Never commit secrets
- ✓ Encrypt everything
- ✓ Monitor security events

---

## What's Next

**Part 7: Real-Time Dashboard with React and Firestore**

Security patterns established. Now: building the frontend that visualizes everything.

Part 7 covers:
- ✓ React + TypeScript + Vite setup
- ✓ Firestore real-time listeners
- ✓ Data visualization with Recharts
- ✓ Firebase Hosting with CDN
- ✓ Performance optimization

**Focus:** Real-time WebSocket updates without polling.

---

## Further Reading

- [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
- [GCP IAM Best Practices](https://cloud.google.com/iam/docs/best-practices)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
