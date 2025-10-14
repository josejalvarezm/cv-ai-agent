-- Seed data generated from technologies-content-enriched.json

-- Insert categories
INSERT INTO technology_category (id, name) VALUES (1, 'Architecture & Design');
INSERT INTO technology_category (id, name) VALUES (2, 'Frontend Development');
INSERT INTO technology_category (id, name) VALUES (3, 'Backend Development');
INSERT INTO technology_category (id, name) VALUES (4, 'Database & Performance');
INSERT INTO technology_category (id, name) VALUES (5, 'Cloud & DevOps');
INSERT INTO technology_category (id, name) VALUES (6, 'Modern Development Practices');
INSERT INTO technology_category (id, name) VALUES (7, 'Technical Research & Prototyping');
INSERT INTO technology_category (id, name) VALUES (8, 'Edge Architectures (Production)');
INSERT INTO technology_category (id, name) VALUES (9, 'Legacy Development');

-- Insert technologies

-- Architecture & Design
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (1, 'full-stack-service-decomposition-1', 'Full-Stack Service Decomposition', '5+ years (CCHQ)', 5, 85, 'Advanced', 'Decomposed monolithic applications into independent full-stack services at CCHQ, enabling team autonomy and faster deployment cycles.', 'Architecture & Design', NULL, 1);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (2, 'service-oriented-architecture-1', 'Service-Oriented Architecture', '8+ years', 8, 88, 'Advanced', 'Designed and implemented service-oriented architectures across enterprise systems for 8+ years, improving modularity and integration flexibility.', 'Architecture & Design', NULL, 1);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (3, 'restful-apis-1', 'RESTful APIs', '10+ years', 10, 90, 'Expert', 'Built and maintained RESTful APIs for 10+ years, delivering scalable and well-documented interfaces for client-server communication.', 'Architecture & Design', NULL, 1);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (4, 'component-based-architecture-1', 'Component-Based Architecture', '3+ years', 3, 85, 'Advanced', 'Developed reusable component-based architectures for 3+ years, improving code maintainability and development velocity.', 'Architecture & Design', NULL, 1);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (5, 'independent-deployment-1', 'Independent Deployment', '5+ years', 5, 85, 'Advanced', 'Enabled independent deployment pipelines for services over 5+ years, reducing release coordination overhead and deployment risk.', 'Architecture & Design', NULL, 1);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (6, 'message-queue-patterns-1', 'Message Queue Patterns', '8+ years (MSMQ, SQL-based)', 8, 85, 'Advanced', 'Implemented message queue patterns using MSMQ and SQL-based queues for 8+ years, ensuring reliable asynchronous processing.', 'Architecture & Design', NULL, 1);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (7, 'edge-architectures-1', 'Edge Architectures', '1+ years', 1, 80, 'Advanced', 'Architected edge computing solutions to reduce latency and improve global content delivery performance.', 'Architecture & Design', '2024–Present', 1);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (8, 'microservices-principles-1', 'Microservices Principles', '5+ years', 5, 85, 'Advanced', 'Applied microservices principles over 5+ years to decompose systems into independently deployable, loosely-coupled services.', 'Architecture & Design', NULL, 1);

-- Frontend Development
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (9, 'angular-1', 'Angular', '3+ years', 3, 85, 'Advanced', 'Developed enterprise Angular applications for 3+ years, leveraging reactive patterns and modular component design.', 'Frontend Development', NULL, 2);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (10, 'rxjs-1', 'RxJS', '3+ years', 3, 85, 'Advanced', 'Utilized RxJS for 3+ years to manage asynchronous data streams and event-driven interactions in Angular applications.', 'Frontend Development', NULL, 2);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (11, 'typescript-1', 'TypeScript', '6+ years', 6, 88, 'Advanced', 'Wrote type-safe applications with TypeScript for 6+ years, improving code quality and developer experience.', 'Frontend Development', NULL, 2);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (12, 'javascript-1', 'JavaScript', '19 years', 19, 95, 'Expert', 'Core JavaScript expertise spanning 19 years, building interactive web applications and modern frontend solutions.', 'Frontend Development', NULL, 2);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (13, 'angularjs-1', 'AngularJS', '10 years', 10, 90, 'Expert', 'Built and maintained AngularJS applications over 10 years, delivering dynamic SPAs for enterprise clients.', 'Frontend Development', NULL, 2);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (14, 'bootstrap-1', 'Bootstrap', '8+ years', 8, 85, 'Advanced', 'Designed responsive, mobile-first interfaces with Bootstrap for 8+ years, accelerating UI development.', 'Frontend Development', NULL, 2);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (15, 'clarity-design-1', 'Clarity Design', '2025-Present', 1, 80, 'Advanced', 'Adopted Clarity Design System for modern Angular applications, ensuring consistent and accessible UI patterns.', 'Frontend Development', '2025–Present', 2);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (16, 'playwright-1', 'Playwright', '2024-Present', 2, 40, 'Intermediate', 'Implemented end-to-end tests with Playwright to validate cross-browser functionality and UI behavior.', 'Frontend Development', '2024–Present', 2);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (17, 'react-with-typescript-1', 'React with TypeScript', 'Development/Research', 1, 75, 'Advanced', 'Explored React with TypeScript through development and research, building component-based prototypes.', 'Frontend Development', NULL, 2);

-- Backend Development
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (18, 'csharp-1', 'C#', '19 years', 19, 95, 'Expert', 'Deep expertise in C# spanning 19 years, delivering enterprise-grade backend systems and services.', 'Backend Development', NULL, 3);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (19, 'aspnet-core-1', 'ASP.NET Core', '5+ years', 5, 90, 'Expert', 'Developed high-performance ASP.NET Core APIs and web applications for 5+ years, supporting modern cloud deployments.', 'Backend Development', NULL, 3);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (20, 'dotnet-6plus-1', '.NET 6+', '3+ years', 3, 85, 'Advanced', 'Built modern .NET 6+ applications for 3+ years, leveraging latest framework features and performance improvements.', 'Backend Development', NULL, 3);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (21, 'restful-apis-2', 'RESTful APIs', '10+ years', 10, 90, 'Expert', 'Built and maintained RESTful APIs for 10+ years, enabling seamless integration and scalable backend architecture.', 'Backend Development', NULL, 3);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (22, 'full-stack-service-architecture-1', 'Full-Stack Service Architecture', '5+ years (CCHQ)', 5, 85, 'Advanced', 'Architected full-stack services at CCHQ over 5+ years, enabling autonomous teams and streamlined service ownership.', 'Backend Development', NULL, 3);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (23, 'windows-services-1', 'Windows Services', '8+ years (thousands records/sec)', 8, 85, 'Advanced', 'Developed high-throughput Windows Services for 8+ years, processing thousands of records per second reliably.', 'Backend Development', NULL, 3);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (24, 'msmq-sql-based-queues-1', 'MSMQ & SQL-based Queues', '8+ years', 8, 85, 'Advanced', 'Implemented reliable message queuing with MSMQ and SQL-based queues over 8+ years, ensuring fault-tolerant processing.', 'Backend Development', NULL, 3);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (25, 'nodejs-1', 'Node.js', '2025', 1, 80, 'Advanced', 'Built serverless and backend services with Node.js, leveraging JavaScript for full-stack development.', 'Backend Development', '2025–Present', 3);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (26, 'azure-functions-nodejs-typescript-1', 'Azure Functions (Node.js/TypeScript)', '2025', 1, 85, 'Advanced', 'Deployed serverless Azure Functions using Node.js and TypeScript for scalable, event-driven backend processing.', 'Backend Development', '2025–Present', 3);

-- Database & Performance
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (27, 'sql-server-1', 'SQL Server', '20+ years', 20, 95, 'Expert', 'Expert-level SQL Server administration and development over 20+ years, supporting mission-critical enterprise databases.', 'Database & Performance', NULL, 4);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (28, 'tsql-performance-tuning-1', 'T-SQL Performance Tuning', '20+ years', 20, 95, 'Expert', 'Optimized T-SQL queries and database performance for 20+ years, achieving significant response time and throughput gains.', 'Database & Performance', NULL, 4);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (29, 'daab-enterprise-library-1', 'DAAB/Enterprise Library', '11+ years', 11, 90, 'Expert', 'Utilized Data Access Application Block and Enterprise Library for 11+ years, standardizing enterprise data access patterns.', 'Database & Performance', NULL, 4);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (30, 'entity-framework-4-1', 'Entity Framework 4', '5 years total (discontinued after 2)', 5, 70, 'Intermediate', 'Applied Entity Framework 4 for ORM-based data access before discontinuing use after 2 years due to project constraints.', 'Database & Performance', NULL, 4);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (31, 'oracle-1', 'Oracle', '5+ years', 5, 75, 'Advanced', 'Worked with Oracle databases for 5+ years, managing data storage and complex queries for enterprise applications.', 'Database & Performance', NULL, 4);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (32, 'azure-cosmos-db-1', 'Azure Cosmos DB', '2025', 1, 80, 'Advanced', 'Integrated Azure Cosmos DB for globally distributed, low-latency NoSQL data storage in cloud-native applications.', 'Database & Performance', '2025–Present', 4);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (33, 'mongodb-api-1', 'MongoDB API', '2025', 1, 75, 'Advanced', 'Leveraged MongoDB API with Cosmos DB for flexible, document-based data modeling in modern serverless solutions.', 'Database & Performance', '2025–Present', 4);

-- Cloud & DevOps
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (34, 'azure-devops-1', 'Azure DevOps', '5+ years', 5, 85, 'Advanced', 'Managed CI/CD pipelines and project workflows with Azure DevOps for 5+ years, streamlining release automation.', 'Cloud & DevOps', NULL, 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (35, 'azure-blob-storage-1', 'Azure Blob Storage', '5+ years', 5, 85, 'Advanced', 'Utilized Azure Blob Storage for 5+ years to store and serve large files and media content reliably.', 'Cloud & DevOps', NULL, 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (36, 'azure-cognitive-services-1', 'Azure Cognitive Services', '3+ years', 3, 75, 'Advanced', 'Integrated Azure Cognitive Services for 3+ years, adding AI capabilities like vision and natural language processing.', 'Cloud & DevOps', NULL, 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (37, 'azure-static-web-apps-1', 'Azure Static Web Apps', '2024-Present', 1, 85, 'Advanced', 'Deployed modern web applications using Azure Static Web Apps, leveraging global CDN and integrated backend APIs.', 'Cloud & DevOps', '2024–Present', 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (38, 'azure-cdn-1', 'Azure CDN', '3+ years', 3, 75, 'Advanced', 'Configured Azure CDN for 3+ years to accelerate content delivery and reduce latency for global users.', 'Cloud & DevOps', NULL, 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (39, 'git-1', 'Git', '8+ years', 8, 85, 'Advanced', 'Managed source control with Git for 8+ years, supporting collaborative development and branching strategies.', 'Cloud & DevOps', NULL, 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (40, 'cicd-pipelines-1', 'CI/CD Pipelines', '5+ years', 5, 80, 'Advanced', 'Designed and maintained CI/CD pipelines for 5+ years, automating build, test, and deployment workflows.', 'Cloud & DevOps', NULL, 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (41, 'appdynamics-1', 'AppDynamics', '9+ years', 9, 80, 'Advanced', 'Monitored application performance with AppDynamics for 9+ years, identifying bottlenecks and improving user experience.', 'Cloud & DevOps', NULL, 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (42, 'terraform-1', 'Terraform', '1+ years', 1, 80, 'Advanced', 'Adopted Terraform for infrastructure as code, enabling repeatable and version-controlled cloud provisioning.', 'Cloud & DevOps', NULL, 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (43, 'cloudflare-dns-cdn-1', 'Cloudflare DNS/CDN', '2024-Present', 1, 80, 'Advanced', 'Leveraged Cloudflare DNS and CDN for fast, secure global content delivery with DDoS protection.', 'Cloud & DevOps', '2024–Present', 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (44, 'cloudflare-workers-1', 'Cloudflare Workers', '2024-Present (Production)', 1, 85, 'Advanced', 'Deployed serverless edge functions with Cloudflare Workers in production, achieving zero-cost hosting and low latency.', 'Cloud & DevOps', '2024–Present', 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (45, 'cloudflare-pages-1', 'Cloudflare Pages', '2024-Present (Production)', 1, 85, 'Advanced', 'Published static sites with Cloudflare Pages in production, integrating seamless Git-based deployments.', 'Cloud & DevOps', '2024–Present', 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (46, 'azure-functions-nodejs-typescript-2', 'Azure Functions (Node.js/TypeScript)', '2025', 1, 85, 'Advanced', 'Deployed serverless Azure Functions with Node.js and TypeScript for event-driven, scalable backend workloads.', 'Cloud & DevOps', '2025–Present', 5);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (47, 'playwright-testing-1', 'Playwright Testing', '2024-Present', 2, 40, 'Intermediate', 'Implemented Playwright for end-to-end testing, validating application behavior across multiple browsers.', 'Cloud & DevOps', '2024–Present', 5);

-- Modern Development Practices
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (48, 'serverless-architecture-1', 'Serverless Architecture', '2025', 1, 85, 'Advanced', 'Designed serverless architectures to eliminate infrastructure management and reduce operational costs.', 'Modern Development Practices', '2025–Present', 6);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (49, 'low-cost-infrastructure-design-1', 'Low-Cost Infrastructure Design', '2024-Present', 1, 85, 'Advanced', 'Architected cost-efficient infrastructure solutions, minimizing cloud spend while maintaining performance and scalability.', 'Modern Development Practices', '2024–Present', 6);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (50, 'azure-static-web-apps-2', 'Azure Static Web Apps', '2024-Present', 1, 85, 'Advanced', 'Deployed static web applications using Azure Static Web Apps for simplified hosting and integrated APIs.', 'Modern Development Practices', '2024–Present', 6);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (51, 'cloudflare-dns-cdn-2', 'Cloudflare DNS/CDN', '2024-Present', 1, 80, 'Advanced', 'Utilized Cloudflare DNS and CDN for secure, high-performance content delivery with built-in security features.', 'Modern Development Practices', '2024–Present', 6);

-- Technical Research & Prototyping
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (52, 'containerization-orchestration-1', 'Containerization & Orchestration', 'Docker, Kubernetes (pod replicas, self-healing)', 1, 75, 'Advanced', 'Prototyped containerized applications with Docker and Kubernetes, exploring self-healing and scalable pod orchestration.', 'Technical Research & Prototyping', NULL, 7);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (53, 'message-brokers-patterns-1', 'Message Brokers & Patterns', 'RabbitMQ (pub/sub patterns)', 1, 75, 'Advanced', 'Researched RabbitMQ pub/sub patterns for decoupled messaging and event-driven architecture prototypes.', 'Technical Research & Prototyping', NULL, 7);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (54, 'distributed-caching-1', 'Distributed Caching', 'Redis', 1, 70, 'Advanced', 'Experimented with Redis for distributed caching to improve application performance and reduce database load.', 'Technical Research & Prototyping', NULL, 7);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (55, 'concurrency-models-1', 'Concurrency Models', 'Akka.NET (Actor Model)', 1, 70, 'Advanced', 'Explored Akka.NET''s actor model for building concurrent, fault-tolerant systems with message-driven architecture.', 'Technical Research & Prototyping', NULL, 7);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (56, 'frontend-frameworks-1', 'Frontend Frameworks', 'React, Bootstrap, Clarity Design', 1, 75, 'Advanced', 'Researched and prototyped with React, Bootstrap, and Clarity Design for modern, component-based UI development.', 'Technical Research & Prototyping', NULL, 7);

-- Edge Architectures (Production)
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (57, 'cloudflare-workers-2', 'Cloudflare Workers', 'Globally distributed, zero‑cost hosting', 1, 85, 'Advanced', 'Deployed production Cloudflare Workers for globally distributed, zero-cost edge compute with minimal latency.', 'Edge Architectures (Production)', '2024–Present', 8);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (58, 'cloudflare-pages-2', 'Cloudflare Pages', 'Technical blog deployment', 1, 85, 'Advanced', 'Published technical blog using Cloudflare Pages for fast, globally distributed static site hosting.', 'Edge Architectures (Production)', '2024–Present', 8);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (59, 'infrastructure-as-code-1', 'Infrastructure as Code', 'Terraform‑based workflows (Exploratory)', 1, 65, 'Intermediate', 'Explored Terraform-based infrastructure workflows to automate provisioning and version-control cloud resources.', 'Edge Architectures (Production)', NULL, 8);

-- Legacy Development
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (60, 'vbnet-1', 'VB.NET', '8+ years', 8, 90, 'Expert', 'Maintained and extended VB.NET enterprise applications for 8+ years, supporting legacy systems and migrations.', 'Legacy Development', NULL, 9);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (61, 'wpf-1', 'WPF', '8+ years', 8, 85, 'Advanced', 'Developed Windows Presentation Foundation desktop applications for 8+ years with rich, data-bound UIs.', 'Legacy Development', NULL, 9);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (62, 'silverlight-1', 'Silverlight', '5+ years', 5, 80, 'Advanced', 'Built Silverlight-based rich internet applications for 5+ years before platform deprecation.', 'Legacy Development', NULL, 9);
INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id)
VALUES (63, 'aspnet-mvc-webforms-1', 'ASP.NET MVC/WebForms', '8+ years', 8, 85, 'Advanced', 'Developed and maintained ASP.NET MVC and WebForms applications for 8+ years, supporting enterprise web solutions.', 'Legacy Development', NULL, 9);

-- Note: Vector embeddings will be generated separately via Worker
