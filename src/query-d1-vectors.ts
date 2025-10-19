/**
 * Query D1 vectors directly using cosine similarity
 * This bypasses Vectorize and uses the embeddings stored in your vectors table
 */

import { canUseAI, incrementQuota, getQuotaExceededMessage, NEURON_COSTS, type QuotaStatus } from './ai-quota';
import {
  validateAndSanitizeInput,
  isWithinBusinessHours,
  getBusinessHoursMessage,
  getCircuitBreakerMessage,
} from './input-validation';

interface Env {
  DB: D1Database;
  AI: Ai;
  KV: KVNamespace;  // Added for quota tracking
  AI_REPLY_ENABLED?: string;
}

// Convert binary blob to Float32Array
function blobToFloat32Array(blob: ArrayBuffer): Float32Array {
  return new Float32Array(blob);
}

// Cosine similarity calculation
function cosineSimilarity(vecA: Float32Array | number[], vecB: Float32Array | number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generate embedding using Workers AI
async function generateEmbedding(text: string, ai: Ai): Promise<number[]> {
  const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  }) as { data: number[][] };
  return response.data[0];
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
    const sentenceEndPattern = /[.!?](?=\s|$)/g;
    const matches = [...cleaned.matchAll(sentenceEndPattern)];
    
    if (matches.length > 0) {
      // Truncate at the last complete sentence
      const lastSentenceEnd = matches[matches.length - 1].index! + 1;
      cleaned = cleaned.substring(0, lastSentenceEnd).trim();
      console.log('Truncated incomplete sentence at position:', lastSentenceEnd);
    } else {
      // No complete sentences found - return as is with ellipsis
      console.warn('AI reply has no complete sentences, appending ellipsis');
      cleaned = cleaned + '...';
    }
  }
  
  // Remove any trailing incomplete phrases after sentence endings
  // e.g., "...systems. Additionally, I've worked" -> "...systems."
  cleaned = cleaned.replace(/([.!?])\s+[^.!?]*$/, '$1');
  
  return cleaned;
}

// Enforce laconic style: maximum 3 sentences, remove filler
function enforceLaconicStyle(reply: string): string {
  if (!reply || reply.trim().length === 0) return reply;
  
  let cleaned = reply.trim();
  
  // Remove common filler phrases FIRST (before sentence splitting)
  const fillerPhrases = [
    /^I've worked on (a range of |various )?projects,?\s*(utilising|using) (a range of |various )?skills (including|such as)[^.]+\.\s*/i,
    /^I've worked on a range of projects[^.]+\.\s*/i,
    /^I've worked on various projects[^.]+\.\s*/i,
    /,?\s*(utilising|using) (a range of |various )?(skills|technologies) (including|such as)[^.]+/gi,
    /,?\s*including [A-Z][^,]+ for [^,]+(?:, [A-Z][^,]+ for [^,]+)*,?\s*(and [A-Z][^,]+ for [^.]+)?/gi,
    /^Notably,?\s*/i,
    /^Additionally,?\s*/i,
    /^Moreover,?\s*/i,
    /^Furthermore,?\s*/i,
    /^In addition,?\s*/i,
    /These skills have been applied across various projects,?\s*/i,
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
  
  // Take only first 3 sentences
  let laconic = reconstructed.slice(0, 3).join(' ').trim();
  
  // Ensure ends with proper punctuation
  if (laconic && !['.', '!', '?'].includes(laconic[laconic.length - 1])) {
    laconic += '.';
  }
  
  console.log(`Laconic enforcement: ${reconstructed.length} sentences → ${reconstructed.slice(0, 3).length} sentences`);
  console.log(`Filler removal: ${reply.length} chars → ${laconic.length} chars`);
  return laconic.trim();
}

export async function handleD1VectorQuery(request: Request, env: Env): Promise<Response> {
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

    console.log(`D1 Vector Query: "${query}" (sanitized)`);
    console.log(`Business hours check passed: ${businessHoursCheck.timezone} at ${businessHoursCheck.currentTime}`);

    // Detect if query is project-specific (e.g., "skills at CCHQ")
    const projectDetection = detectProjectInQuery(query);
    const searchQuery = projectDetection.isProjectSpecific ? projectDetection.cleanQuery : query;
    
    if (projectDetection.isProjectSpecific) {
      console.log(`Project-specific query detected: ${projectDetection.projectName}`);
      console.log(`Clean search query: "${searchQuery}"`);
    }

    // Generate query embedding using the cleaned search query
    const queryEmbedding = await generateEmbedding(searchQuery, env.AI);
    const queryVector = new Float32Array(queryEmbedding);

    // Fetch vectors from D1 - optionally filter by project if detected
    let sqlQuery = `SELECT v.id, v.item_id, v.embedding, v.metadata, t.name, t.experience, t.experience_years,
              t.proficiency_percent, t.level, t.summary, t.category, t.recency,
              t.action, t.effect, t.outcome, t.related_project, t.employer
       FROM vectors v
       JOIN technology t ON v.item_id = t.id
       WHERE v.item_type = 'technology'`;
    
    // If project-specific, filter to only skills used in that project
    // Check both employer and related_project columns
    const params: any[] = [];
    if (projectDetection.isProjectSpecific) {
      sqlQuery += ` AND (t.employer LIKE ? OR t.related_project LIKE ?)`;
      params.push(`%${projectDetection.projectName}%`);
      params.push(`%${projectDetection.projectName}%`);
    }
    
    const { results: vectors } = params.length > 0 
      ? await env.DB.prepare(sqlQuery).bind(...params).all()
      : await env.DB.prepare(sqlQuery).all();

    if (!vectors || vectors.length === 0) {
      // User-friendly error message instead of technical database error
      const friendlyMessage = projectDetection.isProjectSpecific
        ? `I don't have any recorded experience with ${projectDetection.projectName} in my database. Could you ask about my general skills or a different project?`
        : "I couldn't find any relevant skills for that query. Could you try rephrasing your question?";
      
      return Response.json({ 
        query,
        assistantReply: friendlyMessage 
      }, { status: 200 }); // Return 200 (not 404) with friendly message
    }

    console.log(`Found ${vectors.length} vectors to compare`);

    // Calculate similarities
    const similarities: Array<{
      id: number;
      item_id: number;
      similarity: number;
      technology: any;
      metadata: any;
    }> = [];

    for (const vector of vectors) {
      // D1 returns BLOB as ArrayBuffer in Workers runtime
      let embedding: Float32Array;

      try {
        const embeddingData = vector.embedding as any;

        // D1 returns BLOBs as Arrays of bytes (Uint8Array-like)
        if (Array.isArray(embeddingData)) {
          // Convert byte array to Float32Array
          const uint8 = new Uint8Array(embeddingData);
          embedding = new Float32Array(uint8.buffer);
        } else if (embeddingData instanceof ArrayBuffer) {
          embedding = new Float32Array(embeddingData);
        } else if (ArrayBuffer.isView(embeddingData)) {
          embedding = new Float32Array(embeddingData.buffer, embeddingData.byteOffset, embeddingData.byteLength / 4);
        } else {
          console.error(`Vector ${vector.id}: Unexpected type -`, embeddingData?.constructor?.name || typeof embeddingData);
          continue;
        }

        if (embedding.length !== queryVector.length) {
          console.error(`Vector ${vector.id}: Dimension mismatch - embedding=${embedding.length}, query=${queryVector.length}`);
          continue;
        }

        let similarity = cosineSimilarity(queryVector, embedding);

        if (isNaN(similarity)) {
          console.error(`Vector ${vector.id}: Similarity is NaN`);
          continue;
        }

        // Apply experience-based boost for generic queries
        // This ensures senior skills rank higher when queries are vague
        const years = vector.experience_years as number || 0;
        const level = vector.level as string || '';

        // Boost factor based on seniority (up to +15% for 20+ years Expert)
        let boostFactor = 1.0;
        if (years >= 15 && level === 'Expert') {
          boostFactor = 1.15; // +15% for senior/principal level
        } else if (years >= 10 && level === 'Expert') {
          boostFactor = 1.10; // +10% for expert level
        } else if (years >= 8 && level === 'Advanced') {
          boostFactor = 1.05; // +5% for advanced with significant experience
        }

        // Apply boost
        similarity = Math.min(1.0, similarity * boostFactor);

        const metadata = typeof vector.metadata === 'string'
          ? JSON.parse(vector.metadata)
          : vector.metadata;

        similarities.push({
          id: vector.id as number,
          item_id: vector.item_id as number,
          similarity,
          technology: {
            id: vector.item_id,
            name: vector.name,
            experience: vector.experience,
            years: vector.experience_years,
            proficiency: vector.proficiency_percent,
            level: vector.level,
            summary: vector.summary,
            category: vector.category,
            recency: vector.recency,
            action: vector.action,
            effect: vector.effect,
            outcome: vector.outcome,
            related_project: vector.related_project,
            employer: vector.employer,
          },
          metadata,
        });
      } catch (error: any) {
        console.error(`Error processing vector ${vector.id}:`, error.message);
        continue;
      }
    }

    // Sort by similarity (highest first) and take top 5
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, 5);

    console.log(`Top result: ${topResults[0]?.technology.name} (${topResults[0]?.similarity.toFixed(4)})`);

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
          source: 'd1-vectors',
          vector_id: r.id,
        },
      })),
      source: 'd1-vectors',
      total_compared: vectors.length,
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
          console.log(`AI quota exceeded: ${status.neuronsUsed}/${status.neuronsLimit} neurons (resets at ${status.resetAt})`);
          responseData.assistantReply = getCircuitBreakerMessage();
          responseData.quotaExceeded = true;
          responseData.quotaStatus = status;
        } else {
          // Quota available - proceed with AI inference
          const top5 = topResults.slice(0, 10); // Increased from 5 to 10 for better multi-skill synthesis
        const topScore = top5[0]?.similarity ?? 0;

        // Confidence interpretation: scores above 0.65 are strong matches for broad queries
        const confidence = topScore >= 0.80 ? 'very high' :
                          topScore >= 0.65 ? 'high' :
                          topScore >= 0.50 ? 'moderate' : 'low';

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
   - Prioritize measurable outcomes (percentages, cycle times, uptime, throughput)
   - Avoid vague phrases like "delivered business value" or "drove success"

5. **Avoid tool-centric answers**
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
        // max_tokens: 120 (reduced from 150) - forces concise responses while allowing complete sentences
        // Fixed neuron cost: ~90-100 per inference (more predictable with laconic enforcement)
        // Post-processing (enforceLaconicStyle) ensures max 3 sentences regardless of model output
        // Estimated cost: 85-95 neurons actual due to shorter responses + stop sequences
        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-70b-instruct' as any, {
          messages: [
            { 
              role: 'system', 
              content: `You are a recruiter-facing assistant that answers questions about José's professional profile. ALWAYS respond in first person as José using British English (spellings, phrasing, conventions).

CRITICAL: LACONIC STYLE (MANDATORY)
- Maximum 3 SHORT sentences (each under 25 words)
- NO opening filler: "I've worked on...", "I have experience in...", "Notably..."
- Start with the ANSWER: project names, outcomes, or specific skills
- Always mention the employer explicitly at the end (e.g., "at Wairbut", "at CCHQ")
- Use strong verbs ("engineered," "delivered," "architected") NOT adjectives ("enterprise-grade", "comprehensive")
- Include ONE measurable outcome (numbers, percentages, scale)
- Example GOOD: "I engineered CCHQ's campaign platform, cutting release cycles from weeks to days."
- Example BAD: "I've worked on a range of projects utilising my expertise in C#, JavaScript, and SOA."

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
          max_tokens: 120, // Reduced from 150 to enforce conciseness (post-processing ensures 3 sentences)
          stop: ["\n\n\n", "---", ". Additionally", ". Moreover", ". Furthermore"] // Stop at filler phrases
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
              console.error('Stream consumption error:', error);
              reader.cancel('Error reading stream');
              throw error;
            } finally {
              reader.releaseLock();
            }
          };
          
          // Check if response is a ReadableStream
          if (aiResponse && typeof aiResponse === 'object' && 'body' in aiResponse && aiResponse.body instanceof ReadableStream) {
            console.log('AI response is a ReadableStream, consuming fully...');
            aiReply = await consumeStream(aiResponse.body);
          } else if (aiResponse && typeof aiResponse === 'object' && aiResponse instanceof ReadableStream) {
            console.log('AI response is directly a ReadableStream, consuming fully...');
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
            // Try to stringify and look for content
            console.log('AI response is object, attempting to extract content...');
            const responseStr = JSON.stringify(aiResponse);
            console.log('AI response structure:', responseStr.substring(0, 300));
            
            // Try common response patterns
            if ('content' in aiResponse) {
              aiReply = aiResponse.content;
            } else if ('text' in aiResponse) {
              aiReply = aiResponse.text;
            } else if ('message' in aiResponse && typeof aiResponse.message === 'object' && 'content' in aiResponse.message) {
              aiReply = aiResponse.message.content;
            }
          }
          
          console.log('AI response type:', typeof aiResponse);
          console.log('AI response constructor:', aiResponse?.constructor?.name || 'N/A');
          console.log('Extracted AI reply length:', aiReply.length);
          console.log('AI reply preview:', aiReply.substring(0, 100));
          
          // Clean up any incomplete sentences from truncation
          aiReply = cleanupAIReply(aiReply);
          console.log('Cleaned AI reply length:', aiReply.length);
          
          // Enforce laconic style: max 3 sentences, remove filler
          aiReply = enforceLaconicStyle(aiReply);
          console.log('Laconic AI reply length:', aiReply.length);
          
          responseData.assistantReply = aiReply;
          
          // Increment quota counter after successful inference
          // Fixed neuron cost: 102 per call (validated at 97% accuracy via testing)
          // Note: max_tokens=150 allows ~50% buffer for complete sentences, but actual usage
          // typically stays around 100-120 tokens due to natural completion and stop sequences.
          // We use a fixed cost for predictability rather than calculating exact token counts.
          await incrementQuota(env.KV, NEURON_COSTS['llama-3.1-70b-instruct']);
          console.log(`AI inference successful. Quota: ${(status.neuronsUsed + NEURON_COSTS['llama-3.1-70b-instruct']).toFixed(2)}/${status.neuronsLimit} neurons`);
        }
      } catch (aiError: any) {
        console.error('AI reply generation failed:', aiError);
        console.error('AI error details:', aiError.message, aiError.stack);
        responseData.assistantReply = '';
        responseData.aiError = aiError.message;
      }
    }

    return Response.json(responseData);

  } catch (error: any) {
    console.error('D1 Vector query error:', error);
    return Response.json({
      error: error.message || 'Query failed',
      stack: error.stack,
    }, { status: 500 });
  }
}
