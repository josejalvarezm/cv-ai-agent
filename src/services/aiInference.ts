/**
 * AI Inference Service
 * 
 * Single Responsibility: Handles AI model calls and response extraction.
 * Abstracts the complexity of various AI response formats and streaming.
 */

import type { IAIInference } from '../types/validators';

/**
 * Configuration for AI inference
 */
export interface AIInferenceConfig {
  model: string;
  maxTokens: number;
  stopSequences: string[];
  gatewayId: string;
}

/**
 * Default AI configuration
 */
export const DEFAULT_AI_CONFIG: AIInferenceConfig = {
  model: '@cf/meta/llama-3.1-70b-instruct',
  maxTokens: 80,
  stopSequences: [
    "I've worked",
    "I've demonstrated",
    "My expertise spans",
    "I've consistently",
    "Additionally,",
    "Moreover,",
    "In addition,",
    "I have experience",
    "I've developed expertise",
    "My background includes",
    "across multiple",
    "various projects",
    "including ",
    "...",
    "\n\n"
  ],
  gatewayId: 'cv-assistant-gateway',
};

/**
 * AI Inference Service Implementation
 * 
 * Handles:
 * - AI model API calls
 * - Response stream consumption
 * - Various response format extraction
 */
export class AIInferenceService implements IAIInference {
  private ai: any; // Cloudflare AI binding
  private config: AIInferenceConfig;

  constructor(ai: any, config: Partial<AIInferenceConfig> = {}) {
    this.ai = ai;
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  /**
   * Generate AI reply for given prompts
   */
  async generateReply(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.ai.run(this.config.model as any, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: this.config.maxTokens,
      stop: this.config.stopSequences as any,
    }, {
      gateway: {
        id: this.config.gatewayId,
      },
    });

    return this.extractResponseText(response);
  }

  /**
   * Generate AI reply with pre-built messages
   */
  async generateReplyWithMessages(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const response = await this.ai.run(this.config.model as any, {
      messages,
      max_tokens: this.config.maxTokens,
      stop: this.config.stopSequences as any,
    }, {
      gateway: {
        id: this.config.gatewayId,
      },
    });

    return this.extractResponseText(response);
  }

  /**
   * Extract text content from various AI response formats
   */
  async extractResponseText(response: unknown): Promise<string> {
    let text = '';

    // Check if response is a ReadableStream
    if (response && typeof response === 'object') {
      const obj = response as Record<string, unknown>;
      
      if ('body' in obj && obj.body instanceof ReadableStream) {
        text = await this.consumeStream(obj.body);
      } else if (response instanceof ReadableStream) {
        text = await this.consumeStream(response);
      } else if (typeof obj === 'string') {
        text = obj as unknown as string;
      } else if ('response' in obj) {
        if (obj.response instanceof ReadableStream) {
          text = await this.consumeStream(obj.response);
        } else {
          text = obj.response as string;
        }
      } else if ('result' in obj && typeof obj.result === 'object' && obj.result !== null) {
        const result = obj.result as Record<string, unknown>;
        if ('response' in result) {
          if (result.response instanceof ReadableStream) {
            text = await this.consumeStream(result.response);
          } else {
            text = result.response as string;
          }
        }
      } else if (Array.isArray((obj as any).choices) && (obj as any).choices[0]?.message?.content) {
        text = (obj as any).choices[0].message.content;
      } else if ('content' in obj) {
        text = obj.content as string;
      } else if ('text' in obj) {
        text = obj.text as string;
      } else if ('message' in obj && typeof obj.message === 'object' && obj.message !== null) {
        const message = obj.message as Record<string, unknown>;
        if ('content' in message) {
          text = message.content as string;
        }
      }
    } else if (typeof response === 'string') {
      text = response;
    }

    // Remove surrounding quotes if present (happens when response is JSON-stringified)
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }

    return text;
  }

  /**
   * Fully consume a ReadableStream and return as string
   */
  private async consumeStream(stream: ReadableStream): Promise<string> {
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
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIInferenceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AIInferenceConfig {
    return { ...this.config };
  }
}
