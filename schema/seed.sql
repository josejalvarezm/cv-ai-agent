-- seed.sql (SQLite)

BEGIN TRANSACTION;

-- Seed categories (use OR IGNORE so re-running seed is idempotent)
INSERT OR IGNORE INTO "technology_category" ("name","icon") VALUES
  ('Architecture & Design','nodes'),
  ('Frontend Development','display'),
  ('Backend Development','nodes'),
  ('Database & Performance','data-cluster'),
  ('Cloud & DevOps','cloud'),
  ('Modern Development Practices','crown'),
  ('Technical Research & Prototyping','nodes'),
  ('Edge Architectures (Production)','cloud'),
  ('Legacy Development','history');

-- Seed technologies using category name to resolve ids and OR IGNORE to avoid duplicates
-- Architecture & Design
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Architecture & Design'),'Full-Stack Service Decomposition','5+ years (CCHQ)',5,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Architecture & Design'),'Service-Oriented Architecture','8+ years',8,88,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Architecture & Design'),'RESTful APIs','10+ years',10,90,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Architecture & Design'),'Component-Based Architecture','3+ years',3,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Architecture & Design'),'Independent Deployment','5+ years',5,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Architecture & Design'),'Message Queue Patterns','8+ years (MSMQ, SQL-based)',8,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Architecture & Design'),'Edge Architectures','1+ years',1,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Architecture & Design'),'Microservices Principles','5+ years',5,85,'Advanced');

-- Frontend Development
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'Angular','3+ years',3,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'RxJS','3+ years',3,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'TypeScript','6+ years',6,88,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'JavaScript','19 years',19,95,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'AngularJS','10 years',10,90,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'Bootstrap','8+ years',8,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'Clarity Design','2025-Present',1,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'Playwright','2024-Present',2,40,'Intermediate'),
  ((SELECT id FROM technology_category WHERE name='Frontend Development'),'React with TypeScript','Development/Research',1,75,'Advanced');

-- Backend Development
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'C#','19 years',19,95,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'ASP.NET Core','5+ years',5,90,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'.NET 6+','3+ years',3,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'RESTful APIs','10+ years',10,90,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'Full-Stack Service Architecture','5+ years (CCHQ)',5,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'Windows Services','8+ years (thousands records/sec)',8,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'MSMQ & SQL-based Queues','8+ years',8,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'Node.js','2025',1,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Backend Development'),'Azure Functions (Node.js/TypeScript)','2025',1,85,'Advanced');

-- Database & Performance
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Database & Performance'),'SQL Server','20+ years',20,95,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Database & Performance'),'T-SQL Performance Tuning','20+ years',20,95,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Database & Performance'),'DAAB/Enterprise Library','11+ years',11,90,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Database & Performance'),'Entity Framework 4','5 years total (discontinued after 2)',5,70,'Intermediate'),
  ((SELECT id FROM technology_category WHERE name='Database & Performance'),'Oracle','5+ years',5,75,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Database & Performance'),'Azure Cosmos DB','2025',1,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Database & Performance'),'MongoDB API','2025',1,75,'Advanced');

-- Cloud & DevOps
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Azure DevOps','5+ years',5,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Azure Blob Storage','5+ years',5,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Azure Cognitive Services','3+ years',3,75,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Azure Static Web Apps','2024-Present',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Azure CDN','3+ years',3,75,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Git','8+ years',8,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'CI/CD Pipelines','5+ years',5,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'AppDynamics','9+ years',9,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Terraform','1+ years',1,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Cloudflare DNS/CDN','2024-Present',1,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Cloudflare Workers','2024-Present (Production)',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Cloudflare Pages','2024-Present (Production)',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Azure Functions (Node.js/TypeScript)','2025',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Cloud & DevOps'),'Playwright Testing','2024-Present',2,40,'Intermediate');

-- Modern Development Practices
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Modern Development Practices'),'Serverless Architecture','2025',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Modern Development Practices'),'Low-Cost Infrastructure Design','2024-Present',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Modern Development Practices'),'Azure Static Web Apps','2024-Present',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Modern Development Practices'),'Cloudflare DNS/CDN','2024-Present',1,80,'Advanced');

-- Technical Research & Prototyping
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Technical Research & Prototyping'),'Containerization & Orchestration','Docker, Kubernetes (pod replicas, self-healing)',1,75,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Technical Research & Prototyping'),'Message Brokers & Patterns','RabbitMQ (pub/sub patterns)',1,75,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Technical Research & Prototyping'),'Distributed Caching','Redis',1,70,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Technical Research & Prototyping'),'Concurrency Models','Akka.NET (Actor Model)',1,70,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Technical Research & Prototyping'),'Frontend Frameworks','React, Bootstrap, Clarity Design',1,75,'Advanced');

-- Edge Architectures (Production)
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Edge Architectures (Production)'),'Cloudflare Workers','Globally distributed, zero‑cost hosting',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Edge Architectures (Production)'),'Cloudflare Pages','Technical blog deployment',1,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Edge Architectures (Production)'),'Infrastructure as Code','Terraform‑based workflows (Exploratory)',1,65,'Intermediate');

-- Legacy Development
INSERT OR IGNORE INTO "technology" ("category_id","name","experience","experience_years","proficiency_percent","level") VALUES
  ((SELECT id FROM technology_category WHERE name='Legacy Development'),'VB.NET','8+ years',8,90,'Expert'),
  ((SELECT id FROM technology_category WHERE name='Legacy Development'),'WPF','8+ years',8,85,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Legacy Development'),'Silverlight','5+ years',5,80,'Advanced'),
  ((SELECT id FROM technology_category WHERE name='Legacy Development'),'ASP.NET MVC/WebForms','8+ years',8,85,'Advanced');

COMMIT;
