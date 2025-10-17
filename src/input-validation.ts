/**
 * Input Validation & Sanitation for CV Assistant
 * 
 * Prevents abuse, injection attacks, and ensures European business hours compliance
 */

const MAX_INPUT_LENGTH = 500;
const BUSINESS_HOURS_START = 9;  // 09:00 CET/CEST
const BUSINESS_HOURS_END = 19;   // 19:00 CET/CEST

export interface ValidationResult {
  isValid: boolean;
  sanitizedInput?: string;
  errorMessage?: string;
}

export interface BusinessHoursCheck {
  isWithinHours: boolean;
  currentTime?: string;
  timezone?: string;
}

/**
 * Check if current time is within European business hours (09:00-19:00 CET/CEST)
 */
export function isWithinBusinessHours(bypassPhrase?: string): BusinessHoursCheck {
  // Special bypass for admin testing
  if (bypassPhrase && bypassPhrase.toLowerCase().includes('i am osito')) {
    return {
      isWithinHours: true,
      currentTime: new Date().toISOString(),
      timezone: 'CET/CEST (bypass active)',
    };
  }

  const now = new Date();
  
  // Convert to CET/CEST (Europe/Paris timezone)
  // Note: This is approximate. For production, use a proper timezone library
  // CET is UTC+1, CEST (summer time) is UTC+2
  const utcHour = now.getUTCHours();
  const utcMonth = now.getUTCMonth(); // 0-11
  
  // Approximate DST: Last Sunday of March to last Sunday of October
  // For simplicity, we'll use March-October as DST period
  const isDST = utcMonth >= 2 && utcMonth <= 9; // March (2) to October (9)
  const cetOffset = isDST ? 2 : 1; // CEST=UTC+2, CET=UTC+1
  
  const cetHour = (utcHour + cetOffset) % 24;
  
  const isWithinHours = cetHour >= BUSINESS_HOURS_START && cetHour < BUSINESS_HOURS_END;
  
  return {
    isWithinHours,
    currentTime: now.toISOString(),
    timezone: isDST ? 'CEST (UTC+2)' : 'CET (UTC+1)',
  };
}

/**
 * Validate and sanitize user input
 */
export function validateAndSanitizeInput(input: string): ValidationResult {
  // 1. Check if input is provided
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      errorMessage: "That input doesn't look valid. Please rephrase your question.",
    };
  }

  // 2. Check length BEFORE sanitization to prevent resource exhaustion
  if (input.length > MAX_INPUT_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Your input is too long (max ${MAX_INPUT_LENGTH} characters). Please shorten and try again.`,
    };
  }

  // 3. Sanitize: Remove control characters (except newlines/tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  
  // 4. Strip HTML/script tags
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // 5. Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // 6. Check for prompt injection attempts
  const injectionPatterns = [
    /ignore\s+(previous|all|above|prior)\s+(instructions|prompts?|rules?|directives?)/i,
    /you\s+are\s+(now|a|an)\s+/i,  // "you are now a...", "you are an expert in..."
    /forget\s+(everything|all|previous)/i,
    /system\s*:\s*/i,  // Trying to inject system messages
    /assistant\s*:\s*/i,
    /<\|im_start\|>/i,  // Common LLM instruction markers
    /<\|im_end\|>/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /###\s*Instruction/i,
  ];
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      return {
        isValid: false,
        errorMessage: "That input doesn't look valid. Please rephrase your question.",
      };
    }
  }
  
  // 7. Check if input is empty or too short after sanitization
  if (sanitized.length < 3) {
    return {
      isValid: false,
      errorMessage: "That input doesn't look valid. Please rephrase your question.",
    };
  }
  
  // 8. Check for gibberish (too many repeated characters)
  const repeatedChars = sanitized.match(/(.)\1{4,}/g); // 5+ same chars in a row
  if (repeatedChars && repeatedChars.length > 2) {
    return {
      isValid: false,
      errorMessage: "That input doesn't look valid. Please rephrase your question.",
    };
  }
  
  // 9. Validation passed
  return {
    isValid: true,
    sanitizedInput: sanitized,
  };
}

/**
 * Get business hours error message
 */
export function getBusinessHoursMessage(): string {
  return "Our assistant is available during European business hours (09:00–19:00 CET). Please return then for a full response.";
}

/**
 * Get circuit breaker error message
 */
export function getCircuitBreakerMessage(): string {
  return "Service temporarily unavailable or quota reached. Please try again later.";
}
