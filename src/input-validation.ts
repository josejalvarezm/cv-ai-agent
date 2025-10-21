/**
 * Input Validation & Sanitation for CV Assistant
 * 
 * Prevents abuse, injection attacks, and ensures European business hours compliance
 */

const MAX_INPUT_LENGTH = 200;
const MIN_INPUT_LENGTH = 10;
const BUSINESS_HOURS_START = 8;  // 08:00 UK (GMT/BST)
const BUSINESS_HOURS_END = 20;   // 20:00 UK (GMT/BST)

// Consolidated common-word set used for lightweight English checks.
// We keep a single set `COMMON_WORDS` to avoid duplication.

// Profanity and unsafe keywords to block
const UNSAFE_KEYWORDS = new Set([
  'hate', 'kill', 'murder', 'abuse', 'violence', 'racist', 'sexist',
  'discriminat', 'vulgar', 'obscene', 'explicit', 'porn', 'sex', 'xxx',
]);

export interface ValidationResult {
  isValid: boolean;
  sanitizedInput?: string;
  errorMessage?: string;
  validationDetails?: {
    lengthCheck?: string;
    alphabeticCheck?: string;
    balanceCheck?: string;
    englishWordsCheck?: string;
    safetyCheck?: string;
  };
}

export interface BusinessHoursCheck {
  isWithinHours: boolean;
  currentTime?: string;
  timezone?: string;
}

// Small set of common English words used for lightweight gibberish detection.
// Kept intentionally small to avoid large bundle size but large enough for basic checks.
const COMMON_WORDS = new Set([
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as','you','do','at',
  'this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there','their',
  'what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no','just','him',
  'know','take','people','into','year','your','good','some','could','them','see','other','than','then','now','look','only',
  'come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want',
  'because','any','these','give','day','most','us','are','am','is','was','were','been','being','has','had','having',
  'experience','years','expert','senior','junior','skill','skills','c#','key','main','primary','projects','project',
  'java','javascript','sql','server','development','backend','frontend','performance','database','cloud',
  'architecture','devops','team','lead','leader','principal','manager','engineer','consultant','design','build','maintain',
  'qualified','jose','josé','candidate','profile','background','resume','cv','capabilities','competent','suitable','osito',
  'master','masters','microservices','microservice','principles','api','apis','docker','kubernetes','terraform','aws','azure','gcp',
  'python','typescript','react','angular','vue','node','nodejs','rest','restful','graphql','agile','scrum','ci','cd',
  'git','github','gitlab','jenkins','testing','deployment','infrastructure','security','monitoring','logging','tracing'
]);

/**
 * Lightweight heuristic to detect whether input contains a sufficient fraction
 * of common words to be considered meaningful (not random gibberish).
 */
function isLikelyMeaningful(text: string): boolean {
  const tokens = text.toLowerCase().split(/\s+/).map(t => t.trim()).filter(Boolean);
  let wordCount = 0;
  let matchCount = 0;

  for (const tok of tokens) {
    // ignore single-character tokens (e.g., 'C', '9') when counting
    if (tok.length <= 1) continue;
    // remove punctuation
    const clean = tok.replace(/[^a-z#]/g, '');
    if (!clean) continue;
    wordCount++;
    if (COMMON_WORDS.has(clean)) matchCount++;
  }

  if (wordCount === 0) return false;
  const ratio = matchCount / wordCount;
  // require at least ~35% of tokens to be common words (empirically chosen)
  return ratio >= 0.35;
}

/**
 * Check if current time is within UK business hours (08:00-20:00 GMT/BST, Mon-Fri only)
 * Disabled during weekends (Saturday & Sunday)
 */
export function isWithinBusinessHours(bypassPhrase?: string): BusinessHoursCheck {
  // Special bypass for admin testing
  if (bypassPhrase && bypassPhrase.toLowerCase().includes('i am osito')) {
    return {
      isWithinHours: true,
      currentTime: new Date().toISOString(),
      timezone: 'GMT/BST (bypass active)',
    };
  }

  const now = new Date();
  
  // Check day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = now.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  
  if (isWeekend) {
    return {
      isWithinHours: false,
      currentTime: now.toISOString(),
      timezone: 'GMT/BST (Weekend)',
    };
  }
  
  // Convert to UK time (GMT in winter, BST in summer)
  // Note: This is approximate. For production, use a proper timezone library.
  // GMT is UTC+0, BST (British Summer Time) is UTC+1 (roughly March-October).
  const utcHour = now.getUTCHours();
  const utcMonth = now.getUTCMonth(); // 0-11

  // Approximate DST: March-October (inclusive)
  const isBST = utcMonth >= 2 && utcMonth <= 9; // March (2) to October (9)
  const ukOffset = isBST ? 1 : 0; // BST=UTC+1, GMT=UTC+0

  const ukHour = (utcHour + ukOffset) % 24;

  const isWithinHours = ukHour >= BUSINESS_HOURS_START && ukHour < BUSINESS_HOURS_END;

  return {
    isWithinHours,
    currentTime: now.toISOString(),
    timezone: isBST ? 'BST (UTC+1)' : 'GMT (UTC+0)',
  };
}

/**
 * Check vowel/consonant balance to detect gibberish
 */
function hasExtremeVowelConsonantImbalance(text: string): boolean {
  const letters = text.toLowerCase().match(/[a-z]/g) || [];
  if (letters.length < 5) return false; // Not enough letters to check
  
  const vowels = (text.toLowerCase().match(/[aeiou]/g) || []).length;
  const consonants = letters.length - vowels;
  
  const totalLetters = letters.length;
  const vowelRatio = vowels / totalLetters;
  
  // Extreme imbalance: less than 15% or more than 60% vowels
  // Normal English: 38-40% vowels
  return vowelRatio < 0.15 || vowelRatio > 0.60;
}

/**
 * Check if input has sufficient common English words (at least 20%)
 */
function hasSufficientEnglishWords(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 3) return true; // Skip check for very short inputs
  
  const validWords = words.filter(word => {
  // Check if word is in common words list, or is a recognizable term
  if (COMMON_WORDS.has(word)) return true;
    
    // Allow technical terms and proper nouns (capitalized)
    if (/^[A-Z]/.test(word)) return true;
    
    // Allow words with apostrophes (contractions)
    if (/^[a-z]+'[a-z]+$/.test(word)) return true;
    
    return false;
  });
  
  const englishWordRatio = validWords.length / words.length;
  return englishWordRatio >= 0.20; // At least 20% valid English words
}

/**
 * Check for profanity or unsafe content
 */
/**
 * Check for profanity or unsafe content.
 * Returns the matched keyword if found (as a string), otherwise null.
 * Matches whole words to avoid substring false positives (e.g. 'skills' matching 'sex').
 */
function containsUnsafeContent(text: string): string | null {
  const lowerText = text.toLowerCase();
  const unsafeArray = Array.from(UNSAFE_KEYWORDS);

  for (let i = 0; i < unsafeArray.length; i++) {
    const kw = unsafeArray[i];
    // Build a word-boundary regex; escape the keyword for safety
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(lowerText)) {
      return kw;
    }
  }

  return null;
}

/**
 * Validate and sanitize user input with comprehensive checks
 */
export function validateAndSanitizeInput(input: string): ValidationResult {
  const details: ValidationResult['validationDetails'] = {};
  
  // 1. Check if input is provided
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      errorMessage: "That doesn't look like a valid question — could you rephrase?",
    };
  }

  // 2. Check length BEFORE sanitization to prevent resource exhaustion
  if (input.length > MAX_INPUT_LENGTH) {
    details.lengthCheck = `Too long (${input.length} > ${MAX_INPUT_LENGTH})`;
    return {
      isValid: false,
      errorMessage: "That doesn't look like a valid question — could you rephrase?",
      validationDetails: details,
    };
  }

  // 3. Sanitize: Remove control characters (except newlines/tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  
  // 4. Strip HTML/script tags
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // 5. Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // 6. Check if input is empty or too short after sanitization
  if (sanitized.length < MIN_INPUT_LENGTH) {
    details.lengthCheck = `Too short (${sanitized.length} < ${MIN_INPUT_LENGTH})`;
    return {
      isValid: false,
      errorMessage: "That doesn't look like a valid question — could you rephrase?",
      validationDetails: details,
    };
  }

  // 7. Check for unsafe content (profanity, hate speech, etc.)
  const unsafeMatch = containsUnsafeContent(sanitized);
  if (unsafeMatch) {
    details.safetyCheck = `Matched unsafe keyword: ${unsafeMatch}`;
    return {
      isValid: false,
      errorMessage: "That input isn't appropriate for this chatbot.",
      validationDetails: details,
    };
  }

  // 8. Check for mostly non-alphabetic characters
  const alphabeticChars = (sanitized.match(/[a-zA-Z]/g) || []).length;
  const totalChars = sanitized.length;
  const alphabeticRatio = alphabeticChars / totalChars;
  
  if (alphabeticRatio < 0.50) {
    // Less than 50% alphabetic characters
    details.alphabeticCheck = `Low alphabetic ratio: ${(alphabeticRatio * 100).toFixed(1)}%`;
    return {
      isValid: false,
      errorMessage: "That doesn't look like a valid question — could you rephrase?",
      validationDetails: details,
    };
  }

  // 9. Check for extreme vowel/consonant imbalance (gibberish detection)
  if (hasExtremeVowelConsonantImbalance(sanitized)) {
    const letters = sanitized.toLowerCase().match(/[a-z]/g) || [];
    const vowels = (sanitized.toLowerCase().match(/[aeiou]/g) || []).length;
    const ratio = (vowels / letters.length * 100).toFixed(1);
    details.balanceCheck = `Extreme vowel/consonant imbalance: ${ratio}% vowels`;
    return {
      isValid: false,
      errorMessage: "That doesn't look like a valid question — could you rephrase?",
      validationDetails: details,
    };
  }

  // 10. Check for sufficient common English words (at least 20%)
  if (!hasSufficientEnglishWords(sanitized)) {
    details.englishWordsCheck = `Insufficient common English words (<20%)`;
    return {
      isValid: false,
      errorMessage: "That doesn't look like a valid question — could you rephrase?",
      validationDetails: details,
    };
  }

  // 11. Check for prompt injection attempts
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
      details.safetyCheck = `Prompt injection pattern detected`;
      return {
        isValid: false,
        errorMessage: "That doesn't look like a valid question — could you rephrase?",
        validationDetails: details,
      };
    }
  }
  
  // 12. Check for gibberish (too many repeated characters)
  const repeatedChars = sanitized.match(/(.)\1{4,}/g); // 5+ same chars in a row
  if (repeatedChars && repeatedChars.length > 2) {
    details.alphabeticCheck = `Excessive character repetition detected`;
    return {
      isValid: false,
      errorMessage: "That doesn't look like a valid question — could you rephrase?",
      validationDetails: details,
    };
  }

  // 12b. Lightweight gibberish detection using common-word coverage
  if (!isLikelyMeaningful(sanitized)) {
    return {
      isValid: false,
      errorMessage: "That input doesn't look valid. Please rephrase your question.",
    };
  }

  // 13. Validation passed
  details.lengthCheck = `Valid (${sanitized.length} chars)`;
  details.alphabeticCheck = `Valid (${(alphabeticRatio * 100).toFixed(1)}% alphabetic)`;
  details.balanceCheck = `Valid`;
  details.englishWordsCheck = `Valid`;
  details.safetyCheck = `Clean`;
  
  return {
    isValid: true,
    sanitizedInput: sanitized,
    validationDetails: details,
  };
}

/**
 * Get business hours error message
 */
export function getBusinessHoursMessage(): string {
  return "Our assistant is available during UK business hours (Monday-Friday, 08:00-20:00 GMT/BST). Please return then for a full response.";
}

/**
 * Get circuit breaker error message
 */
export function getCircuitBreakerMessage(): string {
  return "Service temporarily unavailable or quota reached. Please try again later.";
}
