# Multi-Cloud Infrastructure as Code: Terraform for GCP and AWS

## Quick Summary

- ✓ **100% infrastructure-as-code** eliminates manual configuration drift
- ✓ **Multi-cloud Terraform** provisions GCP Cloud Functions, Firestore, AWS Lambda, DynamoDB
- ✓ **Remote state management** with Terraform Cloud enables team collaboration
- ✓ **Rollback strategies** protect against failed deployments
- ✓ **Cost: £0/month** using free tier optimization patterns

---

## Introduction

[Content to be written following guidelines: British English, ✓ symbols, no em dashes, professional tone]

**Topics to cover:**
- Why infrastructure-as-code matters for microservices
- The problem with clicking through cloud consoles
- Terraform as multi-cloud provisioning tool
- How IaC enables reproducible environments

---

## Terraform Fundamentals

[Content to be written]

**Topics:**
- Providers (GCP, AWS)
- Resources vs Data Sources
- State management
- Terraform workflow (init → plan → apply)

---

## GCP Infrastructure

[Content to be written]

**Topics:**
- Cloud Functions configuration
- Firestore database setup
- Firebase Hosting
- Service account IAM
- VPC and networking (if applicable)

**Mermaid diagram:** GCP resource dependencies

---

## AWS Infrastructure

[Content to be written]

**Topics:**
- Lambda functions (Processor, Reporter)
- DynamoDB tables
- DynamoDB Streams
- SQS queues
- EventBridge rules
- IAM roles and policies
- CloudWatch logging

**Mermaid diagram:** AWS resource dependencies

---

## Remote State Management

[Content to be written]

**Topics:**
- Why remote state matters
- Terraform Cloud setup
- State locking
- Team collaboration
- Security considerations

**Mermaid diagram:** State management workflow

---

## Secrets Handling

[Content to be written]

**Topics:**
- Environment variables pattern
- GitHub Secrets integration
- Git ignore patterns
- Never commit credentials
- Service account key management

---

## Deployment Workflow

[Content to be written]

**Topics:**
- `terraform init` - Initialize providers
- `terraform plan` - Review changes
- `terraform apply` - Provision resources
- `terraform destroy` - Clean up
- Verification steps

**Mermaid diagram:** Deployment pipeline

---

## Rollback Strategies

[Content to be written]

**Topics:**
- Version control for infrastructure
- `terraform plan` before apply
- Manual state rollback
- Disaster recovery procedures
- Backup strategies

---

## Practical Takeaways

[Content to be written]

**Key points:**
- ✓ Never click through consoles
- ✓ Version control all infrastructure
- ✓ Review plans before applying
- ✓ Use remote state for teams
- ✓ Document rollback procedures

---

## What's Next

**Part 3: CI/CD with GitHub Actions**

Infrastructure provisioned. Now: automated deployments.

Part 3 covers:
- ✓ GitHub Actions workflows per service
- ✓ Secrets management across repositories
- ✓ Deployment pipelines (React, Go, Node.js)
- ✓ Zero-downtime deployments
- ✓ Independent pipeline triggers

**Repository:** Multiple CI/CD workflows across 4 service repos

---

## Further Reading

- [Terraform Documentation](https://www.terraform.io/docs)
- [GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
