-- Migration: 006_update_employer_attribution_open_source.sql
-- Update employer field for 2025 multi-cloud technologies to "Open Source Production Systems"

-- Update all 2025 multi-cloud technologies
UPDATE technology 
SET employer = 'Open Source Production Systems'
WHERE stable_id IN (
  'terraform-iac-2025',
  'cloudflare-workers-2025',
  'dynamodb-streams-2025',
  'sqs-fifo-2025',
  'github-actions-2025',
  'firestore-2025',
  'multi-cloud-2025',
  'edge-computing-2025',
  'event-driven-2025',
  'disaster-recovery-2025'
);

-- Also update existing Cloudflare records from "Independent Production" to "Open Source Production Systems"
UPDATE technology 
SET employer = 'Open Source Production Systems'
WHERE employer = 'Independent Production';

-- Verification
SELECT 
  name, 
  employer, 
  related_project
FROM technology 
WHERE employer = 'Open Source Production Systems'
ORDER BY name;

SELECT COUNT(*) as open_source_count 
FROM technology 
WHERE employer = 'Open Source Production Systems';
