/**
 * Query using Cloudflare Vectorize for semantic search
 * Uses Vectorize's optimized HNSW index for vector similarity search
 */

import { canUseAI, incrementQuota, NEURON_COSTS } from './ai-quota';
import {
  validateAndSanitizeInput,
  isWithinBusinessHours,
  getBusinessHoursMessage,
  getCircuitBreakerMessage,
} from './input-validation';
import { AI_CONFIG, SEARCH_CONFIG, AI_STOP_SEQUENCES } from './config';
import { generateEmbedding } from './services/embeddingService';
import { sqsLogger } from './aws/sqs-logger';

interface Env {
  DB: D1Database;
  AI: Ai;
  KV: KVNamespace;  // Added for quota tracking
  VECTORIZE: Vectorize;  // Vectorize index for semantic search
  AI_REPLY_ENABLED?: string;
}

// Validate question type - block non-technical queries
function validateQuestionType(query: string): { 
  isValid: boolean; 
  errorMessage?: string;
  suggestion?: string;
} {
  // Non-technical question patterns
  const nonTechnicalPatterns = [
    { 
      pattern: /\b(salary|compensation|pay|wage|money|market rate|below market|above market|remuneration|cost|expensive|cheap|affordable)\b/i, 
      type: 'compensation',
      suggestion: "Try asking: 'What experience does Osito have with enterprise systems?' or 'What technologies has Osito used in fintech?'"
    },
    { 
      pattern: /\b(personal|private|family|age|married|children|spouse|relationship|home|address|contact)\b/i, 
      type: 'personal',
      suggestion: "Try asking about specific technologies, projects, or technical accomplishments."
    },
    { 
      pattern: /\b(willing to relocate|accept offer|consider position|available for|start date|notice period|when can|join date)\b/i, 
      type: 'employment',
      suggestion: "Try asking: 'What are Osito's key technical strengths?' or 'What projects has Osito worked on?'"
    },
    { 
      pattern: /\b(weakness|weaknesses|failures|mistakes|regrets|worst|bad at|not good at|struggles with)\b/i, 
      type: 'negative',
      suggestion: "Try asking about specific technologies, achievements, or successful projects."
    },
  ];

  for (const { pattern, suggestion } of nonTechnicalPatterns) {
    if (pattern.test(query)) {
      return {
        isValid: false,
        errorMessage: `I can only answer questions about technical skills, projects, and professional achievements.`,
        suggestion: suggestion
      };
    }
  }

  return { isValid: true };
}

// Detect if query is asking about a specific project/company
function detectProjectInQuery(query: string): { isProjectSpecific: boolean; projectName?: string; cleanQuery: string } {
  const lowerQuery = query.toLowerCase();
  
  // Known project patterns
  const projectPatterns = [
    { pattern: /\b(at|in|for|during|with)\s+(cchq|conservative.*hq|conservative.*party)\b/i, name: 'CCHQ' },
    { pattern: /\b(cchq)\b/i, name: 'CCHQ' },
    { pattern: /\b(at|in|for|during|with)\s+(wairbut)\b/i, name: 'Wairbut' },
    { pattern: /\b(wairbut)\b/i, name: 'Wairbut' },
  ];

  for (const { pattern, name } of projectPatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      // Remove the project mention from query for better semantic search
      const cleanQuery = query.replace(pattern, '').trim();
      return { isProjectSpecific: true, projectName: name, cleanQuery };
    }
  }

  return { isProjectSpecific: false, cleanQuery: query };
}

// Post-process AI reply to ensure complete sentences
function cleanupAIReply(reply: string): string {
  if (!reply || reply.trim().length === 0) return reply;
  
  let cleaned = reply.trim();
  
  // Check if response ends mid-sentence (no proper punctuation)
  const lastChar = cleaned[cleaned.length - 1];
  const hasProperEnding = ['.', '!', '?', '"', "'", ')', ']'].includes(lastChar);
  
  if (!hasProperEnding) {
    // Find the last complete sentence (ends with . ! or ?)
    // Exclude decimal numbers like "99.9" - look for period followed by space or uppercase letter
    const sentenceEndPattern = /[.!?](?=\s+[A-Z]|\s*$)/g;
    const matches = [...cleaned.matchAll(sentenceEndPattern)];
    
    if (matches.length > 0) {
      // Truncate at the last complete sentence
      const lastSentenceEnd = matches[matches.length - 1].index! + 1;
      cleaned = cleaned.substring(0, lastSentenceEnd).trim();
    } else {
      // No complete sentences found - return as is with ellipsis
      cleaned = cleaned + '...';
    }
  }
  
  // Remove any trailing incomplete phrases after sentence endings
  // e.g., "...systems. Additionally, I've worked" -> "...systems."
  // But preserve decimal numbers like "99.9%"
  cleaned = cleaned.replace(/([.!?])(?=\s+[A-Z])\s+[^.!?]*$/, '$1');
  
  return cleaned;
}

// Enforce laconic style: maximum 3 sentences, remove filler
function enforceLaconicStyle(reply: string): string {
  if (!reply || reply.trim().length === 0) return reply;
  
  let cleaned = reply.trim();
  
  // Remove common filler phrases FIRST (before sentence splitting)
  const fillerPhrases = [
    // Generic openers (PRIORITY - remove these first)
    /^I've worked in \w+(-\w+)?\s+(technologies|domains?|areas?|fields?)?\s+for \d+ years?,?\s*/gi,
    /^I've consistently delivered (high-quality )?work (across|for|over) \d+ years (of experience )?in[^.]+\.\s*/gi,
    /^My expertise spans\s+[^.]+\.\s*/gi,
    /^I've demonstrated expertise in (multiple areas?|various domains?),?\s*/gi,
    
    // Project/skill listing patterns
    /^I've worked (on|with) (a range of |various )?projects,?\s*(utilising|using) (a range of |various )?skills (including|such as)[^.]+\.\s*/i,
    /^I've worked (on|with) (a range of |various )?(projects|technologies|tools)[^.]+\.\s*/i,
    /^I've worked (on|with) [A-Z][a-z]+ for \d+ years?,?\s*/i, // "I've worked with Terraform for 1 year"
    /,?\s*(utilising|using) (a range of |various )?(skills|technologies) (including|such as)[^.]+/gi,
    /,?\s*including [A-Z][^,]+ for [^,]+(?:, [A-Z][^,]+ for [^,]+)*,?\s*(and [A-Z][^,]+ for [^.]+)?/gi,
    /,?\s*and (also )?(worked with|used|explored|implemented) [^,]+ (and|using|with) [^,]+,?\s*/gi,
    /I'?m a (junior|mid-level|senior|principal)(-level)? professional with a strong background in[^.]+\.\s*/gi,
    /,?\s*having also worked (with|on) [^.]+\.\s*/gi,
    
    // Transition words
    /^Notably,?\s*/i,
    /^Additionally,?\s*/i,
    /^Moreover,?\s*/i,
    /^Furthermore,?\s*/i,
    /^In addition,?\s*/i,
    /These skills have been applied across various projects,?\s*/i,
    
    // Trailing generic phrases
    /,?\s*including [^.]+,\s*[^.]+,\s*and [^.]+\.$/gi, // Remove trailing "including X, Y, and Z."
    /\s+across (multiple|various) (projects|domains|areas)\.$/gi,
  ];
  
  for (const filler of fillerPhrases) {
    cleaned = cleaned.replace(filler, '');
  }
  
  // Split into sentences (handle periods, question marks, exclamation marks)
  const sentences = cleaned.split(/([.!?]+)\s+/).filter(s => s.trim().length > 0);
  
  // Reconstruct sentences (pairs of [text, punctuation])
  const reconstructed: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    if (sentences[i] && sentences[i + 1]) {
      reconstructed.push(sentences[i] + sentences[i + 1]);
    } else if (sentences[i]) {
      reconstructed.push(sentences[i]);
    }
  }
  
  // Take only first 2 sentences (changed from 3 to force even more conciseness)
  let laconic = reconstructed.slice(0, 2).join(' ').trim();
  
  // Ensure ends with proper punctuation
  if (laconic && !['.', '!', '?'].includes(laconic[laconic.length - 1])) {
    laconic += '.';
  }
  
  return laconic.trim();
}

// Validate response quality and auto-correct issues
function validateResponseQuality(reply: string): {
  isValid: boolean;
  issues: string[];
  correctedReply?: string;
} {
  const issues: string[] = [];
  
  // Check 1: Must end with employer (at CCHQ, at Wairbut, or at [CompanyName])
  if (!/(at (CCHQ|Wairbut|[A-Z][a-z]+))\.$/.test(reply)) {
    issues.push("Missing employer at end");
  }
  
  // Check 2: Sentence count (max 3)
  const sentences = reply.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length > 3) {
    issues.push(`Too many sentences (${sentences.length}, max 3)`);
  }
  
  // Check 3: Word count (max 60 for quality, but allow up to 80)
  const wordCount = reply.split(/\s+/).length;
  if (wordCount > 60) {
    issues.push(`Too wordy (${wordCount} words, target <60)`);
  }
  
  // Check 4: No filler phrases (these should have been removed already)
  const fillerCheck = [
    { phrase: "I've worked in", severity: "high" },
    { phrase: "My expertise spans", severity: "high" },
    { phrase: "I've consistently", severity: "high" },
    { phrase: "I've demonstrated", severity: "high" },
    { phrase: "across multiple", severity: "medium" },
    { phrase: "various projects", severity: "medium" },
  ];
  
  for (const { phrase, severity } of fillerCheck) {
    if (reply.includes(phrase)) {
      issues.push(`Contains filler (${severity}): "${phrase}"`);
    }
  }
  
  if (issues.length > 0) {
    // Auto-correct: truncate to first 2 sentences if too long
    if (sentences.length > 3) {
      const corrected = sentences.slice(0, 2).join(' ');
      return {
        isValid: false,
        issues,
        correctedReply: corrected,
      };
    }
  }
  
  return { isValid: issues.length === 0, issues: [] };
}

export async function handleD1VectorQuery(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    const rawQuery = url.searchParams.get('q') || await request.text();

    // ===== STEP 1: INPUT VALIDATION & SANITATION =====
    const validationResult = validateAndSanitizeInput(rawQuery);
    if (!validationResult.isValid) {
      return Response.json(
        { error: validationResult.errorMessage },
        { status: 400 }
      );
    }

    const query = validationResult.sanitizedInput!;

    // Generate a unique request ID for tracking this query through the analytics pipeline
    const requestId = crypto.randomUUID();
    const sessionId = request.headers.get('x-session-id') || 'anonymous';

    // Log query event to SQS (fire-and-forget, won't block response)
    ctx.waitUntil(
      sqsLogger.sendEvent(
        sqsLogger.createQueryEvent(
          requestId,
          sessionId,
          query,
          {
            userAgent: request.headers.get('user-agent') || undefined,
            referer: request.headers.get('referer') || undefined,
          }
        )
      ).catch(e => console.error('Failed to send query event:', e))
    );

    // ===== STEP 1.5: QUESTION TYPE VALIDATION (Block non-technical queries) =====
    const questionValidation = validateQuestionType(query);
    if (!questionValidation.isValid) {
      return Response.json(
        {
          error: questionValidation.errorMessage,
          suggestion: questionValidation.suggestion,
          query: query,
        },
        { status: 400 }
      );
    }

    // ===== STEP 2: BUSINESS HOURS CHECK =====
    const businessHoursCheck = isWithinBusinessHours(rawQuery); // rawQuery contains bypass phrase if present
    if (!businessHoursCheck.isWithinHours) {
      return Response.json(
        {
          error: getBusinessHoursMessage(),
          currentTime: businessHoursCheck.currentTime,
          timezone: businessHoursCheck.timezone,
        },
        { status: 403 } // Forbidden outside business hours
      );
    }

    // Detect if query is project-specific (e.g., "skills at CCHQ")
    const projectDetection = detectProjectInQuery(query);
    const searchQuery = projectDetection.isProjectSpecific ? projectDetection.cleanQuery : query;

    // Generate query embedding using the cleaned search query
    const queryEmbedding = await generateEmbedding(searchQuery, env.AI);

    // Query Vectorize index for semantic matches
    const vectorizeResults = await env.VECTORIZE.query(queryEmbedding, {
      topK: SEARCH_CONFIG.TOP_K_EXTENDED,
      returnMetadata: true,
      returnValues: false, // Don't need the vectors back
    });

    if (!vectorizeResults.matches || vectorizeResults.matches.length === 0) {
      // User-friendly error message
      const friendlyMessage = projectDetection.isProjectSpecific
        ? `I don't have any recorded experience with ${projectDetection.projectName} in my database. Could you ask about my general skills or a different project?`
        : "I couldn't find any relevant skills for that query. Could you try rephrasing your question?";
      
      return Response.json({ 
        query,
        assistantReply: friendlyMessage 
      }, { status: 200 });
    }

    // Fetch full technology details from D1 for matched items
    // Extract numeric IDs from Vectorize IDs (format: "technology-62")
    const matchedIds = vectorizeResults.matches.map(m => {
      const parts = m.id.split('-');
      const id = parseInt(parts[1], 10);
      if (isNaN(id)) {
        console.error(`Invalid Vectorize ID format: ${m.id}`);
        return null;
      }
      return id;
    }).filter(id => id !== null) as number[];
    
    if (matchedIds.length === 0) {
      console.error('No valid IDs extracted from Vectorize matches');
      return Response.json({ 
        query,
        assistantReply: "I couldn't find any relevant skills for that query. Could you try rephrasing your question?" 
      }, { status: 200 });
    }
    
    const placeholders = matchedIds.map(() => '?').join(',');
    
    let sqlQuery = `
      SELECT id, name, experience, experience_years, proficiency_percent, level, 
             summary, category, recency, action, effect, outcome, related_project, employer
      FROM technology
      WHERE id IN (${placeholders})
    `;
    
    // Apply project filter if needed
    const params: any[] = [...matchedIds];
    if (projectDetection.isProjectSpecific) {
      sqlQuery += ` AND (employer LIKE ? OR related_project LIKE ?)`;
      params.push(`%${projectDetection.projectName}%`);
      params.push(`%${projectDetection.projectName}%`);
    }
    
    const { results: technologies } = await env.DB.prepare(sqlQuery).bind(...params).all();

    if (!technologies || technologies.length === 0) {
      const friendlyMessage = projectDetection.isProjectSpecific
        ? `I don't have any recorded experience with ${projectDetection.projectName} in my database. Could you ask about my general skills or a different project?`
        : "I couldn't find any relevant skills for that query. Could you try rephrasing your question?";
      
      return Response.json({ 
        query,
        assistantReply: friendlyMessage 
      }, { status: 200 });
    }

    // Map Vectorize results to technology records with similarity scores
    // Tech map uses same ID format as Vectorize ("technology-{id}") for direct matching
    const techMap = new Map(technologies.map(t => [`technology-${t.id}`, t]));
    const similarities: Array<{
      id: string;
      item_id: number;
      similarity: number;
      technology: any;
      metadata: any;
    }> = [];

    for (const match of vectorizeResults.matches) {
      const tech = techMap.get(match.id);
      if (!tech) {
        continue; // Skip if filtered out by project
      }

      let similarity = match.score;

      // Apply experience-based boost for generic queries
      const years = tech.experience_years as number || 0;
      const level = tech.level as string || '';

      // Boost factor based on seniority (up to +15% for 20+ years Expert)
      let boostFactor = 1.0;
      if (years >= 15 && level === 'Expert') {
        boostFactor = 1.15;
      } else if (years >= 10 && level === 'Expert') {
        boostFactor = 1.10;
      } else if (years >= 8 && level === 'Advanced') {
        boostFactor = 1.05;
      }

      // Apply boost
      similarity = Math.min(1.0, similarity * boostFactor);

      similarities.push({
        id: match.id,
        item_id: parseInt(match.id),
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

    // Sort by boosted similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, SEARCH_CONFIG.TOP_K_EXTENDED);

    // Check if verbose mode is requested (reuse existing url from top of function)
    const isVerbose = url.searchParams.get('verbose') === 'true';

    // Prepare response - minimal by default, verbose with ?verbose=true
    const responseData: any = isVerbose ? {
      // VERBOSE MODE: Full details for debugging
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
        provenance: {
          source: 'vectorize',
          vector_id: r.id,
        },
      })),
      source: 'vectorize',
      total_compared: vectorizeResults.matches.length,
      timestamp: new Date().toISOString(),
    } : {
      // MINIMAL MODE: Only essential data for production
      query,
      assistantReply: '', // Will be populated by AI if available
    };

    // Generate AI reply if enabled
    if (env.AI_REPLY_ENABLED === 'true' && topResults.length > 0) {
      try {
        // ===== STEP 3: CIRCUIT BREAKER CHECK =====
        const { allowed, status } = await canUseAI(env.KV);
        
        if (!allowed) {
          // Quota exceeded - return circuit breaker message
          responseData.assistantReply = getCircuitBreakerMessage();
          responseData.quotaExceeded = true;
          responseData.quotaStatus = status;
        } else {
          // Quota available - proceed with AI inference
          console.log('[AI] Quota check passed, generating reply...');
          const top5 = topResults.slice(0, SEARCH_CONFIG.TOP_K_SYNTHESIS); // Increased from 5 to 10 for better multi-skill synthesis
        const topScore = top5[0]?.similarity ?? 0;
          console.log(`[AI] Top ${top5.length} results, topScore: ${topScore}`);

        // Confidence interpretation: scores above 0.65 are strong matches for broad queries
        const confidence = topScore >= SEARCH_CONFIG.HIGH_CONFIDENCE ? 'very high' :
                          topScore >= SEARCH_CONFIG.MEDIUM_CONFIDENCE ? 'high' :
                          topScore >= SEARCH_CONFIG.MIN_SIMILARITY ? 'moderate' : 'low';

        // Group results by category for breadth analysis
        const categories = new Set(top5.map(r => r.technology.category));
        const hasRecent = top5.some(r => r.technology.recency);
        const expertSkills = top5.filter(r => r.technology.level === 'Expert');
        const seniorSkills = top5.filter(r => r.technology.years >= 10);

        const resultsText = top5.map((r, i) => {
          const tech = r.technology;
          // Build a structured text representation highlighting outcome-driven fields
          let text = `${i+1}. ${tech.name} — ${tech.years} years, ${tech.level}${tech.recency ? ` (${tech.recency})` : ''}
   Category: ${tech.category}`;
          
          if (tech.action) text += `\n   Action: ${tech.action}`;
          if (tech.effect) text += `\n   Effect: ${tech.effect}`;
          if (tech.outcome) text += `\n   Outcome: ${tech.outcome}`;
          if (tech.related_project) text += `\n   Project: ${tech.related_project}`;
          if (tech.summary) text += `\n   Summary: ${tech.summary}`;
          
          text += `\n   Similarity: ${r.similarity.toFixed(3)}`;
          return text;
        }).join('\n\n');

        const prompt = `You are an expert CV assistant designed to answer recruiter-style questions about a candidate's skills and professional level.

USER QUESTION: "${query}"
${projectDetection.isProjectSpecific ? `\n**PROJECT CONTEXT: This question is specifically about ${projectDetection.projectName}. All skills below were used at ${projectDetection.projectName}.**\n` : ''}

TOP MATCHING SKILLS (confidence: ${confidence}, score: ${topScore.toFixed(3)}):
${resultsText}

CONTEXT FOR ASSESSMENT:
- Categories represented: ${Array.from(categories).join(', ')}
- Expert-level skills: ${expertSkills.length} (${expertSkills.map(s => s.technology.name).join(', ')})
- Senior experience (10+ years): ${seniorSkills.length} (${seniorSkills.map(s => s.technology.name).join(', ')})
- Recent/current skills: ${hasRecent ? 'Yes' : 'No'}

### CRITICAL RULES (READ CAREFULLY):

1. **LACONIC STYLE (2-3 SENTENCES MAXIMUM)**
   - Get STRAIGHT to the action and outcome - no filler
   - NEVER start with: "I've worked in X for Y years", "My expertise spans", "I've consistently delivered", "I've demonstrated"
   - NEVER end with: "including X, Y, and Z" or "across multiple projects"
   - Maximum 40-50 words total
   - Example BAD: "I've worked in fintech-relevant technologies for 19 years, utilising C#, JavaScript, and SQL Server to deliver scalable, maintainable systems, achieving 99.9% uptime..."
   - Example GOOD: "I engineered C# microservices achieving 99.9% uptime and processing millions of transactions at CCHQ."

2. **ALWAYS ANSWER THE QUESTION DIRECTLY**
   - If asked "Is he qualified for fintech?", start with "Yes, I'm qualified for fintech because..."
   - If asked "What type of professional?", start with "This is a senior/principal-level professional because..."
   - If asked about a specific technology, focus ONLY on that technology
   - Don't list unrelated skills or give generic overviews

3. **ALWAYS CLOSE WITH EMPLOYER**
   - Every response MUST end with "at CCHQ" or "at Wairbut"
   - NEVER end with generic phrases like "across multiple projects" or "in various domains"
   - Example: "...achieving 99.9% uptime at CCHQ."

4. **OUTCOME ATTRIBUTION (STRICT - NO MIXING)**
   - Each skill has its OWN outcomes - NEVER combine them
   - C# has "99.9% uptime" and JavaScript has "95% satisfaction" - these are DIFFERENT
   - WRONG: "I achieved 99.9% uptime and 95% satisfaction with C# and JavaScript"
   - CORRECT: "I delivered C# backend services with 99.9% uptime at CCHQ"
   - Focus on the TOP-RANKED skill's outcomes first

5. **DISTINGUISH RELATED SKILLS (CRITICAL)**
   - Angular (3y) and AngularJS (10y) are DIFFERENT skills
   - RxJS (3y) and JavaScript (19y) are DIFFERENT skills
   - NEVER say "19 years of Angular" when data shows "3y Angular + 10y AngularJS + 19y JavaScript"
   - NEVER combine outcomes: Angular's "40% faster" ≠ AngularJS's "10,000 users" ≠ JavaScript's "95% satisfaction"
   - When multiple related skills match, mention them SEPARATELY with INDIVIDUAL years and outcomes

### YOUR GOALS:

1. **Project-specific queries (CRITICAL - READ CAREFULLY)**
   ${projectDetection.isProjectSpecific ? `
   - This is a PROJECT-SPECIFIC query about ${projectDetection.projectName}
   - The skills below were ALL used at ${projectDetection.projectName}, but the "years" field shows TOTAL CAREER experience, NOT time at ${projectDetection.projectName}
   - DO NOT say "I have 19 years of JavaScript at CCHQ" - JavaScript has 19 years TOTAL, but was used at CCHQ for a shorter period
   - DO NOT say "20 years of SQL Server at CCHQ" - SQL Server has 20 years TOTAL, but was used at CCHQ for a shorter period
   - CORRECT approach: "At ${projectDetection.projectName}, I used JavaScript/C#/SQL Server to [action] achieving [outcome]" (no year mention unless you have CCHQ-specific duration)
   - When asked about "skillset used at ${projectDetection.projectName}", synthesize MULTIPLE relevant skills, not just one
   - Focus on WHAT was accomplished at ${projectDetection.projectName} with these skills, not HOW LONG you've known them overall
   - Example WRONG: "At CCHQ I used JavaScript (19 years experience)"
   - Example CORRECT: "At CCHQ I used JavaScript, C#, and SQL Server to build modular services, cutting release cycles from weeks to days"
   ` : `
   - This is a GENERAL query about skills/experience
   - You MAY mention total experience (e.g., "19 years of JavaScript")
   - Provide broader context across all projects
   `}

2. **Multi-skill synthesis for "skillset" queries (CRITICAL)**
   - When query uses words like "skillset", "skills", "technologies", "tech stack", you MUST synthesize MULTIPLE skills
   - DO NOT just focus on the top-ranked skill - mention at least 3-5 different skills from the results
   - Group related skills together: "I used [skill1], [skill2], and [skill3] for [purpose]"
   - Provide a comprehensive overview of the technology stack used
   - Example WRONG: "At CCHQ I used Full-Stack Service Decomposition"
   - Example CORRECT: "At CCHQ I used Full-Stack Service Decomposition, JavaScript, C#, SQL Server, and AngularJS to build modular services, achieving [outcomes]"
   - Think of the answer as describing a complete technology stack, not just one skill

3. **Classification (junior/mid/senior/principal)**
   - When asked "what type of professional is this" or "junior/mid/senior?", you MUST:
     - Aggregate across ALL skills provided (not just one)
     - Use experience_years + level to classify:
       0–3 years = Junior
       3–7 years = Mid
       7–15 years = Senior
       15+ years = Principal/Lead
     - If skills vary in depth, return the highest consistent level, but note newer skills at lower depth
     - ALWAYS state the classification explicitly (e.g., "This is a senior/principal-level professional")

4. **Outcome-driven synthesis**
   - When generating an answer about a skill, ALWAYS structure as:
     **Skill → Context (years, level) → Action → Effect → Outcome → Project (optional)**
   - Use the "action", "effect", "outcome", and "related_project" fields when available
   - If empty, extract from summary, but NEVER repeat summary verbatim
   - NEVER invent data not in the database
   - NEVER invent or conflate timeframes (e.g., don't say "7 years" if data shows "5 years")
   - **NEVER mix outcomes from different skills** (e.g., don't attribute JavaScript's "95% satisfaction" to Angular)
   - **Each skill has its OWN outcomes** - keep them separate and skill-specific
   - Prioritize measurable outcomes (percentages, cycle times, uptime, throughput)
   - Avoid vague phrases like "delivered business value" or "drove success"

5. **Distinguish between related but different skills (CRITICAL)**
   - **Angular** (3 years) and **AngularJS** (10 years) are DIFFERENT skills with DIFFERENT durations
   - **RxJS** (3 years) and **JavaScript** (19 years) are DIFFERENT skills with DIFFERENT durations
   - NEVER say "19 years of Angular" when data shows "3 years Angular + 10 years AngularJS + 19 years JavaScript"
   - NEVER combine outcomes: Angular's "40% faster" ≠ AngularJS's "10,000 users" ≠ JavaScript's "95% satisfaction"
   - When multiple related skills match, mention them SEPARATELY with their INDIVIDUAL years and outcomes
   - Example WRONG: "19 years of Angular with 95% satisfaction and 40% faster load times"
   - Example CORRECT: "3 years Angular (40% faster SPAs), 10 years AngularJS (10,000+ users), 19 years JavaScript (95% satisfaction)"

6. **Avoid tool-centric answers**
   - NEVER present SQL Server, AppDynamics, or any single tool as the sole definition of the candidate
   - ALWAYS contextualize tool-specific skills inside broader architectural or engineering outcomes
   - When multiple skills are retrieved, aggregate across categories (database, architecture, cloud, DevOps)
   - Prioritize breadth + outcomes over depth in a single tool, unless the question explicitly asks about that tool
   - Example: Instead of "You're a SQL Server expert", say "You're a senior data architect who used SQL Server to cut query times by 80%, enabling real-time analytics"

### EXAMPLE TRANSFORMATION FOR PROJECT-SPECIFIC QUERIES:

${projectDetection.isProjectSpecific ? `
**IMPORTANT: This is a PROJECT-SPECIFIC query. Follow this example exactly:**

**WRONG ANSWER (DO NOT DO THIS):**
"At CCHQ I have 19 years of C# experience and 20 years of SQL Server experience..."

**CORRECT ANSWER (DO THIS INSTEAD):**
"At CCHQ I used C#, JavaScript, SQL Server, and AngularJS to build a modular service architecture. By decomposing monolithic applications, I enabled independent team deployments, cutting release cycles from weeks to days and achieving 50% reduction in coordination overhead. The technology stack supported 100,000+ daily active users during critical national elections."

Notice the difference:
- WRONG: Mentions "19 years" and "20 years" (total experience)
- CORRECT: Focuses on what was DONE at CCHQ with those skills, without mentioning total years
- CORRECT: Lists MULTIPLE skills (C#, JavaScript, SQL Server, AngularJS)
- CORRECT: Includes measurable outcomes
` : ''}

**Input skill data:**
{
  "name": "Full-Stack Service Decomposition",
  "experienceYears": 5,
  "level": "Advanced",
  "action": "Broke down monolithic applications into modular services",
  "effect": "Enabled teams to deploy independently and faster",
  "outcome": "Cut release cycles from weeks to days",
  "related_project": "CCHQ national campaign platform"
}

**Output answer:**
"With 5+ years of advanced experience in Full‑Stack Service Decomposition at CCHQ, I broke down monolithic applications into modular services. This enabled teams to deploy independently, cutting release cycles from weeks to days and ensuring campaign responsiveness during national elections."

### EXAMPLE: HANDLING MULTIPLE RELATED SKILLS CORRECTLY

**Input data:**
- Angular: 3 years, Advanced, "40% faster load times"
- AngularJS: 10 years, Expert, "10,000+ daily active users"
- JavaScript: 19 years, Expert, "95%+ user satisfaction scores across 19 years"

**WRONG ANSWER (mixing outcomes and years):**
"I have 19 years of Angular experience with 95% satisfaction and 40% faster load times."

**CORRECT ANSWER (separate skills with individual years and outcomes):**
"I engineered enterprise Angular applications (3 years, 40% faster SPAs) and AngularJS platforms (10 years, 10,000+ users), leveraging JavaScript expertise (19 years, 95% satisfaction) to deliver responsive web applications."

### CONSTRAINTS:
- Never invent skills, outcomes, projects, or timeframes not present in the database
- Never conflate different experience durations (if data says "5 years", don't say "7 years")
- Never repeat the CV summary verbatim; always reframe it into the outcome‑driven template
- Keep answers recruiter‑friendly: clear, measurable, and business‑linked
- Always answer the implicit recruiter question: "So what?"

**CRITICAL: LACONIC STYLE (2-3 sentences maximum)**
- Maximum 3 sentences - no exceptions
- No filler, no verbose explanations, no "Additionally" or "Moreover"
- Get straight to the point: Action → Outcome → Employer
- Always close with employer: "at CCHQ" or "at Wairbut"
- Use strong verbs: engineered, delivered, architected, modernised, optimised
- One sentence per concept (skill, metric, or outcome)
- Avoid repetition or elaboration
- Example: "I engineered modular services, cutting release cycles from weeks to days at CCHQ."`;

        // COST-OPTIMIZED RESPONSE MODE
        // max_tokens: 80 (reduced from 120) - forces very concise responses (2 short sentences)
        // Fixed neuron cost: ~70-80 per inference (more predictable with aggressive laconic enforcement)
        // Post-processing (enforceLaconicStyle) ensures max 2 sentences regardless of model output
        // Estimated cost: 65-75 neurons actual due to shorter responses + aggressive stop sequences
        const aiResponse = await env.AI.run(AI_CONFIG.CHAT_MODEL as any, {
          messages: [
            { 
              role: 'system', 
              content: `You are a recruiter-facing assistant that answers questions about José's professional profile. ALWAYS respond in first person as José using British English (spellings, phrasing, conventions).

CRITICAL: LACONIC STYLE (MANDATORY)
- Maximum 2 SHORT sentences (each under 20 words)
- NO opening filler: "I've worked with...", "I have experience in...", "I'm a senior professional..."
- Start DIRECTLY with the action: "I implemented...", "I engineered...", "I delivered..."
- NEVER include unrelated skills (if asked about Terraform, DON'T mention Docker/Kubernetes)
- ALWAYS end with employer: "at Wairbut" or "at CCHQ" (NOT "for Cloudflare")
- ONE measurable outcome maximum
- Example PERFECT: "I implemented Terraform infrastructure-as-code, reducing provisioning time by 85% at Wairbut."
- Example BAD: "I've worked with Terraform for 1 year at an advanced level, implementing infrastructure-as-code with state management and modular configurations..."

ANSWER FORMAT:
1st sentence: [Strong verb] + [technology] + [outcome] + [employer]
2nd sentence (optional): [Additional context] + [related technology] + [employer]

Always follow these rules:

1. **British English (MANDATORY)**
   - Use British English spellings: "optimise" (not "optimize"), "organisation" (not "organization"), "specialise" (not "specialize"), "realised" (not "realized").
   - Use British phrasing and conventions: "I've worked with" (not "I've worked on"), "deliver solutions" (not "deliver solutions" is universal but prefer British tone).
   - Use "s" not "z" in "-ise" endings: "analyse", "maximise", "utilise".
   - Examples:
     * "I optimised performance by..." (not "optimized")
     * "I recognised the need to..." (not "recognized")
     * "I developed a programme to..." (not "program")

2. **First-person perspective (MANDATORY)**
   - ALWAYS use "I", "me", "my", "we" (if referring to teams José led).
   - Never use "José", "he", "the candidate", or third-person pronouns.
   - Every answer must read as if José is speaking directly to the recruiter.
   - Examples of CORRECT style:
     * "I have 5+ years of experience in microservices."
     * "I broke down monolithic applications into modular services."
     * "I led a team that cut deployment cycles from weeks to days."
   - Examples of INCORRECT style (do NOT use):
     * "José has 5+ years of experience..." → REWRITE: "I have 5+ years of experience..."
     * "The candidate broke down monolithic apps..." → REWRITE: "I broke down monolithic apps..."

3. **Project-specific vs General queries (CRITICAL)**
   - If the user asks about a SPECIFIC PROJECT (e.g., "at CCHQ", "during Wairbut"), ONLY discuss skills used in that project
   - The "experience_years" field shows TOTAL CAREER experience, NOT project-specific duration
   - NEVER say "At CCHQ I used JavaScript for 19 years" - the 19 years is total career, not CCHQ-specific
   - NEVER say "20 years of SQL Server at CCHQ" - the 20 years is total career, not CCHQ-specific
   - Example WRONG: "At CCHQ I used JavaScript (19 years experience)" → The 19 years is total, not CCHQ-specific
   - Example CORRECT: "At CCHQ I used JavaScript to build interactive campaign dashboards, achieving 95% user satisfaction"
   - When asked about a "skillset" at a project, synthesize MULTIPLE relevant skills, not just one
   - Format: "At [PROJECT], I used [SKILL1], [SKILL2], and [SKILL3] to [ACTION], achieving [OUTCOME]"

4. **Never conflate or invent timeframes (CRITICAL)**
   - If data says "5 years", never say "7 years"
   - If data says "19 years total" and "5 years at CCHQ", don't mix them
   - Always use EXACT numbers from the database
   - Never round up or extrapolate experience durations

5. **Classification**
   - When asked about professional level, always classify explicitly as Junior, Mid-level, Senior, or Principal/Lead.
   - Use this mapping:
     - 0–3 years = Junior
     - 3–7 years = Mid-level
     - 7–15 years = Senior
     - 15+ years = Principal/Lead
   - If skills vary, return the highest consistent level but note if some newer skills are at lower depth.

6. **Outcome-driven synthesis**
   - Structure every skill answer as:
     Skill → Context (years, level) → Action → Effect → Outcome → Project (optional).
   - Prioritise measurable outcomes (percentages, cycle times, uptime, throughput).
   - Avoid vague phrases like "delivered business value" or "drove success."

7. **Anti tool-centric**
   - Never present SQL Server, AppDynamics, or any single tool as the sole definition of the candidate.
   - Always contextualise tool-specific skills inside broader architectural or engineering outcomes.
   - Aggregate across categories (database, architecture, cloud, DevOps) when multiple skills are relevant.

8. **Style (CRITICAL - Laconic)**
   - Maximum 3 sentences ONLY
   - Always mention employer at the end: "...at CCHQ" or "...at Wairbut"  
   - Structure: Action → Outcome → Employer
   - NO filler phrases ("Additionally", "Moreover", "In addition")
   - NO long career totals unless directly relevant to the question
   - Use strong verbs: engineered, delivered, architected, modernised, optimised
   - Keep answers concise, clear, and recruiter-friendly
   - Always answer the implicit recruiter question: "So what?"
   - Do not repeat summaries verbatim; reframe into outcome-driven narratives

### Example transformation (LACONIC STYLE):

Input skill:
- Name: Full-Stack Service Decomposition
- ExperienceYears: 5
- Level: Advanced
- Action: Broke down monolithic applications into modular services
- Effect: Enabled teams to deploy independently and faster
- Outcome: Cut release cycles from weeks to days
- Related_project: CCHQ national campaign platform

Output answer (LACONIC - max 3 sentences):
"I engineered modular full-stack services from monolithic applications, cutting release cycles from weeks to days at CCHQ."`
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: AI_CONFIG.MAX_TOKENS,
          stop: AI_STOP_SEQUENCES as any // Stop at filler
        },
        // AI GATEWAY: Third argument enables analytics, caching, and detailed metrics
        // Benefits: Request tracking, token/cost monitoring, 20-50% cost reduction via caching
        // Analytics available via: npm run analytics:today
        {
          gateway: {
            id: 'cv-assistant-gateway'
          }
        }) as any;

          // Extract AI response - handle multiple formats including streams
          let aiReply = '';
          
          // Helper function to fully consume a ReadableStream
          const consumeStream = async (stream: ReadableStream): Promise<string> => {
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let result = '';
            const timeout = 30000; // 30 second timeout
            const startTime = Date.now();
            
            try {
              while (true) {
                // Check for timeout
                if (Date.now() - startTime > timeout) {
                  console.warn('Stream read timeout after 30s');
                  reader.cancel('Timeout');
                  break;
                }
                
                const { done, value } = await reader.read();
                
                if (done) {
                  break;
                }
                
                if (value) {
                  result += decoder.decode(value, { stream: true });
                }
              }
              
              // Final decode with stream: false to flush any remaining bytes
              result += decoder.decode();
              
              return result;
            } catch (error) {
              reader.cancel('Error reading stream');
              throw error;
            } finally {
              reader.releaseLock();
            }
          };
          
          // Check if response is a ReadableStream
          if (aiResponse && typeof aiResponse === 'object' && 'body' in aiResponse && aiResponse.body instanceof ReadableStream) {
            aiReply = await consumeStream(aiResponse.body);
          } else if (aiResponse && typeof aiResponse === 'object' && aiResponse instanceof ReadableStream) {
            aiReply = await consumeStream(aiResponse);
          } else if (typeof aiResponse === 'string') {
            aiReply = aiResponse;
          } else if (aiResponse?.response) {
            // Check if nested response is a stream
            if (aiResponse.response instanceof ReadableStream) {
              aiReply = await consumeStream(aiResponse.response);
            } else {
              aiReply = aiResponse.response;
            }
          } else if (aiResponse?.result?.response) {
            // Check if nested result.response is a stream
            if (aiResponse.result.response instanceof ReadableStream) {
              aiReply = await consumeStream(aiResponse.result.response);
            } else {
              aiReply = aiResponse.result.response;
            }
          } else if (Array.isArray(aiResponse?.choices) && aiResponse.choices[0]?.message?.content) {
            aiReply = aiResponse.choices[0].message.content;
          } else if (aiResponse && typeof aiResponse === 'object') {
            // Try common response patterns
            if ('content' in aiResponse) {
              aiReply = aiResponse.content;
            } else if ('text' in aiResponse) {
              aiReply = aiResponse.text;
            } else if ('message' in aiResponse && typeof aiResponse.message === 'object' && 'content' in aiResponse.message) {
              aiReply = aiResponse.message.content;
            }
          }
          
          // Remove surrounding quotes if present (happens when response is JSON-stringified)
          if (aiReply.startsWith('"') && aiReply.endsWith('"')) {
            aiReply = aiReply.slice(1, -1);
          }
          
          // Clean up any incomplete sentences from truncation
          aiReply = cleanupAIReply(aiReply);
          
          // Enforce laconic style: max 3 sentences, remove filler
          aiReply = enforceLaconicStyle(aiReply);
          
          // Validate response quality and auto-correct if needed
          const qualityCheck = validateResponseQuality(aiReply);
          if (!qualityCheck.isValid) {
            if (qualityCheck.correctedReply) {
              aiReply = qualityCheck.correctedReply;
            }
          }
          
          console.log(`[AI] Final aiReply: "${aiReply.substring(0, 150)}..."`);
          responseData.assistantReply = aiReply;
          
          // Increment quota counter after successful inference
          await incrementQuota(env.KV, NEURON_COSTS['llama-3.1-70b-instruct']);
        }
      } catch (aiError: any) {
        console.error('[AI ERROR] AI reply generation failed:', aiError);
        console.error('[AI ERROR] Stack:', aiError.stack);
        responseData.assistantReply = '';
        responseData.aiError = aiError.message;
      }
    }

    // Log response event to SQS with match quality assessment
    // Determine match quality based on top result similarity
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
        matchType = 'none';
        reasoning = `Weak match: "${topResult.technology.name}" with ${topResult.similarity.toFixed(2)} similarity`;
      }
    }

    // Send response event (fire-and-forget, won't block response)
    ctx.waitUntil(
      sqsLogger.sendEvent(
        sqsLogger.createResponseEvent(
          requestId,
          sessionId,
          matchType,
          matchScore,
          reasoning,
          undefined, // No performance metrics available in Worker context
          topResults.length, // vectorMatches count
          {
            matchQuality: topResult?.similarity || 0,
            sourcesUsed: topResults.map(r => r.technology.name),
          }
        )
      ).catch((e: any) => {
        console.error('Failed to send response event:', e);
      })
    );

    return Response.json(responseData);

  } catch (error: any) {
    console.error('D1 Vector query error:', error);
    return Response.json({
      error: error.message || 'Query failed',
      stack: error.stack,
    }, { status: 500 });
  }
}
