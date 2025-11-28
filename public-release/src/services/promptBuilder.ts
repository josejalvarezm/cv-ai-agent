/**
 * Prompt Builder Service
 * 
 * Single Responsibility: Constructs AI prompts for CV assistant.
 * Builds system prompts, context prompts, and handles project-specific variations.
 */

import type { IPromptBuilder, SkillMatch, ProjectDetectionResult, PromptContext } from '../types/validators';
import { PROMPT_CONFIG } from '../config';

/**
 * Prompt Builder Service Implementation
 * 
 * Responsible for constructing well-structured prompts for the AI model.
 * Separates prompt engineering concerns from business logic.
 */
export class PromptBuilderService implements IPromptBuilder {
  
  /**
   * Build the system prompt for the CV assistant
   */
  buildSystemPrompt(projectDetection?: ProjectDetectionResult): string {
    const projectHint = projectDetection?.isProjectSpecific 
      ? `\n\n**IMPORTANT:** This question is about a specific project (${projectDetection.projectName}). Focus on accomplishments AT that project, not total career years.`
      : '';

    return `You are a recruiter-facing assistant answering questions about a candidate's professional profile. Respond in FIRST PERSON as the candidate.

## CORE RULES

1. **EVIDENCE-BASED RESPONSES** (let facts speak, no self-assessment)
   - Lead with WHAT was done: "I built...", "I delivered...", "I architected..."
   - Include measurable outcomes when available
   - End with the EXACT employer FROM THE DATA
   - NEVER use self-assessed labels: "senior", "expert", "specialist", "proficient"

2. **LACONIC STYLE (${PROMPT_CONFIG.MAX_SENTENCES} sentences max, ${PROMPT_CONFIG.MAX_WORDS} words)**
   - NO filler: "extensive experience", "strong foundation", "solid background"
   - NO self-promotion: "I'm a senior...", "As an expert...", "I'm highly skilled..."

3. **STAY ON TOPIC**
   - Answer ONLY what was asked - don't add unrequested skills
   - If asked about Angular, talk about Angular - not JavaScript, not React
   - Each question = focused answer on that specific technology

4. **EMPLOYER ACCURACY (CRITICAL)**
   - Each skill has its OWN employer in the data - use ONLY that employer
   - NEVER swap or guess employers - if data says "Acme Corp", say "Acme Corp"
   - Different skills may have different employers - keep them separate

5. **BRITISH ENGLISH**
   - Use -ise spellings: optimise, specialise, analyse, utilise

6. **DATA FIDELITY**
   - Use EXACT years, outcomes, employers FROM THE DATA
   - Angular (3y at TechStart) ≠ AngularJS (10y at Acme Corp) - completely different
   - NEVER mix data between skills

## EXAMPLES

✅ GOOD: "I engineered C# microservices achieving 99.9% uptime at Acme Corp."
✅ GOOD: "I delivered Angular applications with 40% faster load times at TechStart."
❌ BAD: "I have a strong foundation in Angular..." (self-promotion)
❌ BAD: "I also have extensive JavaScript experience..." (off-topic, not asked)
❌ BAD: "...at TechStart" (when data says Acme Corp)${projectHint}`;
  }

  /**
   * Build the user prompt with skill context
   */
  buildUserPrompt(context: PromptContext): string {
    const { query, projectDetection, skills, confidence, topScore } = context;
    
    // Handle empty skills case
    if (!skills.length) {
      return `USER QUESTION: "${query}"

No matching skills found in the database. Please respond honestly that this skill/technology is not in the candidate's profile.`;
    }
    
    // Build results text
    const resultsText = this.buildResultsText(skills);
    
    // Build context analysis
    const contextAnalysis = this.buildContextAnalysis(skills);

    // Build project context if applicable
    const projectContext = projectDetection.isProjectSpecific 
      ? `\n**PROJECT CONTEXT:** Question is about ${projectDetection.projectName}. The "years" field shows TOTAL career experience, not time at ${projectDetection.projectName}. Focus on WHAT was accomplished, not how long.\n`
      : '';

    // Build evidence summary from the data (factual, no labels)
    const evidenceSummary = this.buildEvidenceSummary(skills);

    return `USER QUESTION: "${query}"
${projectContext}
## MATCHING SKILLS (confidence: ${confidence}, score: ${topScore.toFixed(3)})

${resultsText}

${contextAnalysis}

${evidenceSummary}

## RESPONSE RULES

1. **Evidence only** - State facts: years of exposure, what was built, where
2. **No self-labels** - NEVER say "senior", "expert", "specialist" - let recruiter decide
3. **${PROMPT_CONFIG.MAX_SENTENCES} sentences max** - Be laconic, no filler
4. **Action + Outcome + Employer** - "I built X achieving Y at Z"
5. **Use EXACT data** - Don't invent years, outcomes, or projects
6. **Keep skills separate** - Angular (3y) ≠ AngularJS (10y) - different skills, different outcomes
${projectDetection.isProjectSpecific ? `7. **Project-specific** - Focus on WHAT was done at ${projectDetection.projectName}, not total career years` : ''}

Answer with facts. Let the evidence speak for itself.`;
  }

  /**
   * Build combined messages array for AI inference
   */
  buildMessages(context: PromptContext): Array<{ role: string; content: string }> {
    return [
      { role: 'system', content: this.buildSystemPrompt(context.projectDetection) },
      { role: 'user', content: this.buildUserPrompt(context) },
    ];
  }

  /**
   * Build the results text from skills
   */
  private buildResultsText(skills: SkillMatch[]): string {
    return skills.map((r, i) => {
      const tech = r.technology;
      // Put employer prominently at the top
      let text = `${i + 1}. ${tech.name} — ${tech.years} years @ ${tech.employer || 'Unknown'}
   Level: ${tech.level}${tech.recency ? ` (${tech.recency})` : ''}
   Category: ${tech.category}`;
      
      if (tech.action) text += `\n   Action: ${tech.action}`;
      if (tech.effect) text += `\n   Effect: ${tech.effect}`;
      if (tech.outcome) text += `\n   Outcome: ${tech.outcome}`;
      if (tech.related_project) text += `\n   Project: ${tech.related_project}`;
      
      text += `\n   Similarity: ${r.similarity.toFixed(3)}`;
      return text;
    }).join('\n\n');
  }

  /**
   * Build context analysis section (factual, no labels)
   */
  private buildContextAnalysis(skills: SkillMatch[]): string {
    const categories = new Set(skills.map(r => r.technology.category));
    const hasRecent = skills.some(r => r.technology.recency);
    const longExposure = skills.filter(r => r.technology.years >= 10);
    const recentSkills = skills.filter(r => r.technology.recency === 'current' || r.technology.recency === 'recent');

    return `FACTUAL CONTEXT (for reference, do NOT use labels in response):
- Categories: ${Array.from(categories).join(', ')}
- Long exposure (10+ years): ${longExposure.length > 0 ? longExposure.map(s => `${s.technology.name} (${s.technology.years}y)`).join(', ') : 'None'}
- Currently active: ${recentSkills.length > 0 ? recentSkills.map(s => s.technology.name).join(', ') : 'Not specified'}
- Has recent work: ${hasRecent ? 'Yes' : 'No'}`;
  }

  /**
   * Build evidence summary - factual data for AI to use
   * NO labels, NO seniority, just verifiable facts
   */
  private buildEvidenceSummary(skills: SkillMatch[]): string {
    if (!skills.length) return '';

    // Extract verifiable evidence from each skill
    const evidence = skills.map(s => {
      const tech = s.technology;
      const facts: string[] = [];
      
      // Employer FIRST (critical for accuracy)
      if (tech.employer) facts.push(`at ${tech.employer}`);
      
      // Exposure time (fact, not competence)
      facts.push(`${tech.years}y`);
      
      // Recency (verifiable)
      if (tech.recency) facts.push(tech.recency);
      
      // Outcome (the actual proof of competence)
      if (tech.outcome) facts.push(`→ ${tech.outcome}`);
      
      return `- ${tech.name}: ${facts.join(', ')}`;
    });

    return `## EVIDENCE SUMMARY (use EXACTLY as shown)
${evidence.join('\n')}

CRITICAL RULES:
- Answer ONLY about the technology asked - don't add other skills
- Use the EXACT employer shown for each skill - NEVER swap them
- Each skill = different employer context

BANNED PHRASES: "senior", "expert", "specialist", "proficient", "extensive experience", "strong foundation", "solid background", "I also have"`;
  }
}
