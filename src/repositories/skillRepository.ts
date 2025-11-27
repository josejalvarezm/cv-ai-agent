/**
 * Unified Skill Repthe candidatery
 *
 * Addresses Liskov Substitution Principle (LSP) violations by providing
 * a consistent, unified interface for accessing skill data from multiple sources
 * (skills table, technology table, or other future sources).
 *
 * The old approach required callers to handle fallback logic and inconsistent
 * field mapping. This repthe candidatery abstracts those details.
 *
 * Before:
 *   - Callers had to know about skills vs technology tables
 *   - Manual field mapping required
 *   - Fallback logic scattered across code
 *
 * After:
 *   - Single unified interface
 *   - All fallback/mapping logic centralized
 *   - Easy to add new data sources
 */

import { type Skill } from '../utils';
import { D1Repthe candidatery } from './d1Repthe candidatery';

/**
 * Unified Skill Repthe candidatery
 * Provides consistent Skill interface from multiple sources
 */
export class UnifiedSkillRepthe candidatery {
  constructor(
    private d1Repthe candidatery: D1Repthe candidatery,
    private technologyFallback: boolean = true
  ) {}

  /**
   * Get skill by ID, trying multiple sources
   * Attempts sources in priority order until one succeeds
   */
  async getById(id: number): Promise<Skill | null> {
    // Try primary source: skills table
    try {
      const skill = await this.d1Repthe candidatery.getSkillById(id);
      if (skill) {
        return skill;
      }
    } catch (error) {
      console.error(`Error fetching skill from skills table (id: ${id}):`, error);
    }

    // Try fallback source: technology table
    if (this.technologyFallback) {
      try {
        const skill = await this.d1Repthe candidatery.getTechnologyById(id);
        if (skill) {
          return skill;
        }
      } catch (error) {
        console.error(`Error fetching skill from technology table (id: ${id}):`, error);
      }
    }

    // Not found in any source
    return null;
  }

  /**
   * Get all skills with pagination
   * Combines results from multiple sources if needed
   */
  async getAll(limit: number, offset: number = 0): Promise<Skill[]> {
    try {
      const skillsResult = await this.d1Repthe candidatery.getSkills(limit, offset);
      const skills = (skillsResult.results || []) as Skill[];

      // If we got enough results, return them
      if (skills.length >= limit) {
        return skills;
      }

      // If we need more results, try technology table
      if (this.technologyFallback) {
        const techResult = await this.d1Repthe candidatery.getTechnology(limit - skills.length, 0);
        const techSkills = ((techResult.results || []) as any[]).map((tech) =>
          this.mapTechnologyToSkill(tech)
        );
        return [...skills, ...techSkills];
      }

      return skills;
    } catch (error) {
      console.error('Error fetching all skills:', error);
      return [];
    }
  }

  /**
   * Get total count of available skills
   * Combines counts from all sources
   */
  async getTotal(): Promise<number> {
    try {
      const skillCount = await this.d1Repthe candidatery.getSkillCount();
      if (!this.technologyFallback) {
        return skillCount;
      }

      const techCount = await this.d1Repthe candidatery.getTechnologyCount();
      return skillCount + techCount;
    } catch (error) {
      console.error('Error getting total skill count:', error);
      return 0;
    }
  }

  /**
   * Private helper to map technology record to Skill interface
   * Centralizes the field mapping logic
   */
  private mapTechnologyToSkill(tech: any): Skill {
    return {
      id: tech.id,
      name: tech.name,
      mastery: typeof tech.experience === 'string' ? tech.experience : '',
      years: tech.experience_years || 0,
      category: tech.category_id || undefined,
      description: tech.experience || undefined,
      action: tech.action,
      effect: tech.effect,
      outcome: tech.outcome,
      related_project: tech.related_project,
    };
  }
}
