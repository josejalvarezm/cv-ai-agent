/**
 * Admin Apply Handler
 * POST /api/admin/apply - Apply staged changes from Admin Worker
 * 
 * Receives operations from cv-admin-worker and applies them to:
 * 1. D1 database (technology table)
 * 2. Vectorize index (semantic search)
 * 
 * Supports webhook callback for async status notification
 */

import { createServiceContainer } from '../services/container';
import { getLogger, createContext, Timer } from '../utils/logger';
import { errorToResponse, ValidationError } from '../types/errors';
import { type FullEnv } from '../types/env';
import { generateEmbedding } from '../services/embeddingService';

interface ApplyOperation {
    inserts: TechnologyInsert[];
    updates: TechnologyUpdate[];
    deletes: (string | number)[];
}

interface TechnologyInsert {
    id?: number;
    stable_id?: string;
    name: string;
    experience?: string;
    experience_years?: number;
    proficiency_percent?: number;
    level?: string;
    summary?: string;
    category?: string;
    recency?: string;
    action?: string;
    effect?: string;
    outcome?: string;
    related_project?: string;
    employer?: string;
}

interface TechnologyUpdate {
    id: string | number;
    changes: Partial<TechnologyInsert>;
}

interface ApplyRequest {
    job_id: string;
    operations: ApplyOperation;
    callback_url?: string;
}

interface ApplyResult {
    success: boolean;
    async?: boolean;
    inserted: number;
    updated: number;
    deleted: number;
    message: string;
    errors?: string[];
}

/**
 * POST /api/admin/apply
 * Apply operations and optionally send webhook callback
 */
export async function handleAdminApply(request: Request, env: FullEnv): Promise<Response> {
    const requestId = crypto.randomUUID();
    const logger = getLogger();
    const timer = new Timer();
    const context = createContext(requestId, { handler: 'handleAdminApply' });

    try {
        logger.apiRequest('POST', '/api/admin/apply', context);

        // Parse request body
        const body: ApplyRequest = await request.json();
        const { job_id, operations, callback_url } = body;

        if (!job_id) {
            throw new ValidationError('job_id is required');
        }

        if (!operations) {
            throw new ValidationError('operations object is required');
        }

        const services = createServiceContainer(env);
        const result = await applyOperations(operations, env, services, logger, context);

        // If callback URL provided, send webhook with HMAC signature
        if (callback_url) {
            await sendWebhookCallback(
                callback_url,
                {
                    jobId: job_id,
                    source: 'ai-agent',
                    status: result.success ? 'success' : 'failed',
                    message: result.message,
                    error: result.errors?.join('; '),
                    details: {
                        inserted: result.inserted,
                        updated: result.updated,
                        deleted: result.deleted,
                    },
                },
                env.ADMIN_WEBHOOK_SECRET
            );
        }

        logger.apiResponse('POST', '/api/admin/apply', 200, timer.duration(), context);

        return new Response(JSON.stringify({
            ...result,
            requestId,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        logger.apiError(`Admin apply error: ${error}`, context);
        return errorToResponse(error);
    }
}

/**
 * Apply all operations to D1 and Vectorize
 */
async function applyOperations(
    operations: ApplyOperation,
    env: FullEnv,
    services: ReturnType<typeof createServiceContainer>,
    logger: ReturnType<typeof getLogger>,
    context: ReturnType<typeof createContext>
): Promise<ApplyResult> {
    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;
    let deleted = 0;

    // Process inserts (using INSERT OR REPLACE for idempotency)
    for (const item of operations.inserts || []) {
        try {
            // Upsert into D1 - if stable_id exists, replace the row
            const insertResult = await env.DB.prepare(`
        INSERT OR REPLACE INTO technology (
          stable_id, name, experience, experience_years, proficiency_percent,
          level, summary, category, recency, action, effect, outcome,
          related_project, employer
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
                item.stable_id || `tech_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                item.name,
                item.experience || null,
                item.experience_years || null,
                item.proficiency_percent || null,
                item.level || null,
                item.summary || null,
                item.category || null,
                item.recency || null,
                item.action || null,
                item.effect || null,
                item.outcome || null,
                item.related_project || null,
                item.employer || null
            ).run();

            if (insertResult.success) {
                // Generate embedding and upsert to Vectorize
                const insertedId = insertResult.meta.last_row_id;
                await indexTechnology(insertedId as number, item, env, services);
                inserted++;
                logger.service(`Inserted technology: ${item.name}`, context);
            }
        } catch (err) {
            errors.push(`Insert failed for ${item.name}: ${err}`);
            logger.apiError(`Insert failed: ${err}`, context);
        }
    }

    // Process updates
    for (const update of operations.updates || []) {
        try {
            const { id, changes } = update;

            // Build dynamic UPDATE statement
            const setClauses: string[] = [];
            const values: unknown[] = [];

            if (changes.name !== undefined) {
                setClauses.push('name = ?');
                values.push(changes.name);
            }
            if (changes.experience !== undefined) {
                setClauses.push('experience = ?');
                values.push(changes.experience);
            }
            if (changes.experience_years !== undefined) {
                setClauses.push('experience_years = ?');
                values.push(changes.experience_years);
            }
            if (changes.proficiency_percent !== undefined) {
                setClauses.push('proficiency_percent = ?');
                values.push(changes.proficiency_percent);
            }
            if (changes.level !== undefined) {
                setClauses.push('level = ?');
                values.push(changes.level);
            }
            if (changes.summary !== undefined) {
                setClauses.push('summary = ?');
                values.push(changes.summary);
            }
            if (changes.category !== undefined) {
                setClauses.push('category = ?');
                values.push(changes.category);
            }
            if (changes.recency !== undefined) {
                setClauses.push('recency = ?');
                values.push(changes.recency);
            }
            if (changes.action !== undefined) {
                setClauses.push('action = ?');
                values.push(changes.action);
            }
            if (changes.effect !== undefined) {
                setClauses.push('effect = ?');
                values.push(changes.effect);
            }
            if (changes.outcome !== undefined) {
                setClauses.push('outcome = ?');
                values.push(changes.outcome);
            }
            if (changes.related_project !== undefined) {
                setClauses.push('related_project = ?');
                values.push(changes.related_project);
            }
            if (changes.employer !== undefined) {
                setClauses.push('employer = ?');
                values.push(changes.employer);
            }

            if (setClauses.length === 0) {
                continue; // Nothing to update
            }

            // Determine if ID is stable_id or numeric id
            const isStableId = typeof id === 'string' && id.startsWith('tech_');
            const whereClause = isStableId ? 'stable_id = ?' : 'id = ?';
            values.push(id);

            const updateResult = await env.DB.prepare(
                `UPDATE technology SET ${setClauses.join(', ')} WHERE ${whereClause}`
            ).bind(...values).run();

            if (updateResult.success) {
                // Re-index the technology in Vectorize
                const tech = await env.DB.prepare(
                    `SELECT * FROM technology WHERE ${whereClause}`
                ).bind(id).first<TechnologyInsert & { id: number }>();

                if (tech) {
                    await indexTechnology(tech.id, tech, env, services);
                }
                updated++;
                logger.service(`Updated technology: ${id}`, context);
            }
        } catch (err) {
            errors.push(`Update failed for ${update.id}: ${err}`);
            logger.apiError(`Update failed: ${err}`, context);
        }
    }

    // Process deletes
    for (const id of operations.deletes || []) {
        try {
            // Determine if ID is stable_id (string) or numeric id
            const isStableId = typeof id === 'string' && isNaN(parseInt(id, 10));
            const whereClause = isStableId ? 'stable_id = ?' : 'id = ?';
            const bindValue = isStableId ? id : (typeof id === 'number' ? id : parseInt(id, 10));

            // Get numeric ID for Vectorize deletion
            const tech = await env.DB.prepare(
                `SELECT id FROM technology WHERE ${whereClause}`
            ).bind(bindValue).first<{ id: number }>();

            if (!tech) {
                logger.service(`Technology not found for delete: ${id}`, context);
                continue;
            }

            const numericId = tech.id;

            // Delete from D1
            const deleteResult = await env.DB.prepare(
                `DELETE FROM technology WHERE ${whereClause}`
            ).bind(bindValue).run();

            if (deleteResult.success) {
                // Delete from Vectorize (use technology-{id} format)
                try {
                    await env.VECTORIZE.deleteByIds([`technology-${numericId}`]);
                    logger.service(`Deleted vector: technology-${numericId}`, context);
                } catch (vecErr) {
                    logger.apiError(`Vectorize delete failed for technology-${numericId}: ${vecErr}`, context);
                }
                deleted++;
                logger.service(`Deleted technology: ${id} (D1 id: ${numericId})`, context);
            }
        } catch (err) {
            errors.push(`Delete failed for ${id}: ${err}`);
            logger.apiError(`Delete failed: ${err}`, context);
        }
    }

    return {
        success: errors.length === 0,
        inserted,
        updated,
        deleted,
        message: errors.length === 0
            ? `Applied ${inserted} inserts, ${updated} updates, ${deleted} deletes`
            : `Completed with ${errors.length} errors`,
        errors: errors.length > 0 ? errors : undefined,
    };
}

/**
 * Generate embedding and upsert to Vectorize
 */
async function indexTechnology(
    id: number,
    tech: TechnologyInsert,
    env: FullEnv,
    services: ReturnType<typeof createServiceContainer>
): Promise<void> {
    // Build searchable text from all relevant fields
    const parts = [
        tech.name,
        tech.experience,
        tech.summary,
        tech.category,
        tech.action,
        tech.effect,
        tech.outcome,
        tech.related_project,
    ].filter(Boolean);

    const searchText = parts.join(' ');

    // Generate embedding
    const embedding = await services.embeddingService.generate(searchText);

    // Upsert to Vectorize - use 'technology-${id}' format to match indexingService
    await env.VECTORIZE.upsert([{
        id: `technology-${id}`,
        values: embedding,
        metadata: {
            id,
            name: tech.name,
            category: tech.category || 'uncategorized',
            years: tech.experience_years || 0,
        },
    }]);
}

/**
 * Send webhook callback to admin worker with HMAC signature
 */
async function sendWebhookCallback(
    url: string,
    payload: {
        jobId: string;
        source: 'ai-agent';
        status: 'success' | 'failed';
        message: string;
        error?: string;
        details?: Record<string, unknown>;
    },
    webhookSecret?: string
): Promise<void> {
    try {
        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // Sign with HMAC if secret is configured
        if (webhookSecret) {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(webhookSecret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
            const signatureHex = Array.from(new Uint8Array(signature))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
            headers['X-Webhook-Signature'] = signatureHex;
        }

        await fetch(url, {
            method: 'POST',
            headers,
            body,
        });
    } catch (err) {
        console.error('Webhook callback failed:', err);
    }
}
