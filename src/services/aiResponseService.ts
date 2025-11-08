/**
 * AI Response Service
 * Handles LLM-based response generation for query results
 */

import { AI_CONFIG, SEARCH_CONFIG } from '../config';
import type { VectorSearchResult } from './vectorSearchService';

/**
 * Generate AI response based on search results
 * 
 * @param query - User's original query
 * @param results - Vector search results
 * @param ai - Workers AI binding
 * @returns AI-generated response string
 */
export async function generateAIResponse(
  query: string,
  results: VectorSearchResult[],
  ai: Ai
): Promise<string> {
  if (results.length === 0) {
    return "I couldn't find any relevant skills for that query. Could you try rephrasing?";
  }

  try {
    const top5 = results.slice(0, SEARCH_CONFIG.TOP_K);
    const topScore = top5[0]?.similarity ?? 0;
    const confidence = topScore >= SEARCH_CONFIG.HIGH_CONFIDENCE ? 'high' : 
                      topScore >= SEARCH_CONFIG.MEDIUM_CONFIDENCE ? 'medium' : 'low';

    const resultsText = formatResultsForPrompt(top5);

    const prompt = buildPrompt(query, resultsText, confidence, topScore);

    const aiResponse = await ai.run(AI_CONFIG.CHAT_MODEL as any, {
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant that provides concise, factual answers about a candidate\'s technical skills and experience. Focus on concrete outcomes and measurable results.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: AI_CONFIG.MAX_TOKENS,
    }) as any;

    return extractAIReply(aiResponse);
  } catch (aiError: any) {
    console.error('AI reply generation failed:', aiError);
    return '';
  }
}

/**
 * Format search results into a text representation for the AI prompt
 */
function formatResultsForPrompt(results: VectorSearchResult[]): string {
  return results.map((r, i) => {
    const tech = r.technology;
    let text = `${i+1}. ${tech.name} — ${tech.experience_years} years, ${tech.level}`;
    if (tech.action) text += `\n   Action: ${tech.action}`;
    if (tech.effect) text += `\n   Effect: ${tech.effect}`;
    if (tech.outcome) text += `\n   Outcome: ${tech.outcome}`;
    if (tech.related_project) text += `\n   Project: ${tech.related_project}`;
    text += `\n   Similarity: ${r.similarity.toFixed(3)}`;
    return text;
  }).join('\n\n');
}

/**
 * Build the AI prompt with query context
 */
function buildPrompt(
  query: string,
  resultsText: string,
  confidence: string,
  topScore: number
): string {
  return `You are a helpful technical assistant answering questions about a candidate's CV.

USER QUESTION: "${query}"

TOP MATCHING SKILLS (confidence: ${confidence}, score: ${topScore.toFixed(3)}):
${resultsText}

Provide a concise 2-3 sentence answer that:
1. Uses the top matching skills to answer the question
2. Highlights measurable outcomes when available
3. Mentions years of experience and proficiency level
4. Keeps it professional and factual

Answer directly and concisely.`;
}

/**
 * Extract the AI response text from various response formats
 */
function extractAIReply(aiResponse: any): string {
  if (typeof aiResponse === 'string') {
    return aiResponse.trim();
  } else if (aiResponse?.response) {
    return aiResponse.response.trim();
  } else if (Array.isArray(aiResponse?.choices) && aiResponse.choices[0]?.message?.content) {
    return aiResponse.choices[0].message.content.trim();
  }
  return '';
}
