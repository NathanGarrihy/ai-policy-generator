import {
  ALL_RULES,
  GDPR_RULES,
  AI_ACT_RULES,
  ISO_42001_RULES,
  type ComplianceRule,
} from "./compliance-rules";

export type PolicyCopResult = {
  gdpr_coverage: number;
  ai_act_coverage: number;
  iso_42001_coverage: number;
  missing_clauses: Array<{
    framework: string;
    article_ref: string;
    clause_text: string;
    required: boolean;
  }>;
  section_scores: Array<{
    section_name: string;
    gdpr_coverage: number;
    ai_act_coverage: number;
    iso_42001_coverage: number;
    missing_clauses: Array<{
      framework: string;
      article_ref: string;
      clause_text: string;
      required: boolean;
    }>;
  }>;
};

/**
 * Parses policy content into sections based on markdown headings (H2/H3)
 * Handles edge cases: no headings, nested headings
 * Each H2 or H3 heading starts a new section
 */
export function parsePolicySections(policyContent: string): Array<{
  name: string;
  content: string;
}> {
  const sections: Array<{ name: string; content: string }> = [];
  const lines = policyContent.split("\n");
  
  let currentSection: { name: string; content: string } | null = null;
  let currentContent: string[] = [];
  let hasSeenHeading = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match H2 (##) or H3 (###) headings
    const headingMatch = line.match(/^(##|###)\s+(.+)$/);
    
    if (headingMatch) {
      hasSeenHeading = true;
      
      // Save previous section if it exists
      if (currentSection) {
        currentSection.content = currentContent.join("\n").trim();
        sections.push(currentSection);
      }
      
      // Start new section
      const sectionName = headingMatch[2].trim();
      currentSection = { name: sectionName, content: "" };
      currentContent = [];
    } else {
      // Non-heading line - add to current section or create default section
      if (currentSection) {
        // Add to existing section
        currentContent.push(line);
      } else if (!hasSeenHeading) {
        // Content before any heading - accumulate for default section
        currentContent.push(line);
      }
      // If we've seen headings but no current section, skip orphaned content
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = currentContent.join("\n").trim();
    sections.push(currentSection);
  } else if (currentContent.length > 0 && !hasSeenHeading) {
    // No headings found - treat entire content as one section
    sections.push({
      name: "Policy Content",
      content: currentContent.join("\n").trim(),
    });
  }

  // Final fallback: if no sections were found at all
  if (sections.length === 0) {
    sections.push({
      name: "Policy Content",
      content: policyContent.trim(),
    });
  }

  return sections;
}

/**
 * Analyzes a single section's compliance against all frameworks
 */
function analyzeSectionCompliance(
  sectionContent: string
): {
  gdpr_coverage: number;
  ai_act_coverage: number;
  iso_42001_coverage: number;
  missing_clauses: Array<{
    framework: string;
    article_ref: string;
    clause_text: string;
    required: boolean;
  }>;
} {
  const contentLower = sectionContent.toLowerCase();

  // Check GDPR rules
  const gdprMatches = checkRules(GDPR_RULES, contentLower);
  const gdprCoverage = calculateCoverage(gdprMatches, GDPR_RULES);

  // Check AI Act rules
  const aiActMatches = checkRules(AI_ACT_RULES, contentLower);
  const aiActCoverage = calculateCoverage(aiActMatches, AI_ACT_RULES);

  // Check ISO 42001 rules
  const isoMatches = checkRules(ISO_42001_RULES, contentLower);
  const isoCoverage = calculateCoverage(isoMatches, ISO_42001_RULES);

  // Find missing clauses (required ones that weren't found)
  const missingClauses = ALL_RULES.filter((rule) => {
    if (!rule.required) return false;
    const matched = checkRule(rule, contentLower);
    return !matched;
  }).map((rule) => ({
    framework: rule.framework,
    article_ref: rule.article_ref,
    clause_text: rule.clause_text,
    required: rule.required,
  }));

  return {
    gdpr_coverage: Math.round(gdprCoverage * 100) / 100,
    ai_act_coverage: Math.round(aiActCoverage * 100) / 100,
    iso_42001_coverage: Math.round(isoCoverage * 100) / 100,
    missing_clauses: missingClauses,
  };
}

/**
 * Analyzes policy content against compliance rules
 * Now includes section-level scoring
 */
export function analyzePolicyCompliance(
  policyContent: string
): PolicyCopResult {
  const contentLower = policyContent.toLowerCase();

  // Parse policy into sections
  const sections = parsePolicySections(policyContent);

  // Analyze each section
  const sectionScores = sections.map((section) => ({
    section_name: section.name,
    ...analyzeSectionCompliance(section.content),
  }));

  // Calculate overall scores (aggregate from sections)
  // We can either average section scores or analyze the full document
  // For backward compatibility, we'll analyze the full document for overall scores
  const gdprMatches = checkRules(GDPR_RULES, contentLower);
  const gdprCoverage = calculateCoverage(gdprMatches, GDPR_RULES);

  const aiActMatches = checkRules(AI_ACT_RULES, contentLower);
  const aiActCoverage = calculateCoverage(aiActMatches, AI_ACT_RULES);

  const isoMatches = checkRules(ISO_42001_RULES, contentLower);
  const isoCoverage = calculateCoverage(isoMatches, ISO_42001_RULES);

  // Find missing clauses (required ones that weren't found)
  const missingClauses = ALL_RULES.filter((rule) => {
    if (!rule.required) return false;
    const matched = checkRule(rule, contentLower);
    return !matched;
  }).map((rule) => ({
    framework: rule.framework,
    article_ref: rule.article_ref,
    clause_text: rule.clause_text,
    required: rule.required,
  }));

  return {
    gdpr_coverage: Math.round(gdprCoverage * 100) / 100,
    ai_act_coverage: Math.round(aiActCoverage * 100) / 100,
    iso_42001_coverage: Math.round(isoCoverage * 100) / 100,
    missing_clauses: missingClauses,
    section_scores: sectionScores,
  };
}

// ============================================================================
// Keyword Expansion and Variation Utilities
// ============================================================================

/**
 * Synonym mapping for common terms
 */
const SYNONYMS: Record<string, string[]> = {
  "data subject": ["individual", "user", "person", "data subject", "subject"],
  "individual": ["data subject", "user", "person", "individual"],
  "user": ["data subject", "individual", "person", "user"],
  "personal data": ["personal information", "personal data", "pii", "personally identifiable information"],
  "processing": ["process", "processing", "handling", "managing"],
  "consent": ["consent", "permission", "authorization", "agreement"],
  "erasure": ["deletion", "erasure", "removal", "deleting"],
  "rectification": ["correction", "rectification", "updating", "amending"],
  "portability": ["portability", "export", "transfer", "migration"],
};

/**
 * Abbreviation mapping
 */
const ABBREVIATIONS: Record<string, string[]> = {
  "dpo": ["data protection officer", "dpo", "privacy officer"],
  "dpia": ["data protection impact assessment", "dpia", "privacy impact assessment", "pia"],
  "pii": ["personally identifiable information", "pii", "personal data", "personal information"],
  "ai": ["artificial intelligence", "ai", "machine learning", "ml"],
  "gdpr": ["general data protection regulation", "gdpr", "regulation 2016/679"],
};

/**
 * Generates plural forms of a word
 */
function getPluralForms(word: string): string[] {
  const forms = [word];
  
  // Simple pluralization rules
  if (word.endsWith("y")) {
    forms.push(word.slice(0, -1) + "ies");
  } else if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z") || 
             word.endsWith("ch") || word.endsWith("sh")) {
    forms.push(word + "es");
  } else {
    forms.push(word + "s");
  }
  
  return forms;
}

/**
 * Generates verb forms (present, past, gerund)
 */
function getVerbForms(word: string): string[] {
  const forms = [word];
  
  // Simple verb form rules
  if (word.endsWith("e")) {
    forms.push(word + "d"); // past tense
    forms.push(word.slice(0, -1) + "ing"); // gerund
  } else if (word.endsWith("y")) {
    forms.push(word.slice(0, -1) + "ied"); // past tense
    forms.push(word.slice(0, -1) + "ying"); // gerund
  } else if (word.match(/[aeiou][bcdfghjklmnpqrstvwxyz]$/)) {
    // Double consonant rule
    forms.push(word + word.slice(-1) + "ed"); // past tense
    forms.push(word + word.slice(-1) + "ing"); // gerund
  } else {
    forms.push(word + "ed"); // past tense
    forms.push(word + "ing"); // gerund
  }
  
  return forms;
}

/**
 * Expands a keyword with variations, synonyms, and abbreviations
 */
function expandKeyword(keyword: string): string[] {
  const expanded = new Set<string>();
  const keywordLower = keyword.toLowerCase();
  
  // Add original
  expanded.add(keywordLower);
  
  // Add synonyms
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    if (keywordLower.includes(key) || key.includes(keywordLower)) {
      synonyms.forEach(syn => expanded.add(syn));
    }
  }
  
  // Add abbreviations
  for (const [abbr, expansions] of Object.entries(ABBREVIATIONS)) {
    if (keywordLower === abbr) {
      expansions.forEach(exp => expanded.add(exp));
    }
    if (expansions.some(exp => exp === keywordLower)) {
      expanded.add(abbr);
      expansions.forEach(exp => expanded.add(exp));
    }
  }
  
  // Generate variations for each word in the keyword
  const words = keywordLower.split(/\s+/);
  words.forEach(word => {
    // Add plural forms
    getPluralForms(word).forEach(form => {
      expanded.add(form);
      // Also add with original context
      if (words.length > 1) {
        const contextWords = words.filter(w => w !== word);
        expanded.add([...contextWords, form].join(" "));
        expanded.add([form, ...contextWords].join(" "));
      }
    });
    
    // Add verb forms
    getVerbForms(word).forEach(form => {
      expanded.add(form);
      if (words.length > 1) {
        const contextWords = words.filter(w => w !== word);
        expanded.add([...contextWords, form].join(" "));
        expanded.add([form, ...contextWords].join(" "));
      }
    });
  });
  
  // Handle word order variations for multi-word phrases
  if (words.length > 1) {
    // Add reversed order
    expanded.add(words.slice().reverse().join(" "));
    // Add with different word orders (for 2-word phrases)
    if (words.length === 2) {
      expanded.add(words[1] + " " + words[0]);
    }
  }
  
  return Array.from(expanded);
}

/**
 * Creates a fuzzy matching pattern that handles common typos
 * Uses character substitution patterns for common mistakes
 */
function createFuzzyPattern(keyword: string): RegExp {
  // Escape special regex characters
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Common typo patterns: missing/extra characters, character swaps
  // For now, we'll use word boundary matching with case-insensitive flag
  // More sophisticated fuzzy matching can be added later
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

/**
 * Checks if a keyword matches in content using word boundary matching
 * with support for variations and fuzzy matching
 */
function matchKeyword(keyword: string, content: string): boolean {
  // Expand keyword to include variations
  const expandedKeywords = expandKeyword(keyword);
  
  // Try exact word boundary match first (most reliable)
  for (const expandedKeyword of expandedKeywords) {
    // Use word boundary regex for exact matches
    const exactPattern = new RegExp(`\\b${expandedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (exactPattern.test(content)) {
      return true;
    }
  }
  
  // Try fuzzy matching for common typos (1-2 character differences)
  // This is a simplified version - can be enhanced with Levenshtein distance
  for (const expandedKeyword of expandedKeywords) {
    const fuzzyPattern = createFuzzyPattern(expandedKeyword);
    if (fuzzyPattern.test(content)) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Article Reference Detection
// ============================================================================

/**
 * Normalizes article references to extract the core number/identifier
 */
function extractArticleNumber(articleRef: string): string {
  // Extract numbers and dots (e.g., "6", "8.2", "10.3.1")
  const match = articleRef.match(/[\d.]+/);
  return match ? match[0] : "";
}

/**
 * Generates all possible article reference patterns for a given article reference
 */
function generateArticlePatterns(articleRef: string, framework: "GDPR" | "AI_ACT" | "ISO_42001"): string[] {
  const patterns: string[] = [];
  const articleNum = extractArticleNumber(articleRef);
  
  if (!articleNum) return patterns;
  
  if (framework === "ISO_42001") {
    // ISO format: §8.2, Section 8.2, Clause 8.2, § 8.2, etc.
    patterns.push(
      `§${articleNum}`,
      `§ ${articleNum}`,
      `section ${articleNum}`,
      `clause ${articleNum}`,
      `iso 42001 ${articleNum}`,
      `iso42001 ${articleNum}`,
      `iso-42001 ${articleNum}`
    );
  } else {
    // GDPR/AI Act format: Art. 6, Article 6, Art 6, Art.6, etc.
    patterns.push(
      `art. ${articleNum}`,
      `art ${articleNum}`,
      `art.${articleNum}`,
      `article ${articleNum}`,
      `${framework.toLowerCase()} art. ${articleNum}`,
      `${framework.toLowerCase()} article ${articleNum}`
    );
  }
  
  return patterns;
}

/**
 * Checks if article reference is found in content, even when split across lines
 */
function matchArticleReference(articleRef: string, framework: "GDPR" | "AI_ACT" | "ISO_42001", content: string): boolean {
  const patterns = generateArticlePatterns(articleRef, framework);
  
  // Normalize content: replace newlines and multiple spaces with single space
  const normalizedContent = content.replace(/\s+/g, " ");
  
  for (const pattern of patterns) {
    // Use word boundary matching for article references
    // Allow for optional spaces around punctuation
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\s+/g, '\\s*') // Allow flexible spacing
      .replace(/§/g, '§?'); // Optional section symbol
    
    const regex = new RegExp(`\\b${regexPattern}\\b`, 'i');
    if (regex.test(normalizedContent)) {
      return true;
    }
    
    // Also try without word boundaries for cases like "Art.6" (no space)
    const loosePattern = pattern.replace(/\s+/g, '\\s*');
    const looseRegex = new RegExp(loosePattern, 'i');
    if (looseRegex.test(normalizedContent)) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Main Rule Checking Functions
// ============================================================================

function checkRules(rules: ComplianceRule[], content: string): boolean[] {
  return rules.map((rule) => checkRule(rule, content));
}

function checkRule(rule: ComplianceRule, content: string): boolean {
  // Normalize content: lowercase and normalize whitespace
  const normalizedContent = content.toLowerCase().replace(/\s+/g, " ");
  
  // Check keyword matches with enhanced matching
  const keywordMatch = rule.keywords.some((keyword) =>
    matchKeyword(keyword, normalizedContent)
  );
  
  // Check article reference matches with enhanced pattern matching
  const articleMatch = matchArticleReference(
    rule.article_ref,
    rule.framework,
    normalizedContent
  );
  
  return keywordMatch || articleMatch;
}

function calculateCoverage(
  matches: boolean[],
  rules: ComplianceRule[]
): number {
  if (rules.length === 0) return 0;
  const matchedCount = matches.filter((m) => m).length;
  return matchedCount / rules.length;
}

/**
 * Extract framework mappings from policy content
 * Enhanced to support multiple formats:
 * - (GDPR Art. 6), (GDPR Article 6), (GDPR Art 6), (GDPR Art.6)
 * - (AI Act Art. 9), (AI Act Article 9)
 * - (ISO 42001 §8.2), (ISO 42001 Section 8.2), (ISO 42001 Clause 8.2)
 * Also handles references split across lines
 */
export function extractMappings(policyContent: string): Array<{
  section_id: string;
  framework: "GDPR" | "AI_ACT" | "ISO_42001";
  article_ref: string;
}> {
  const mappings: Array<{
    section_id: string;
    framework: "GDPR" | "AI_ACT" | "ISO_42001";
    article_ref: string;
  }> = [];

  // Normalize content: replace newlines with spaces to handle split references
  const normalizedContent = policyContent.replace(/\s+/g, " ");
  
  // Enhanced patterns for different frameworks and formats
  // GDPR patterns: Art. 6, Article 6, Art 6, Art.6
  const gdprPattern = /\(GDPR\s+(?:Art\.|Article|Art)\s*([\d\.]+)[^)]*\)/gi;
  
  // AI Act patterns: Art. 9, Article 9, Art 9, Art.9
  const aiActPattern = /\(AI\s+Act\s+(?:Art\.|Article|Art)\s*([\d\.]+)[^)]*\)/gi;
  
  // ISO 42001 patterns: §8.2, Section 8.2, Clause 8.2
  const isoPatterns = [
    /\(ISO\s*42001\s+(?:§|Section|Clause)\s*([\d\.]+)[^)]*\)/gi,
    /\(ISO-42001\s+(?:§|Section|Clause)\s*([\d\.]+)[^)]*\)/gi,
  ];

  const lines = policyContent.split("\n");
  let currentSection = "";

  lines.forEach((line, index) => {
    // Track current section (H1, H2, H3)
    if (line.match(/^#+\s+/)) {
      currentSection = line.replace(/^#+\s+/, "").trim();
    }

    // Check GDPR patterns
    let match;
    gdprPattern.lastIndex = 0; // Reset regex
    while ((match = gdprPattern.exec(line)) !== null) {
      mappings.push({
        section_id: currentSection || `line-${index + 1}`,
        framework: "GDPR",
        article_ref: `Art. ${match[1].trim()}`,
      });
    }
    
    // Check AI Act patterns
    aiActPattern.lastIndex = 0; // Reset regex
    while ((match = aiActPattern.exec(line)) !== null) {
      mappings.push({
        section_id: currentSection || `line-${index + 1}`,
        framework: "AI_ACT",
        article_ref: `Art. ${match[1].trim()}`,
      });
    }
    
    // Check ISO patterns
    isoPatterns.forEach(pattern => {
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(line)) !== null) {
        mappings.push({
          section_id: currentSection || `line-${index + 1}`,
          framework: "ISO_42001",
          article_ref: `§${match[1].trim()}`,
        });
      }
    });
  });
  
  // Also check normalized content for references that might span lines
  // This is a fallback for cases where references are split
  const allPatterns = [
    { pattern: gdprPattern, framework: "GDPR" as const },
    { pattern: aiActPattern, framework: "AI_ACT" as const },
    ...isoPatterns.map(p => ({ pattern: p, framework: "ISO_42001" as const })),
  ];
  
  // Remove duplicates by checking if we already found this mapping
  const existingMappings = new Set(
    mappings.map(m => `${m.framework}:${m.article_ref}`)
  );
  
  allPatterns.forEach(({ pattern, framework }) => {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(normalizedContent)) !== null) {
      const articleRef = framework === "ISO_42001" 
        ? `§${match[1].trim()}`
        : `Art. ${match[1].trim()}`;
      const key = `${framework}:${articleRef}`;
      
      if (!existingMappings.has(key)) {
        mappings.push({
          section_id: "document",
          framework,
          article_ref: articleRef,
        });
        existingMappings.add(key);
      }
    }
  });

  return mappings;
}

