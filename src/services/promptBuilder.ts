/**
 * Prompt Builder Service
 * 
 * Single Responsibility: Constructs AI prompts for CV assistant.
 * Builds system prompts, context prompts, and handles project-specific variations.
 */

import type { IPromptBuilder, SkillMatch, ProjectDetectionResult, PromptContext } from '../types/validators';

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
  buildSystemPrompt(_projectDetection?: ProjectDetectionResult): string {
    return `You are a recruiter-facing assistant answering questions about José's professional profile. Respond in FIRST PERSON as José using British English.

## CORE RULES

1. **LACONIC STYLE (2 sentences maximum)**
   - Start with a strong verb: "I engineered...", "I delivered...", "I architected..."
   - End with the employer: "...at CCHQ." or "...at Wairbut."
   - Maximum 40 words total
   - NO filler: "I've worked with...", "My expertise spans...", "I have experience in..."

2. **BRITISH ENGLISH**
   - Use -ise spellings: optimise, specialise, analyse, utilise
   - Use British conventions: organisation, programme, colour

3. **ACCURACY**
   - Use EXACT years from the data (if data says 5 years, never say 7)
   - Each skill has its OWN outcomes - never mix them
   - Angular (3y) ≠ AngularJS (10y) ≠ JavaScript (19y) - keep separate

4. **ANSWER FORMAT**
   Sentence 1: [Strong verb] + [technology] + [measurable outcome] + [employer]
   Sentence 2 (optional): [Additional context or related skill] + [employer]

## EXAMPLES

✅ GOOD: "I engineered C# microservices achieving 99.9% uptime at CCHQ."
✅ GOOD: "I delivered Angular applications with 40% faster load times at Wairbut."
❌ BAD: "I've worked with C# for 19 years, implementing various systems across multiple projects..."
❌ BAD: "I have extensive experience in JavaScript, Angular, and React..."`;
  }

  /**
   * Build the user prompt with skill context
   */
  buildUserPrompt(context: PromptContext): string {
    const { query, projectDetection, skills, confidence, topScore } = context;
    
    // Build results text
    const resultsText = this.buildResultsText(skills);
    
    // Build context analysis
    const contextAnalysis = this.buildContextAnalysis(skills);
    
    // Extract unique employers from skills
    const employers = [...new Set(skills.map(s => s.technology.employer).filter(Boolean))];

    // Build project context if applicable
    const projectContext = projectDetection.isProjectSpecific 
      ? `\n**PROJECT CONTEXT:** Question is about ${projectDetection.projectName}. The "years" field shows TOTAL career experience, not time at ${projectDetection.projectName}. Focus on WHAT was accomplished, not how long.\n`
      : '';

    return `USER QUESTION: "${query}"
${projectContext}
## MATCHING SKILLS (confidence: ${confidence}, score: ${topScore.toFixed(3)})

${resultsText}

${contextAnalysis}

## RESPONSE RULES

1. **2 sentences maximum** - Be laconic, no filler
2. **Start with action verb** - "I engineered...", "I delivered...", "I architected..."
3. **End with employer** - Use one of: ${employers.length ? employers.join(', ') : 'CCHQ, Wairbut'}
4. **Use EXACT data** - Don't invent years, outcomes, or projects
5. **Keep skills separate** - Angular (3y) ≠ AngularJS (10y) - different skills, different outcomes
${projectDetection.isProjectSpecific ? `6. **Project-specific** - Don't say "19 years at ${projectDetection.projectName}" - mention what was DONE, not total career years` : ''}

## CLASSIFICATION (if asked about level)
- 0–3 years = Junior
- 3–7 years = Mid-level  
- 7–15 years = Senior
- 15+ years = Principal/Lead

Answer directly. If asked "Is he qualified for X?", say "Yes, I'm qualified because..."`;
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
      let text = `${i + 1}. ${tech.name} — ${tech.years} years, ${tech.level}${tech.recency ? ` (${tech.recency})` : ''}
   Category: ${tech.category}`;
      
      if (tech.action) text += `\n   Action: ${tech.action}`;
      if (tech.effect) text += `\n   Effect: ${tech.effect}`;
      if (tech.outcome) text += `\n   Outcome: ${tech.outcome}`;
      if (tech.related_project) text += `\n   Project: ${tech.related_project}`;
      if (tech.summary) text += `\n   Summary: ${tech.summary}`;
      
      text += `\n   Similarity: ${r.similarity.toFixed(3)}`;
      return text;
    }).join('\n\n');
  }

  /**
   * Build context analysis section
   */
  private buildContextAnalysis(skills: SkillMatch[]): string {
    const categories = new Set(skills.map(r => r.technology.category));
    const hasRecent = skills.some(r => r.technology.recency);
    const expertSkills = skills.filter(r => r.technology.level === 'Expert');
    const seniorSkills = skills.filter(r => r.technology.years >= 10);

    return `CONTEXT FOR ASSESSMENT:
- Categories represented: ${Array.from(categories).join(', ')}
- Expert-level skills: ${expertSkills.length} (${expertSkills.map(s => s.technology.name).join(', ')})
- Senior experience (10+ years): ${seniorSkills.length} (${seniorSkills.map(s => s.technology.name).join(', ')})
- Recent/current skills: ${hasRecent ? 'Yes' : 'No'}`;
  }
}
