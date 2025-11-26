/**
 * Indexing Service
 *
 * Addresses Single Responsibility Principle (SRP) by extracting all indexing
 * orchestration logic from handlers into a focused service.
 *
 * Responsibilities:
 * - Manage indexing locks (prevent concurrent runs)
 * - Fetch batches from database
 * - Generate embeddings for items
 * - Upsert vectors to stores
 * - Track indexing metadata
 * - Support checkpoint/resume
 *
 * Before: Complex logic scattered across indexHandler.ts
 * After: Focused service with clear inputs/outputs
 */

import { type ServiceContainer } from './container';
import { generateEmbedding } from './embeddingService';
import { ConflictError } from '../types/errors';
import { getLogger } from '../utils/logger';
import { INDEX_CONFIG } from '../config';
import { createSkillText, type Skill } from '../utils';

/**
 * Indexing request parameters
 */
export interface IndexingRequest {
  type?: 'skills' | 'technology';
  batchSize?: number;
  offset?: number;
}

/**
 * Indexing response
 */
export interface IndexingResponse {
  success: boolean;
  message: string;
  version: number;
  processed: number;
  itemType: string;
  nextOffset?: number;
  hasMore?: boolean;
}

/**
 * Indexing Service
 * Orchestrates vector indexing operations
 */
export class IndexingService {
  private lockTimeout = 120; // seconds

  constructor(private services: ServiceContainer, private ai: Ai) {}

  /**
   * Execute indexing operation
   */
  async execute(request: IndexingRequest): Promise<IndexingResponse> {
    const logger = getLogger();
    const itemType = request.type === 'technology' ? 'technology' : 'skills';
    const lockKey = `index:lock:${itemType}`;

    // Acquire lock
    const acquired = await this.services.kvRepository.acquireLock(lockKey, this.lockTimeout);
    if (!acquired) {
      logger.serviceError(`Indexing already in progress for ${itemType}`);
      throw new ConflictError(`Indexing already in progress for ${itemType}`);
    }

    try {
      logger.service(`Starting indexing for ${itemType}`);

      // Ensure metadata table exists
      await this.services.d1Repository.ensureIndexMetadataTable();

      // Determine version
      const version = (await this.services.d1Repository.getMaxIndexVersion()) + 1;

      // Create indexing record
      await this.services.d1Repository.createIndexMetadata(version);

      // Determine batch parameters
      const batchSize = request.batchSize
        ? request.batchSize
        : itemType === 'technology'
          ? INDEX_CONFIG.TECHNOLOGY_BATCH_SIZE
          : INDEX_CONFIG.DEFAULT_BATCH_SIZE;
      const offset = request.offset ?? 0;

      // Fetch batch from database
      const itemsResult =
        itemType === 'technology'
          ? await this.services.d1Repository.getTechnology(batchSize, offset)
          : await this.services.d1Repository.getSkills(batchSize, offset);
      const items = itemsResult.results || [];

      if (!items.length) {
        await this.services.d1Repository.updateIndexMetadata(version, 0, 'completed');
        return {
          success: true,
          message: 'No items to index',
          version,
          processed: 0,
          itemType,
        };
      }

      // Index items
      const processed = await this.indexBatch(items, version, itemType, batchSize);

      // Update metadata
      await this.services.d1Repository.updateIndexMetadata(version, processed, 'in_progress');

      return {
        success: true,
        message: `Indexed ${processed} ${itemType} items`,
        version,
        processed,
        itemType,
        nextOffset: offset + batchSize,
        hasMore: items.length === batchSize,
      };
    } finally {
      // Release lock
      await this.services.kvRepository.releaseLock(lockKey);
    }
  }

  /**
   * Index a batch of items
   */
  private async indexBatch(items: any[], version: number, itemType: string, batchSize: number): Promise<number> {
    const logger = getLogger();
    const vectors: Array<{ id: string; values: number[]; metadata: any }> = [];

    for (const item of items) {
      try {
        // Generate rich text representation for better semantic matching
        const text =
          itemType === 'technology'
            ? this.buildTechnologyEmbeddingText(item)
            : createSkillText(item as Skill);

        // Generate embedding
        const embedding = await generateEmbedding(text, this.ai);

        // Create vector with metadata
        const idKey = `${itemType}-${item.id}`;
        const metadata = {
          id: item.id,
          version,
          name: item.name,
          mastery: itemType === 'technology' ? item.experience : item.mastery,
          years: itemType === 'technology' ? item.experience_years : item.years,
          category: itemType === 'technology' ? item.category_id : item.category || '',
        };

        vectors.push({
          id: idKey,
          values: embedding,
          metadata,
        });

        logger.vector(`Embedded ${idKey} (${vectors.length}/${batchSize})`);
      } catch (error) {
        logger.vectorError(`Error indexing ${itemType} item ${item.id}`, undefined, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Upsert vectors to store
    if (vectors.length > 0) {
      try {
        await this.services.vectorStore.upsert(vectors);
        logger.vectorOperation('upsert', vectors.length, 0);
      } catch (error) {
        logger.vectorError('Error upserting vectors', undefined, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    return vectors.length;
  }

  /**
   * Get indexing progress
   */
  async getProgress(_itemType: string = 'skills'): Promise<any> {
    const logger = getLogger();

    try {
      const metadata = await this.services.d1Repository.getLastIndexMetadata();
      return metadata
        ? {
            version: metadata.version,
            indexed_at: metadata.indexed_at,
            total_skills: metadata.total_skills,
            status: metadata.status,
          }
        : { error: 'No indexing metadata found', status: 'never' };
    } catch (error) {
      logger.databaseError('Error getting index progress', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Resume interrupted indexing
   */
  async resume(itemType: string = 'skills', batchSize?: number): Promise<IndexingResponse> {
    const request: IndexingRequest = {
      type: itemType as 'skills' | 'technology',
      batchSize,
    };
    return this.execute(request);
  }

  /**
   * Build rich embedding text for technology items
   * Includes name, experience, summary, and outcome for better semantic matching
   */
  private buildTechnologyEmbeddingText(item: any): string {
    const parts: string[] = [];
    
    // Core identification
    parts.push(item.name);
    if (item.experience) parts.push(item.experience);
    if (item.level) parts.push(item.level);
    
    // Rich context for semantic search
    if (item.summary) parts.push(item.summary);
    if (item.action) parts.push(item.action);
    if (item.effect) parts.push(item.effect);
    if (item.outcome) parts.push(item.outcome);
    if (item.related_project) parts.push(item.related_project);
    
    return parts.join(' ');
  }
}
