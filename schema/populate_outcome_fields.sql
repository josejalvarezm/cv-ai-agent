-- Helper script to extract outcome-driven fields from existing summary data
-- This is a manual guide for updating records that only have summaries

-- Example: Update records by parsing their summary field
-- Format: Action → Effect → Outcome pattern

-- Pattern 1: "Did X, enabling Y, resulting in Z"
-- Example: Full-Stack Service Decomposition
UPDATE technology 
SET 
  action = 'Broke down monolithic applications into modular, independently deployable services',
  effect = 'Enabled team autonomy and faster deployment cycles',
  outcome = 'Reduced deployment coordination overhead and accelerated feature delivery',
  related_project = 'CCHQ national campaign platform'
WHERE stable_id = 'full-stack-service-decomposition-1' 
  AND action IS NULL;

-- Pattern 2: "Designed/Built X for Y, achieving Z"
-- Example: Service-Oriented Architecture
UPDATE technology 
SET 
  action = 'Designed and implemented SOA patterns across 10+ enterprise applications',
  effect = 'Improved system modularity and enabled seamless third-party integrations',
  outcome = 'Reduced integration time by 60% and increased system maintainability',
  related_project = NULL
WHERE stable_id = 'service-oriented-architecture-1' 
  AND action IS NULL;

-- Pattern 3: "Maintained X APIs, delivering Y"
-- Example: RESTful APIs
UPDATE technology 
SET 
  action = 'Architected and maintained 50+ RESTful APIs with comprehensive OpenAPI documentation',
  effect = 'Enabled rapid client integration and self-service API adoption',
  outcome = 'Reduced integration support tickets by 80% and enabled 100+ external integrations',
  related_project = NULL
WHERE stable_id = 'restful-apis-1' 
  AND action IS NULL;

-- Pattern 4: Performance/Database
-- Example: T-SQL Performance Tuning
UPDATE technology 
SET 
  action = 'Optimized complex T-SQL queries and database indexes across mission-critical systems',
  effect = 'Improved query response times and throughput capacity',
  outcome = 'Achieved 10x performance gains on key queries, supporting thousands of records per second',
  related_project = NULL
WHERE stable_id = 'tsql-performance-tuning-1' 
  AND action IS NULL;

-- Pattern 5: Windows Services high-throughput
UPDATE technology 
SET 
  action = 'Developed fault-tolerant Windows Services with MSMQ and SQL-based queuing',
  effect = 'Enabled reliable asynchronous processing at scale',
  outcome = 'Processed thousands of records per second with 99.9% reliability',
  related_project = NULL
WHERE stable_id = 'windows-services-1' 
  AND action IS NULL;

-- Pattern 6: CI/CD Automation
UPDATE technology 
SET 
  action = 'Designed and implemented automated CI/CD pipelines with build, test, and deployment stages',
  effect = 'Streamlined release automation and reduced manual intervention',
  outcome = 'Cut deployment time by 75% and eliminated manual deployment errors',
  related_project = NULL
WHERE stable_id = 'azure-devops-1' 
  AND action IS NULL;

-- Pattern 7: Edge Computing / Modern Architecture
UPDATE technology 
SET 
  action = 'Architected edge computing solutions using Cloudflare Workers and D1',
  effect = 'Reduced latency and improved global content delivery performance',
  outcome = 'Achieved sub-50ms response times globally with zero-cost serverless hosting',
  related_project = 'CV Skills Assistant on Cloudflare Edge'
WHERE stable_id = 'edge-architectures-1' 
  AND action IS NULL;

UPDATE technology 
SET 
  action = 'Deployed serverless edge functions with Cloudflare Workers in production',
  effect = 'Eliminated infrastructure management and server costs',
  outcome = 'Achieved zero-cost hosting with global low latency (<50ms)',
  related_project = 'CV Skills Assistant and Edge API services'
WHERE stable_id = 'cloudflare-workers-1' 
  AND action IS NULL;

-- Pattern 8: Angular/Frontend Development
UPDATE technology 
SET 
  action = 'Developed enterprise Angular applications with reactive RxJS patterns',
  effect = 'Enabled real-time UI updates and improved user experience',
  outcome = 'Delivered responsive SPAs with 40% faster load times',
  related_project = 'CCHQ campaign management dashboard'
WHERE stable_id = 'angular-1' 
  AND action IS NULL;

-- Pattern 9: ASP.NET Core APIs
UPDATE technology 
SET 
  action = 'Developed high-performance ASP.NET Core REST APIs with dependency injection',
  effect = 'Enabled cloud-native deployments and horizontal scaling',
  outcome = 'Supported 10,000+ concurrent users with sub-100ms response times',
  related_project = NULL
WHERE stable_id = 'aspnet-core-1' 
  AND action IS NULL;

-- Pattern 10: SQL Server Database Administration
UPDATE technology 
SET 
  action = 'Administered mission-critical SQL Server databases with backup, recovery, and performance tuning',
  effect = 'Ensured 99.9% uptime and data integrity',
  outcome = 'Zero data loss incidents over 20 years of enterprise database management',
  related_project = NULL
WHERE stable_id = 'sql-server-1' 
  AND action IS NULL;

-- View records still missing outcome fields
SELECT stable_id, name, summary, action, effect, outcome, related_project
FROM technology
WHERE action IS NULL
ORDER BY category_id, id;

-- Count records by outcome field completeness
SELECT 
  COUNT(*) as total_records,
  COUNT(action) as has_action,
  COUNT(effect) as has_effect,
  COUNT(outcome) as has_outcome,
  COUNT(related_project) as has_project
FROM technology;
