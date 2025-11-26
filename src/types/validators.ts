/**
 * Validator Interfaces
 * 
 * Defines contracts for validation services following Interface Segregation Principle (ISP).
 * Each interface has a single, focused responsibility.
 */

/**
 * Result of question type validation
 */
export interface QuestionValidationResult {
  isValid: boolean;
  errorMessage?: string;
  suggestion?: string;
}

/**
 * Result of response quality validation
 */
export interface ResponseQualityResult {
  isValid: boolean;
  issues: string[];
  correctedReply?: string;
}

/**
 * Result of project detection in query
 */
export interface ProjectDetectionResult {
  isProjectSpecific: boolean;
  projectName?: string;
  cleanQuery: string;
}

/**
 * Question Validator Service Interface
 * Validates if a question is appropriate (technical vs non-technical)
 */
export interface IQuestionValidator {
  validate(query: string): QuestionValidationResult;
}

/**
 * Response Validator Service Interface
 * Validates and cleans AI-generated responses
 */
export interface IResponseValidator {
  /**
   * Clean up incomplete sentences from AI output
   */
  cleanupReply(reply: string): string;

  /**
   * Enforce laconic style (max sentences, remove filler)
   */
  enforceLaconicStyle(reply: string): string;

  /**
   * Validate response quality and auto-correct issues
   */
  validateQuality(reply: string): ResponseQualityResult;

  /**
   * Full processing pipeline: cleanup -> laconic -> validate
   */
  processReply(reply: string): string;
}

/**
 * Project Detector Service Interface
 * Detects if query is asking about a specific project/company
 */
export interface IProjectDetector {
  detect(query: string): ProjectDetectionResult;
}

/**
 * Context for building prompts
 */
export interface PromptContext {
  query: string;
  projectDetection: ProjectDetectionResult;
  skills: SkillMatch[];
  confidence: string;
  topScore: number;
}

/**
 * Prompt Builder Service Interface
 * Builds AI prompts for CV assistant
 */
export interface IPromptBuilder {
  /**
   * Build the system prompt for the AI
   */
  buildSystemPrompt(projectContext?: ProjectDetectionResult): string;

  /**
   * Build the user prompt with context
   */
  buildUserPrompt(context: PromptContext): string;

  /**
   * Build combined messages array for AI inference
   */
  buildMessages(context: PromptContext): Array<{ role: string; content: string }>;
}

/**
 * AI Inference Service Interface
 * Handles AI model calls and response extraction
 */
export interface IAIInference {
  /**
   * Generate AI reply for a query
   */
  generateReply(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string>;

  /**
   * Extract text content from various AI response formats
   */
  extractResponseText(response: unknown): Promise<string>;
}

/**
 * Skill match result from vector search
 */
export interface SkillMatch {
  id: string;
  item_id: number;
  similarity: number;
  technology: {
    id: number;
    name: string;
    experience: string;
    years: number;
    proficiency: number;
    level: string;
    summary: string;
    category: string;
    recency: string;
    action: string;
    effect: string;
    outcome: string;
    related_project: string;
    employer: string;
  };
  metadata: Record<string, unknown>;
}
