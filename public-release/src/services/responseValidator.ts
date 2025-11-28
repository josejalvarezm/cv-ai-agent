/**
 * Response Validator Service
 * 
 * Single Responsibility: Validates and cleans AI-generated responses.
 * Ensures responses follow laconic style guidelines.
 */

import type { IResponseValidator, ResponseQualityResult } from '../types/validators';

/**
 * Response Validator Service Implementation
 * 
 * Processes AI responses to ensure they meet quality standards:
 * - Complete sentences (no truncation mid-sentence)
 * - Laconic style (max 2-3 sentences, no filler)
 * - Proper employer attribution at end
 */
export class ResponseValidatorService implements IResponseValidator {
  private readonly maxSentences: number;

  private readonly fillerPhrases: RegExp[] = [
    // Generic openers (PRIORITY - remove these first)
    /^I've worked in \w+(-\w+)?\s+(technologies|domains?|areas?|fields?)?\s+for \d+ years?,?\s*/gi,
    /^I've consistently delivered (high-quality )?work (across|for|over) \d+ years (of experience )?in[^.]+\.\s*/gi,
    /^My expertise spans\s+[^.]+\.\s*/gi,
    /^I've demonstrated expertise in (multiple areas?|various domains?),?\s*/gi,

    // Project/skill listing patterns
    /^I've worked (on|with) (a range of |various )?projects,?\s*(utilising|using) (a range of |various )?skills (including|such as)[^.]+\.\s*/i,
    /^I've worked (on|with) (a range of |various )?(projects|technologies|tools)[^.]+\.\s*/i,
    /^I've worked (on|with) [A-Z][a-z]+ for \d+ years?,?\s*/i,
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
    /,?\s*including [^.]+,\s*[^.]+,\s*and [^.]+\.$/gi,
    /\s+across (multiple|various) (projects|domains|areas)\.$/gi,
  ];

  private readonly fillerChecks = [
    { phrase: "I've worked in", severity: "high" },
    { phrase: "My expertise spans", severity: "high" },
    { phrase: "I've consistently", severity: "high" },
    { phrase: "I've demonstrated", severity: "high" },
    { phrase: "across multiple", severity: "medium" },
    { phrase: "various projects", severity: "medium" },
  ];

  constructor(maxSentences: number = 2) {
    this.maxSentences = maxSentences;
  }

  /**
   * Clean up incomplete sentences from AI output
   */
  cleanupReply(reply: string): string {
    if (!reply || reply.trim().length === 0) return reply;

    let cleaned = reply.trim();

    // Check if response ends mid-sentence (no proper punctuation)
    const lastChar = cleaned[cleaned.length - 1];
    const hasProperEnding = ['.', '!', '?', '"', "'", ')', ']'].includes(lastChar);

    if (!hasProperEnding) {
      // Find the last complete sentence (ends with . ! or ?)
      const sentenceEndPattern = /[.!?](?=\s+[A-Z]|\s*$)/g;
      const matches = [...cleaned.matchAll(sentenceEndPattern)];

      if (matches.length > 0) {
        const lastSentenceEnd = matches[matches.length - 1].index! + 1;
        cleaned = cleaned.substring(0, lastSentenceEnd).trim();
      } else {
        cleaned = cleaned + '...';
      }
    }

    // Remove any trailing incomplete phrases after sentence endings
    cleaned = cleaned.replace(/([.!?])(?=\s+[A-Z])\s+[^.!?]*$/, '$1');

    return cleaned;
  }

  /**
   * Enforce laconic style: maximum sentences, remove filler
   */
  enforceLaconicStyle(reply: string): string {
    if (!reply || reply.trim().length === 0) return reply;

    let cleaned = reply.trim();

    // Remove filler phrases
    for (const filler of this.fillerPhrases) {
      cleaned = cleaned.replace(filler, '');
    }

    // Split into sentences
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

    // Take only first N sentences
    let laconic = reconstructed.slice(0, this.maxSentences).join(' ').trim();

    // Ensure ends with proper punctuation
    if (laconic && !['.', '!', '?'].includes(laconic[laconic.length - 1])) {
      laconic += '.';
    }

    return laconic.trim();
  }

  /**
   * Validate response quality and auto-correct issues
   */
  validateQuality(reply: string): ResponseQualityResult {
    const issues: string[] = [];

    // Check 1: Must end with employer
    if (!/(at [A-Z][a-zA-Z\s]+)\.$/.test(reply)) {
      issues.push("Missing employer at end");
    }

    // Check 2: Sentence count
    const sentences = reply.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length > 3) {
      issues.push(`Too many sentences (${sentences.length}, max 3)`);
    }

    // Check 3: Word count
    const wordCount = reply.split(/\s+/).length;
    if (wordCount > 60) {
      issues.push(`Too wordy (${wordCount} words, target <60)`);
    }

    // Check 4: No filler phrases
    for (const { phrase, severity } of this.fillerChecks) {
      if (reply.includes(phrase)) {
        issues.push(`Contains filler (${severity}): "${phrase}"`);
      }
    }

    // Auto-correct if too many sentences
    let correctedReply: string | undefined;
    if (sentences.length > 3) {
      correctedReply = sentences.slice(0, 2).join(' ');
    }

    return {
      isValid: issues.length === 0,
      issues,
      correctedReply,
    };
  }

  /**
   * Full processing pipeline: cleanup -> laconic -> validate
   */
  processReply(reply: string): string {
    let processed = this.cleanupReply(reply);
    processed = this.enforceLaconicStyle(processed);

    const quality = this.validateQuality(processed);
    if (!quality.isValid && quality.correctedReply) {
      processed = quality.correctedReply;
    }

    return processed;
  }
}
