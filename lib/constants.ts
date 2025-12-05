/**
 * Constants used throughout the PolicyPilot application
 * Centralized configuration values to avoid magic numbers
 */

/**
 * Quality score thresholds for policy validation
 * Policies must meet these thresholds to be considered acceptable
 */
export const QUALITY_THRESHOLDS = {
  /** Standard tier quality threshold (0.5 = 50%) */
  STANDARD: 0.5,
  /** Premium tier quality threshold (0.6 = 60%) */
  PREMIUM: 0.6,
  /** Minimum quality score for validation (used in validatePolicyQuality) */
  MINIMUM: 0.6,
} as const;

/**
 * Coverage threshold margins
 * Applied to policy-specific thresholds to allow some flexibility
 */
export const COVERAGE_MARGINS = {
  /** Margin for standard tier (10% reduction) */
  STANDARD: 0.1,
  /** Margin for premium tier (no margin) */
  PREMIUM: 0,
} as const;

/**
 * OpenAI API token limits
 */
export const TOKEN_LIMITS = {
  /** Maximum tokens per request (prompt + completion) */
  MAX_TOKENS: 3500,
} as const;

/**
 * Framework reference requirements
 */
export const FRAMEWORK_REFERENCES = {
  /** Minimum number of framework references required for a valid policy */
  MINIMUM_COUNT: 5,
} as const;

/**
 * Content analysis window sizes
 * Used for context-aware matching and proximity checks
 */
export const WINDOW_SIZES = {
  /** Standard context window size in words (for paragraph-based analysis) */
  STANDARD: 100,
  /** Extended context window size in words (for keyword density checks) */
  EXTENDED: 150,
  /** Maximum distance for proximity matching */
  MAX_DISTANCE: 100,
  /** Window distance for nearby matching (relaxed proximity) */
  NEARBY_DISTANCE: 4,
} as const;

/**
 * Keyword co-occurrence thresholds
 * Used to determine if multiple keywords appear together meaningfully
 */
export const CO_OCCURRENCE_THRESHOLDS = {
  /** Minimum threshold for simple rules */
  SIMPLE: 0.15,
  /** Minimum threshold for complex rules (5+ keywords) */
  COMPLEX: 0.25,
  /** Threshold for strong keyword presence */
  STRONG: 0.35,
  /** Threshold for keyword-only matches (no article refs) */
  KEYWORD_ONLY: 0.4,
} as const;

/**
 * Keyword matching thresholds
 * Minimum number of keywords required for a match
 */
export const KEYWORD_THRESHOLDS = {
  /** Minimum keywords for required rules */
  REQUIRED: 2,
  /** Minimum keywords for optional rules */
  OPTIONAL: 1,
  /** Minimum percentage of keywords for required rules */
  REQUIRED_PERCENTAGE: 0.4,
  /** Minimum percentage of keywords for optional rules */
  OPTIONAL_PERCENTAGE: 0.3,
  /** Minimum percentage for keyword-only matches */
  KEYWORD_ONLY_PERCENTAGE: 0.3,
} as const;

/**
 * Content validation thresholds
 */
export const CONTENT_THRESHOLDS = {
  /** Minimum word count for substantial content check */
  MINIMUM_WORDS: 15,
  /** Minimum word count for extended content check */
  EXTENDED_WORDS: 30,
  /** Minimum keyword density percentage */
  KEYWORD_DENSITY: 0.3,
} as const;

/**
 * Regex cache configuration
 */
export const REGEX_CACHE = {
  /** Maximum number of cached regex patterns */
  MAX_SIZE: 100,
} as const;

/**
 * Compliance rules cache configuration
 */
export const RULES_CACHE = {
  /** Maximum number of cached rule sets */
  MAX_SIZE: 50,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  /** Standard tier: requests per window */
  STANDARD_REQUESTS: 10,
  /** Premium tier: requests per window */
  PREMIUM_REQUESTS: 50,
  /** Rate limit window in seconds */
  WINDOW_SECONDS: 60,
} as const;

/**
 * Policy generation configuration
 */
export const GENERATION_CONFIG = {
  /** Maximum number of generation attempts */
  MAX_ATTEMPTS: 2,
  /** Maximum feedback items to include in retry */
  MAX_FEEDBACK_ITEMS: 10,
  /** Maximum missing clauses to include in feedback */
  MAX_MISSING_CLAUSES: 5,
} as const;


