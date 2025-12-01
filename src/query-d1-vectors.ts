/**
 * Query Handler using Cloudflare Vectorize for semantic search
 * 
 * SOLID-compliant orchestrator that coordinates:
 * - Input validation
 * - Question type validation
 * - Project detection
 * - Vector search
 * - AI inference
 * - Response validation
 * 
 * All business logic is delegated to injectable services via ServiceContainer.
 */

import { canUseAI, incrementQuota, NEURON_COSTS } from './ai-quota';
import {
  validateAndSanitizeInput,
  isWithinBusinessHours,
  getBusinessHoursMessage,
  getCircuitBreakerMessage,
} from './input-validation';
import { SEARCH_CONFIG } from './config';
import { generateEmbedding } from './services/embeddingService';
import { sqsLogger } from './aws/sqs-logger';
import { createServiceContainer, type ServiceContainer } from './services/container';
import type { SkillMatch, PromptContext } from './types/validators';
import type { FullEnv } from './types/env';

/**
 * Main query handler - orchestrates the CV assistant query flow
 * 
 * Uses dependency injection via ServiceContainer for:
 * - Question validation (IQuestionValidator)
 * - Project detection (IProjectDetector)
 * - Prompt building (IPromptBuilder)
 * - AI inference (IAIInference)
 * - Response validation (IResponseValidator)
 */
export async function handleD1VectorQuery(
  request: Request,
  env: FullEnv,
  ctx: ExecutionContext
): Promise<Response> {
  // Create service container for dependency injection
  const services = createServiceContainer(env);

  try {
    const url = new URL(request.url);
    const rawQuery = url.searchParams.get('q') || await request.text();

    // ===== STEP 1: INPUT VALIDATION & SANITATION =====
    const validationResult = validateAndSanitizeInput(rawQuery);
    if (!validationResult.isValid) {
      return Response.json({ error: validationResult.errorMessage }, { status: 400 });
    }

    const query = validationResult.sanitizedInput!;
    const requestId = crypto.randomUUID();
    const sessionId = request.headers.get('x-session-id') || 'anonymous';

    // DISABLED: AWS SQS logging disabled to save resources
    // ctx.waitUntil(logQueryEvent(requestId, sessionId, query, request));

    // ===== STEP 2: QUESTION TYPE VALIDATION =====
    const questionValidation = services.questionValidator.validate(query);
    if (!questionValidation.isValid) {
      return Response.json({
        error: questionValidation.errorMessage,
        suggestion: questionValidation.suggestion,
        query,
      }, { status: 400 });
    }

    // ===== STEP 3: BUSINESS HOURS CHECK =====
    const businessHoursCheck = isWithinBusinessHours(rawQuery);
    if (!businessHoursCheck.isWithinHours) {
      return Response.json({
        error: getBusinessHoursMessage(),
        currentTime: businessHoursCheck.currentTime,
        timezone: businessHoursCheck.timezone,
      }, { status: 403 });
    }

    // ===== STEP 4: PROJECT DETECTION & VECTOR SEARCH =====
    const projectDetection = services.projectDetector.detect(query);
    const searchQuery = projectDetection.isProjectSpecific ? projectDetection.cleanQuery : query;

    const queryEmbedding = await generateEmbedding(searchQuery, env.AI);
    const vectorizeResults = await env.VECTORIZE.query(queryEmbedding, {
      topK: SEARCH_CONFIG.TOP_K_EXTENDED,
      returnMetadata: true,
      returnValues: false,
    });

    if (!vectorizeResults.matches?.length) {
      return Response.json({
        query,
        assistantReply: getFriendlyNoResultsMessage(projectDetection),
      }, { status: 200 });
    }

    // ===== STEP 5: FETCH FULL TECHNOLOGY DETAILS FROM D1 =====
    const technologies = await fetchTechnologiesFromD1(env, vectorizeResults, projectDetection);
    if (!technologies.length) {
      return Response.json({
        query,
        assistantReply: getFriendlyNoResultsMessage(projectDetection),
      }, { status: 200 });
    }

    // ===== STEP 6: BUILD SKILL MATCHES WITH SIMILARITY SCORES =====
    const topResults = buildSkillMatches(vectorizeResults, technologies);
    const isVerbose = url.searchParams.get('verbose') === 'true';

    // ===== STEP 7: GENERATE AI REPLY =====
    const responseData = await generateResponse(
      services,
      env,
      query,
      topResults,
      projectDetection,
      isVerbose
    );

    // DISABLED: AWS SQS logging disabled to save resources
    // ctx.waitUntil(logResponseEvent(requestId, sessionId, topResults));

    return Response.json(responseData);

  } catch (error: any) {
    console.error('D1 Vector query error:', error);
    return Response.json({
      error: error.message || 'Query failed',
      stack: error.stack,
    }, { status: 500 });
  }
}

/**
 * Generate AI response using injected services
 */
async function generateResponse(
  services: ServiceContainer,
  env: FullEnv,
  query: string,
  topResults: SkillMatch[],
  projectDetection: ReturnType<typeof services.projectDetector.detect>,
  isVerbose: boolean
): Promise<any> {
  const responseData: any = isVerbose
    ? buildVerboseResponse(query, topResults)
    : { query, assistantReply: '' };

  if (env.AI_REPLY_ENABLED !== 'true' || !topResults.length) {
    return responseData;
  }

  try {
    const { allowed, status } = await canUseAI(env.KV);

    if (!allowed) {
      responseData.assistantReply = getCircuitBreakerMessage();
      responseData.quotaExceeded = true;
      responseData.quotaStatus = status;
      return responseData;
    }

    // Build prompt context
    const top5 = topResults.slice(0, SEARCH_CONFIG.TOP_K_SYNTHESIS);
    const topScore = top5[0]?.similarity ?? 0;
    const confidence = getConfidenceLevel(topScore);

    const promptContext: PromptContext = {
      query,
      projectDetection,
      skills: top5,
      confidence,
      topScore,
    };

    // Generate AI reply using injected services
    const messages = services.promptBuilder.buildMessages(promptContext);
    let aiReply = await services.aiInference.generateReply(
      messages[0].content,
      messages[1].content
    );

    // Process response through validation pipeline
    aiReply = services.responseValidator.processReply(aiReply);

    responseData.assistantReply = aiReply;
    await incrementQuota(env.KV, NEURON_COSTS['llama-3.1-70b-instruct']);

  } catch (aiError: any) {
    console.error('[AI ERROR] AI reply generation failed:', aiError);
    responseData.assistantReply = '';
    responseData.aiError = aiError.message;
  }

  return responseData;
}

/**
 * Fetch technologies from D1 based on vector matches
 */
async function fetchTechnologiesFromD1(
  env: FullEnv,
  vectorizeResults: VectorizeMatches,
  projectDetection: { isProjectSpecific: boolean; projectName?: string }
): Promise<any[]> {
  const matchedIds = vectorizeResults.matches
    .map(m => {
      const id = parseInt(m.id.split('-')[1], 10);
      return isNaN(id) ? null : id;
    })
    .filter((id): id is number => id !== null);

  if (!matchedIds.length) return [];

  const placeholders = matchedIds.map(() => '?').join(',');
  let sqlQuery = `
    SELECT id, name, experience, experience_years, proficiency_percent, level, 
           summary, category, recency, action, effect, outcome, related_project, employer
    FROM technology
    WHERE id IN (${placeholders})
  `;

  const params: any[] = [...matchedIds];
  if (projectDetection.isProjectSpecific) {
    sqlQuery += ` AND (employer LIKE ? OR related_project LIKE ?)`;
    params.push(`%${projectDetection.projectName}%`, `%${projectDetection.projectName}%`);
  }

  const { results } = await env.DB.prepare(sqlQuery).bind(...params).all();
  return results || [];
}

/**
 * Build skill matches with boosted similarity scores
 */
function buildSkillMatches(
  vectorizeResults: VectorizeMatches,
  technologies: any[]
): SkillMatch[] {
  const techMap = new Map(technologies.map(t => [`technology-${t.id}`, t]));
  const similarities: SkillMatch[] = [];

  for (const match of vectorizeResults.matches) {
    const tech = techMap.get(match.id);
    if (!tech) continue;

    let similarity = match.score;
    const years = (tech.experience_years as number) || 0;
    const level = (tech.level as string) || '';

    // Experience-based boost
    const boostFactor = getBoostFactor(years, level);
    similarity = Math.min(1.0, similarity * boostFactor);

    similarities.push({
      id: match.id,
      item_id: tech.id,
      similarity,
      technology: {
        id: tech.id,
        name: tech.name,
        experience: tech.experience,
        years: tech.experience_years,
        proficiency: tech.proficiency_percent,
        level: tech.level,
        summary: tech.summary,
        category: tech.category,
        recency: tech.recency,
        action: tech.action,
        effect: tech.effect,
        outcome: tech.outcome,
        related_project: tech.related_project,
        employer: tech.employer,
      },
      metadata: match.metadata || {},
    });
  }

  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, SEARCH_CONFIG.TOP_K_EXTENDED);
}

/**
 * Get boost factor based on experience
 */
function getBoostFactor(years: number, level: string): number {
  if (years >= 15 && level === 'Expert') return 1.15;
  if (years >= 10 && level === 'Expert') return 1.10;
  if (years >= 8 && level === 'Advanced') return 1.05;
  return 1.0;
}

/**
 * Get confidence level from score
 */
function getConfidenceLevel(score: number): string {
  if (score >= SEARCH_CONFIG.HIGH_CONFIDENCE) return 'very high';
  if (score >= SEARCH_CONFIG.MEDIUM_CONFIDENCE) return 'high';
  if (score >= SEARCH_CONFIG.MIN_SIMILARITY) return 'moderate';
  return 'low';
}

/**
 * Get friendly no results message
 */
function getFriendlyNoResultsMessage(
  projectDetection: { isProjectSpecific: boolean; projectName?: string }
): string {
  return projectDetection.isProjectSpecific
    ? `I don't have any recorded experience with ${projectDetection.projectName} in my database. Could you ask about my general skills or a different project?`
    : "I couldn't find any relevant skills for that query. Could you try rephrasing your question?";
}

/**
 * Build verbose response for debugging
 */
function buildVerboseResponse(query: string, topResults: SkillMatch[]): any {
  return {
    query,
    results: topResults.map(r => ({
      id: r.technology.id,
      name: r.technology.name,
      years: r.technology.years,
      level: r.technology.level,
      proficiency: r.technology.proficiency,
      summary: r.technology.summary,
      category: r.technology.category,
      recency: r.technology.recency,
      action: r.technology.action,
      effect: r.technology.effect,
      outcome: r.technology.outcome,
      related_project: r.technology.related_project,
      employer: r.technology.employer,
      similarity: r.similarity,
      provenance: { source: 'vectorize', vector_id: r.id },
    })),
    source: 'vectorize',
    total_compared: topResults.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log query event to SQS
 */
async function logQueryEvent(
  requestId: string,
  sessionId: string,
  query: string,
  request: Request
): Promise<void> {
  try {
    await sqsLogger.sendEvent(
      sqsLogger.createQueryEvent(requestId, sessionId, query, {
        userAgent: request.headers.get('user-agent') || undefined,
        referer: request.headers.get('referer') || undefined,
      })
    );
  } catch (e) {
    console.error('Failed to send query event:', e);
  }
}

/**
 * Log response event to SQS
 */
async function logResponseEvent(
  requestId: string,
  sessionId: string,
  topResults: SkillMatch[]
): Promise<void> {
  try {
    const topResult = topResults[0];
    let matchType: 'full' | 'partial' | 'none' = 'none';
    let matchScore = 0;
    let reasoning = 'No relevant skills found';

    if (topResult) {
      matchScore = Math.round(topResult.similarity * 100);
      if (topResult.similarity > 0.8) {
        matchType = 'full';
        reasoning = `Excellent match: "${topResult.technology.name}" with ${topResult.similarity.toFixed(2)} similarity`;
      } else if (topResult.similarity > 0.5) {
        matchType = 'partial';
        reasoning = `Moderate match: "${topResult.technology.name}" with ${topResult.similarity.toFixed(2)} similarity`;
      } else {
        reasoning = `Weak match: "${topResult.technology.name}" with ${topResult.similarity.toFixed(2)} similarity`;
      }
    }

    await sqsLogger.sendEvent(
      sqsLogger.createResponseEvent(
        requestId,
        sessionId,
        matchType,
        matchScore,
        reasoning,
        undefined,
        topResults.length,
        {
          matchQuality: topResult?.similarity || 0,
          sourcesUsed: topResults.map(r => r.technology.name),
        }
      )
    );
  } catch (e) {
    console.error('Failed to send response event:', e);
  }
}
