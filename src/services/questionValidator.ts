/**
 * Question Validator Service
 * 
 * Single Responsibility: Validates if questions are appropriate technical queries.
 * Blocks non-technical queries (compensation, personal, etc.)
 */

import type { IQuestionValidator, QuestionValidationResult } from '../types/validators';

interface ValidationPattern {
  pattern: RegExp;
  type: string;
  suggestion: string;
}

/**
 * Question Validator Service Implementation
 * 
 * Validates that user questions are technical/professional in nature.
 * Rejects personal, compensation, and other non-technical queries.
 */
export class QuestionValidatorService implements IQuestionValidator {
  private readonly nonTechnicalPatterns: ValidationPattern[] = [
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

  /**
   * Validate if the question is a technical/professional query
   */
  validate(query: string): QuestionValidationResult {
    for (const { pattern, suggestion } of this.nonTechnicalPatterns) {
      if (pattern.test(query)) {
        return {
          isValid: false,
          errorMessage: `I can only answer questions about technical skills, projects, and professional achievements.`,
          suggestion
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Add a custom validation pattern (useful for testing or extensions)
   */
  addPattern(pattern: RegExp, type: string, suggestion: string): void {
    this.nonTechnicalPatterns.push({ pattern, type, suggestion });
  }
}
