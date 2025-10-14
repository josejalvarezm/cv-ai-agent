-- Example data insertion for "Frontend Development" category

-- 1. Insert category
INSERT INTO technology_category (name) VALUES ('Frontend Development');

-- 2. Insert technologies for this category
-- Category ID will be 1 if this is the first insert

INSERT INTO technology (
  stable_id,
  name,
  experience,
  experience_years,
  proficiency_percent,
  level,
  summary,
  category,
  recency,
  category_id
) VALUES
(
  'angular-1',
  'Angular',
  '3+ years',
  3,
  85,
  'Advanced',
  'Developed enterprise Angular applications for 3+ years, leveraging reactive patterns and modular component design.',
  'Frontend Development',
  NULL,
  1
),
(
  'rxjs-1',
  'RxJS',
  '3+ years',
  3,
  85,
  'Advanced',
  'Utilized RxJS for 3+ years to manage asynchronous data streams and event-driven interactions in Angular applications.',
  'Frontend Development',
  NULL,
  1
),
(
  'typescript-1',
  'TypeScript',
  '6+ years',
  6,
  88,
  'Advanced',
  'Wrote type-safe applications with TypeScript for 6+ years, improving code quality and developer experience.',
  'Frontend Development',
  NULL,
  1
),
(
  'javascript-1',
  'JavaScript',
  '19 years',
  19,
  95,
  'Expert',
  'Core JavaScript expertise spanning 19 years, building interactive web applications and modern frontend solutions.',
  'Frontend Development',
  NULL,
  1
),
(
  'clarity-design-1',
  'Clarity Design',
  '2025-Present',
  1,
  80,
  'Advanced',
  'Adopted Clarity Design System for modern Angular applications, ensuring consistent and accessible UI patterns.',
  'Frontend Development',
  '2025–Present',
  1
);

-- Note: Vector embeddings would be inserted separately after generation
-- See seed-database.js for the full implementation
