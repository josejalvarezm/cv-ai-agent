-- Generic seed data for demonstration
-- This is example data showing different skill levels and outcomes

-- Insert categories
INSERT INTO technology_category (id, name) VALUES (1, 'Backend Development');
INSERT INTO technology_category (id, name) VALUES (2, 'Frontend Development');
INSERT INTO technology_category (id, name) VALUES (3, 'Database & Data');
INSERT INTO technology_category (id, name) VALUES (4, 'Cloud & Infrastructure');
INSERT INTO technology_category (id, name) VALUES (5, 'DevOps & Tools');

-- Insert generic technology skills (15 examples)

-- Backend Development
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (1, 'python-1', 'Python', '5 years professional experience', 5, 85, 'Advanced', 
  'Developed backend services and data processing pipelines using Python.', 
  'Backend Development', NULL, 1,
  'Built RESTful APIs and microservices using Python and FastAPI',
  'Enabled rapid development and deployment of new features',
  'Reduced API response time by 40% through optimization',
  'E-commerce Platform API', 'E-commerce Platform');

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (2, 'nodejs-1', 'Node.js', '4 years professional experience', 4, 80, 'Advanced', 
  'Built scalable backend services and real-time applications with Node.js.', 
  'Backend Development', '2024-Present', 1,
  'Developed event-driven microservices using Node.js and Express',
  'Improved system scalability and real-time capabilities',
  'Handled 100,000 concurrent WebSocket connections',
  'Real-time Chat Platform', 'Healthcare Platform');

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (3, 'rest-apis-1', 'REST APIs', '7 years professional experience', 7, 90, 'Expert', 
  'Designed and implemented RESTful APIs following best practices.', 
  'Backend Development', NULL, 1,
  'Architected 20+ RESTful APIs with comprehensive documentation',
  'Enabled third-party integrations and self-service API adoption',
  'Reduced integration support requests by 60%',
  NULL, NULL);

-- Frontend Development
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (4, 'react-1', 'React', '5 years professional experience', 5, 85, 'Advanced', 
  'Built modern web applications using React and TypeScript.', 
  'Frontend Development', '2024-Present', 2,
  'Developed component libraries and SPAs with React',
  'Improved code reusability and developer productivity',
  'Reduced new feature development time by 35%',
  'Customer Portal', 'E-commerce Platform');

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (5, 'typescript-1', 'TypeScript', '6 years professional experience', 6, 88, 'Advanced', 
  'Wrote type-safe applications with TypeScript for improved code quality.', 
  'Frontend Development', NULL, 2,
  'Adopted TypeScript across codebases with strict type checking',
  'Caught errors at compile time and improved IDE support',
  'Reduced runtime errors by 55%',
  NULL, NULL);

-- Database & Data
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (6, 'postgresql-1', 'PostgreSQL', '8 years professional experience', 8, 90, 'Expert', 
  'Administered and optimized PostgreSQL databases for high-traffic applications.', 
  'Database & Data', NULL, 3,
  'Optimized complex queries and database indexes',
  'Improved query performance and database throughput',
  'Achieved 10x performance improvement on key queries',
  NULL, NULL);

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (7, 'mongodb-1', 'MongoDB', '4 years professional experience', 4, 75, 'Advanced', 
  'Designed NoSQL data models and managed MongoDB deployments.', 
  'Database & Data', '2024-Present', 3,
  'Implemented MongoDB for flexible document storage',
  'Enabled rapid schema evolution and horizontal scaling',
  'Supported 1M+ documents with sub-10ms read latency',
  'Analytics Dashboard', 'Healthcare Platform');

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (8, 'redis-1', 'Redis', '3 years professional experience', 3, 80, 'Advanced', 
  'Implemented caching and session management using Redis.', 
  'Database & Data', NULL, 3,
  'Deployed Redis for distributed caching and pub/sub',
  'Reduced database load and improved response times',
  'Cut API response time by 70% through caching',
  NULL, 'E-commerce Platform');

-- Cloud & Infrastructure
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (9, 'aws-1', 'AWS', '6 years professional experience', 6, 85, 'Advanced', 
  'Designed and deployed cloud infrastructure on AWS.', 
  'Cloud & Infrastructure', NULL, 4,
  'Architected serverless applications using Lambda, API Gateway, and DynamoDB',
  'Reduced infrastructure costs and improved scalability',
  'Cut infrastructure costs by 65% vs traditional servers',
  'Serverless API Platform', NULL);

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (10, 'docker-1', 'Docker', '5 years professional experience', 5, 85, 'Advanced', 
  'Containerized applications using Docker for consistent deployments.', 
  'Cloud & Infrastructure', NULL, 4,
  'Containerized 30+ microservices with Docker',
  'Standardized deployment process and improved portability',
  'Reduced deployment time from hours to minutes',
  NULL, NULL);

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (11, 'kubernetes-1', 'Kubernetes', '3 years professional experience', 3, 75, 'Advanced', 
  'Orchestrated containerized applications using Kubernetes.', 
  'Cloud & Infrastructure', '2024-Present', 4,
  'Deployed Kubernetes clusters with auto-scaling and self-healing',
  'Improved system reliability and resource utilization',
  'Achieved 99.9% uptime with automatic failover',
  NULL, 'Healthcare Platform');

-- DevOps & Tools
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (12, 'cicd-1', 'CI/CD Pipelines', '7 years professional experience', 7, 90, 'Expert', 
  'Designed and maintained CI/CD pipelines for automated deployments.', 
  'DevOps & Tools', NULL, 5,
  'Implemented automated CI/CD pipelines with GitHub Actions',
  'Streamlined build, test, and deployment workflows',
  'Reduced deployment time by 80% and eliminated manual errors',
  NULL, NULL);

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (13, 'git-1', 'Git', '10 years professional experience', 10, 95, 'Expert', 
  'Managed source control with Git and collaborative development workflows.', 
  'DevOps & Tools', NULL, 5,
  'Established Git workflows and branching strategies',
  'Enabled parallel development and code review processes',
  'Supported 50+ developers with zero code conflicts',
  NULL, NULL);

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (14, 'graphql-1', 'GraphQL', '3 years professional experience', 3, 80, 'Advanced', 
  'Built GraphQL APIs for flexible data querying.', 
  'DevOps & Tools', '2024-Present', 5,
  'Developed GraphQL APIs with schema-first design',
  'Improved client flexibility and reduced over-fetching',
  'Reduced data transfer by 45% vs REST',
  'Mobile API Gateway', 'E-commerce Platform');

INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project, employer)
VALUES (15, 'testing-1', 'Automated Testing', '8 years professional experience', 8, 88, 'Advanced', 
  'Implemented comprehensive testing strategies including unit, integration, and E2E tests.', 
  'DevOps & Tools', NULL, 5,
  'Established testing pyramid with 80%+ code coverage',
  'Caught bugs early and improved code quality',
  'Reduced production bugs by 70%',
  NULL, NULL);

-- Note: Vector embeddings will be generated separately via the Worker /index endpoint
