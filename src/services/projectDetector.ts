/**
 * Project Detector Service
 * 
 * Single Responsibility: Detects if a query is asking about a specific project/company.
 * Extracts project context for more targeted responses.
 */

import type { IProjectDetector, ProjectDetectionResult } from '../types/validators';

interface ProjectPattern {
  pattern: RegExp;
  name: string;
}

/**
 * Project Detector Service Implementation
 * 
 * Identifies project-specific queries (e.g., "skills at CCHQ")
 * and extracts the project name for targeted responses.
 */
export class ProjectDetectorService implements IProjectDetector {
  private readonly projectPatterns: ProjectPattern[] = [
    { pattern: /\b(at|in|for|during|with)\s+(cchq|conservative.*hq|conservative.*party)\b/i, name: 'CCHQ' },
    { pattern: /\b(cchq)\b/i, name: 'CCHQ' },
    { pattern: /\b(at|in|for|during|with)\s+(wairbut)\b/i, name: 'Wairbut' },
    { pattern: /\b(wairbut)\b/i, name: 'Wairbut' },
  ];

  /**
   * Detect if the query is asking about a specific project
   */
  detect(query: string): ProjectDetectionResult {
    const lowerQuery = query.toLowerCase();

    for (const { pattern, name } of this.projectPatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        // Remove the project mention from query for better semantic search
        const cleanQuery = query.replace(pattern, '').trim();
        return {
          isProjectSpecific: true,
          projectName: name,
          cleanQuery: cleanQuery || query, // Fallback to original if cleaning removes everything
        };
      }
    }

    return {
      isProjectSpecific: false,
      cleanQuery: query,
    };
  }

  /**
   * Add a custom project pattern (useful for extensions)
   */
  addProject(pattern: RegExp, name: string): void {
    this.projectPatterns.push({ pattern, name });
  }

  /**
   * Get list of known projects
   */
  getKnownProjects(): string[] {
    return [...new Set(this.projectPatterns.map(p => p.name))];
  }
}
