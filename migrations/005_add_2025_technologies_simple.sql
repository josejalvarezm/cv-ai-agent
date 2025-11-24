-- Update MyAIAgentPrivate - Add 2025 Multi-Cloud Technologies (Simplified)
-- Generated: 2025-11-24
-- Purpose: Add new technology records reflecting multi-cloud production experience

-- Terraform
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('terraform-iac-2025', 'Terraform', '2+ years', 2, 85, 'Advanced', 'Authored 1,200 lines managing cross-cloud dependencies. Achieved 98% workflow automation with 47-second infrastructure recreation', 'Infrastructure & DevOps', '2024–Present', NULL, 'Authored 1,200 lines of Terraform managing Cloudflare, AWS, and GCP', 'Enabled reproducible infrastructure provisioning', 'Achieved 98% workflow automation with 47-second RTO, zero data loss', 'Multi-Cloud Microservices');

-- Cloudflare Workers
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('cloudflare-workers-2025', 'Cloudflare Workers', '2+ years', 2, 90, 'Advanced', 'Edge-native serverless compute. Eliminated cold starts (1000ms → 5ms), deployed across 275+ global locations', 'Cloud Platforms', '2024–Present', NULL, 'Migrated APIs from Azure Functions to Cloudflare Workers', 'Eliminated cold starts and reduced global latency', 'Achieved 5ms response times across 275+ edge locations', 'Edge-Native Platform');

-- DynamoDB Streams
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('dynamodb-streams-2025', 'DynamoDB Streams', '2+ years', 2, 85, 'Advanced', 'Event-driven pipeline with DynamoDB Streams → SQS FIFO → Lambda. Achieved 12ms P99 latency with 90% cost reduction', 'Event-Driven Architecture', '2024–Present', NULL, 'Engineered event pipeline using DynamoDB Streams', 'Enabled real-time data processing with guaranteed ordering', 'Achieved 12ms P99 latency with 90% cost reduction', 'AWS Event-Driven Analytics');

-- SQS FIFO
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('sqs-fifo-2025', 'Amazon SQS FIFO', '2+ years', 2, 85, 'Advanced', 'FIFO queues for ordered event processing. Enabled reliable processing at £0 operational cost through free-tier exploitation', 'Message Queuing', '2024–Present', NULL, 'Implemented FIFO queues for ordered event processing', 'Guaranteed message ordering and exactly-once semantics', 'Enabled reliable processing at £0 operational cost', 'AWS Event-Driven Analytics');

-- GitHub Actions
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('github-actions-2025', 'GitHub Actions', '2+ years', 2, 88, 'Advanced', 'Designed 6 independent CI/CD pipelines with semantic versioning. Achieved zero-downtime deployments with automated rollback', 'CI/CD', '2024–Present', NULL, 'Designed 6 independent CI/CD pipelines', 'Enabled automated testing, building, and deployment', 'Achieved zero-downtime deployments across multi-cloud', 'Multi-Cloud Microservices');

-- Firestore
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('firestore-2025', 'Google Cloud Firestore', '2+ years', 2, 85, 'Advanced', 'Real-time NoSQL with WebSocket listeners. Achieved sub-second latency for AWS → GCP → browser updates', 'Real-Time Database', '2024–Present', NULL, 'Implemented Firestore WebSocket listeners', 'Enabled instant UI updates without polling', 'Achieved sub-second cross-cloud latency in production', 'GCP Real-Time Dashboard');

-- Multi-Cloud Orchestration
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('multi-cloud-2025', 'Multi-Cloud Orchestration', '2+ years', 2, 88, 'Advanced', 'Architected 6 microservices across Cloudflare, AWS, and GCP. Achieved 87.5% purity at £0/month operational cost', 'Architecture', '2024–Present', NULL, 'Architected 6 microservices across 3 cloud providers', 'Achieved 87.5% architectural purity with minimal coupling', 'Delivered system processing 3,000 queries/month at £0/month', 'Multi-Cloud Microservices');

-- Edge Computing
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('edge-computing-2025', 'Edge Computing', '2+ years', 2, 85, 'Advanced', 'Migrated to edge-native Workers from centralized cloud functions. Achieved <5ms response times globally', 'Architecture', '2024–Present', NULL, 'Migrated from centralized cloud to edge-native architecture', 'Eliminated cold starts and reduced global latency', 'Achieved <5ms response times across 275+ edge locations', 'Edge-Native Platform');

-- Event-Driven Architecture
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('event-driven-2025', 'Event-Driven Architecture', '2+ years', 2, 88, 'Advanced', 'Designed pipeline using DynamoDB Streams, SQS FIFO, Lambda, EventBridge. Achieved 12ms P99 latency with 90% cost reduction', 'Architecture', '2024–Present', NULL, 'Designed event-driven pipeline with AWS services', 'Enabled loosely-coupled, scalable microservices', 'Achieved 12ms P99 latency with automated weekly reporting', 'AWS Event-Driven Analytics');

-- Disaster Recovery
INSERT OR REPLACE INTO technology (stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project)
VALUES ('disaster-recovery-2025', 'Disaster Recovery Automation', '2+ years', 2, 90, 'Advanced', 'Automated recovery using Terraform and GitHub Actions. Achieved 98% workflow automation with 47-second RTO', 'Resilience Engineering', '2024–Present', NULL, 'Implemented automated disaster recovery', 'Enabled reproducible infrastructure with minimal manual intervention', 'Achieved 98% automation with 47-second RTO, zero data loss', 'Multi-Cloud Microservices');

-- Update C# (keep at 19 years)
UPDATE technology 
SET experience = '19 years',
    experience_years = 19,
    summary = 'Primary language for enterprise applications. Delivered systems serving 10,000+ concurrent users with 3x performance improvements',
    recency = '2006–2025'
WHERE name = 'C#';

-- Update SQL Server
UPDATE technology 
SET experience = '20+ years',
    experience_years = 20,
    summary = 'Achieved 3x performance improvements through query optimization and indexing strategies on high-traffic systems',
    recency = '2000–2025'
WHERE name LIKE '%SQL Server%' OR name LIKE '%T-SQL%';

-- Verification
SELECT COUNT(*) as new_tech_count FROM technology WHERE stable_id LIKE '%-2025';
SELECT name, experience_years FROM technology WHERE name IN ('C#', 'Terraform', 'Cloudflare Workers');
