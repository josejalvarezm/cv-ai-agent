/**
 * D1 Repository - Abstraction layer for D1 database operations
 * Implements repository pattern for skill and technology data access
 */

import { type Skill } from '../utils';

export class D1Repository {
  constructor(private db: D1Database) {}

  /**
   * Get a skill by ID
   */
  async getSkillById(id: number): Promise<Skill | null> {
    return await this.db.prepare('SELECT * FROM skills WHERE id = ?')
      .bind(id)
      .first<Skill>();
  }

  /**
   * Get technology by ID (mapped to Skill interface)
   */
  async getTechnologyById(id: number): Promise<Skill | null> {
    const tech = await this.db.prepare(
      'SELECT id, name, experience as description, experience_years as years FROM technology WHERE id = ?'
    ).bind(id).first<any>();
    
    if (!tech) return null;

    return {
      id: tech.id,
      name: tech.name,
      mastery: typeof tech.experience === 'string' ? tech.experience : '',
      years: tech.years || 0,
      category: undefined,
      description: tech.description || tech.experience || undefined,
      action: tech.action,
      effect: tech.effect,
      outcome: tech.outcome,
      related_project: tech.related_project,
    };
  }

  /**
   * Get all skills with pagination
   */
  async getSkills(limit: number, offset: number = 0) {
    return await this.db.prepare(
      'SELECT id, name, mastery, years, category, description, last_used FROM skills ORDER BY id LIMIT ? OFFSET ?'
    ).bind(limit, offset).all<Skill>();
  }

  /**
   * Get all technology with pagination
   */
  async getTechnology(limit: number, offset: number = 0) {
    return await this.db.prepare(
      'SELECT id, category_id, name, experience, experience_years FROM technology ORDER BY id LIMIT ? OFFSET ?'
    ).bind(limit, offset).all<any>();
  }

  /**
   * Get skill count
   */
  async getSkillCount(): Promise<number> {
    const result = await this.db.prepare('SELECT COUNT(*) as count FROM skills').first<{ count: number }>();
    return result?.count || 0;
  }

  /**
   * Get technology count
   */
  async getTechnologyCount(): Promise<number> {
    const result = await this.db.prepare('SELECT COUNT(*) as total FROM technology').first<{ total: number }>();
    return result?.total || 0;
  }

  /**
   * Get all technology IDs
   */
  async getAllTechnologyIds(): Promise<number[]> {
    const rows = await this.db.prepare('SELECT id FROM technology ORDER BY id').all();
    return (rows.results || []).map((r: any) => r.id);
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.db.prepare('SELECT 1').first();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get last index metadata
   */
  async getLastIndexMetadata() {
    return await this.db.prepare(
      'SELECT version, indexed_at, total_skills, status FROM index_metadata ORDER BY version DESC LIMIT 1'
    ).first();
  }

  /**
   * Create index metadata table if not exists
   */
  async ensureIndexMetadataTable(): Promise<void> {
    await this.db.prepare(
      `CREATE TABLE IF NOT EXISTS index_metadata (
        version INTEGER PRIMARY KEY,
        indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        total_skills INTEGER,
        status TEXT
      )`
    ).run();
  }

  /**
   * Create index metadata record
   */
  async createIndexMetadata(version: number): Promise<void> {
    await this.db.prepare(
      'INSERT INTO index_metadata (version, total_skills, status) VALUES (?, ?, ?)'
    ).bind(version, 0, 'in_progress').run();
  }

  /**
   * Get max index version
   */
  async getMaxIndexVersion(): Promise<number> {
    const lastVersion = await this.db.prepare('SELECT MAX(version) as last_version FROM index_metadata').first();
    return (lastVersion?.last_version as number || 0);
  }

  /**
   * Update index metadata
   */
  async updateIndexMetadata(version: number, totalSkills: number, status: string): Promise<void> {
    await this.db.prepare(
      'UPDATE index_metadata SET total_skills = COALESCE(total_skills,0) + ?, status = ? WHERE version = ?'
    ).bind(totalSkills, status, version).run();
  }

  /**
   * Insert vector embedding into D1 vectors table
   */
  async insertVector(itemType: string, itemId: number, embedding: ArrayBuffer, metadata: any): Promise<void> {
    await this.db.prepare(
      'INSERT INTO vectors (item_type, item_id, embedding, metadata) VALUES (?, ?, ?, ?)'
    ).bind(itemType, itemId, embedding, JSON.stringify(metadata)).run();
  }

  /**
   * Get vector debug info
   */
  async getVectorDebugInfo() {
    const { results } = await this.db.prepare(
      'SELECT id, item_id, LENGTH(embedding) as size, typeof(embedding) as type FROM vectors LIMIT 1'
    ).all();
    const vec = results[0] as any;
    
    const { results: vecData } = await this.db.prepare('SELECT * FROM vectors LIMIT 1').all();
    const fullVec = vecData[0] as any;

    return {
      id: vec?.id,
      item_id: vec?.item_id,
      size: vec?.size,
      sqlType: vec?.type,
      jsType: typeof fullVec?.embedding,
      isArrayBuffer: fullVec?.embedding instanceof ArrayBuffer,
      isUint8Array: fullVec?.embedding instanceof Uint8Array,
      constructorName: fullVec?.embedding?.constructor?.name,
      byteLength: ArrayBuffer.isView(fullVec?.embedding) ? (fullVec.embedding as any).byteLength : undefined,
      byteOffset: ArrayBuffer.isView(fullVec?.embedding) ? (fullVec.embedding as any).byteOffset : undefined,
    };
  }
}
