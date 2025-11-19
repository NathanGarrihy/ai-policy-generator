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
 * Uses context-aware matching for better accuracy
 */
function analyzeSectionCompliance(
  sectionContent: string,
  sectionName?: string
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

  // Prioritize rules based on section context (if section name provided)
  const prioritizedGdprRules = sectionName
    ? prioritizeRulesBySection(GDPR_RULES, sectionName)
    : GDPR_RULES;
  const prioritizedAiActRules = sectionName
    ? prioritizeRulesBySection(AI_ACT_RULES, sectionName)
    : AI_ACT_RULES;
  const prioritizedIsoRules = sectionName
    ? prioritizeRulesBySection(ISO_42001_RULES, sectionName)
    : ISO_42001_RULES;

  // Check GDPR rules with context-aware matching
  const gdprMatches = prioritizedGdprRules.map(
    (rule) => checkRuleWithContext(rule, contentLower, sectionName).matched
  );
  const gdprCoverage = calculateCoverage(gdprMatches, GDPR_RULES);

  // Check AI Act rules with context-aware matching
  const aiActMatches = prioritizedAiActRules.map(
    (rule) => checkRuleWithContext(rule, contentLower, sectionName).matched
  );
  const aiActCoverage = calculateCoverage(aiActMatches, AI_ACT_RULES);

  // Check ISO 42001 rules with context-aware matching
  const isoMatches = prioritizedIsoRules.map(
    (rule) => checkRuleWithContext(rule, contentLower, sectionName).matched
  );
  const isoCoverage = calculateCoverage(isoMatches, ISO_42001_RULES);

  // Find missing clauses (required ones that weren't found)
  // Use context-aware matching to reduce false positives
  const missingClauses = ALL_RULES.filter((rule) => {
    if (!rule.required) return false;
    const matched = checkRuleWithContext(
      rule,
      contentLower,
      sectionName
    ).matched;
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

  // Analyze each section with context-aware matching
  const sectionScores = sections.map((section) => ({
    section_name: section.name,
    ...analyzeSectionCompliance(section.content, section.name),
  }));

  // Calculate overall scores using context-aware matching (stricter validation)
  // Use checkRuleWithContext instead of simple checkRule for better accuracy
  const gdprMatches = GDPR_RULES.map((rule) =>
    checkRuleWithContext(rule, contentLower).matched
  );
  const gdprCoverage = calculateCoverage(gdprMatches, GDPR_RULES);

  const aiActMatches = AI_ACT_RULES.map((rule) =>
    checkRuleWithContext(rule, contentLower).matched
  );
  const aiActCoverage = calculateCoverage(aiActMatches, AI_ACT_RULES);

  const isoMatches = ISO_42001_RULES.map((rule) =>
    checkRuleWithContext(rule, contentLower).matched
  );
  const isoCoverage = calculateCoverage(isoMatches, ISO_42001_RULES);

  // Find missing clauses (required ones that weren't found)
  // Use context-aware matching for consistency with section-level analysis
  const missingClauses = ALL_RULES.filter((rule) => {
    if (!rule.required) return false;
    const matched = checkRuleWithContext(rule, contentLower).matched;
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
  individual: ["data subject", "user", "person", "individual"],
  user: ["data subject", "individual", "person", "user"],
  "personal data": [
    "personal information",
    "personal data",
    "pii",
    "personally identifiable information",
  ],
  processing: ["process", "processing", "handling", "managing"],
  consent: ["consent", "permission", "authorization", "agreement"],
  erasure: ["deletion", "erasure", "removal", "deleting"],
  rectification: ["correction", "rectification", "updating", "amending"],
  portability: ["portability", "export", "transfer", "migration"],
};

/**
 * Abbreviation mapping
 */
const ABBREVIATIONS: Record<string, string[]> = {
  dpo: ["data protection officer", "dpo", "privacy officer"],
  dpia: [
    "data protection impact assessment",
    "dpia",
    "privacy impact assessment",
    "pia",
  ],
  pii: [
    "personally identifiable information",
    "pii",
    "personal data",
    "personal information",
  ],
  ai: ["artificial intelligence", "ai", "machine learning", "ml"],
  gdpr: ["general data protection regulation", "gdpr", "regulation 2016/679"],
};

/**
 * Generates plural forms of a word
 */
function getPluralForms(word: string): string[] {
  const forms = [word];

  // Simple pluralization rules
  if (word.endsWith("y")) {
    forms.push(word.slice(0, -1) + "ies");
  } else if (
    word.endsWith("s") ||
    word.endsWith("x") ||
    word.endsWith("z") ||
    word.endsWith("ch") ||
    word.endsWith("sh")
  ) {
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
      synonyms.forEach((syn) => expanded.add(syn));
    }
  }

  // Add abbreviations
  for (const [abbr, expansions] of Object.entries(ABBREVIATIONS)) {
    if (keywordLower === abbr) {
      expansions.forEach((exp) => expanded.add(exp));
    }
    if (expansions.some((exp) => exp === keywordLower)) {
      expanded.add(abbr);
      expansions.forEach((exp) => expanded.add(exp));
    }
  }

  // Generate variations for each word in the keyword
  const words = keywordLower.split(/\s+/);
  words.forEach((word) => {
    // Add plural forms
    getPluralForms(word).forEach((form) => {
      expanded.add(form);
      // Also add with original context
      if (words.length > 1) {
        const contextWords = words.filter((w) => w !== word);
        expanded.add([...contextWords, form].join(" "));
        expanded.add([form, ...contextWords].join(" "));
      }
    });

    // Add verb forms
    getVerbForms(word).forEach((form) => {
      expanded.add(form);
      if (words.length > 1) {
        const contextWords = words.filter((w) => w !== word);
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
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Common typo patterns: missing/extra characters, character swaps
  // For now, we'll use word boundary matching with case-insensitive flag
  // More sophisticated fuzzy matching can be added later
  return new RegExp(`\\b${escaped}\\b`, "gi");
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
    const exactPattern = new RegExp(
      `\\b${expandedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
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
function generateArticlePatterns(
  articleRef: string,
  framework: "GDPR" | "AI_ACT" | "ISO_42001"
): string[] {
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
function matchArticleReference(
  articleRef: string,
  framework: "GDPR" | "AI_ACT" | "ISO_42001",
  content: string
): boolean {
  const patterns = generateArticlePatterns(articleRef, framework);

  // Normalize content: replace newlines and multiple spaces with single space
  const normalizedContent = content.replace(/\s+/g, " ");

  for (const pattern of patterns) {
    // Use word boundary matching for article references
    // Allow for optional spaces around punctuation
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\s+/g, "\\s*") // Allow flexible spacing
      .replace(/§/g, "§?"); // Optional section symbol

    const regex = new RegExp(`\\b${regexPattern}\\b`, "i");
    if (regex.test(normalizedContent)) {
      return true;
    }

    // Also try without word boundaries for cases like "Art.6" (no space)
    const loosePattern = pattern.replace(/\s+/g, "\\s*");
    const looseRegex = new RegExp(loosePattern, "i");
    if (looseRegex.test(normalizedContent)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Context-Aware Matching Utilities
// ============================================================================

/**
 * Splits content into paragraphs (based on double newlines) or 100-word windows
 */
function splitIntoContextWindows(
  content: string,
  windowSize: number = 100
): string[] {
  // First try to split by paragraphs (double newlines)
  const paragraphs = content
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0);

  if (paragraphs.length > 0) {
    return paragraphs;
  }

  // Fallback: split into word-based windows
  const words = content.split(/\s+/);
  const windows: string[] = [];

  for (let i = 0; i < words.length; i += windowSize) {
    windows.push(words.slice(i, i + windowSize).join(" "));
  }

  return windows;
}

/**
 * Finds all positions where a keyword appears in content
 * Returns array of { keyword, position, windowIndex }
 */
function findKeywordPositions(
  keywords: string[],
  content: string,
  windows: string[]
): Array<{ keyword: string; position: number; windowIndex: number }> {
  const positions: Array<{
    keyword: string;
    position: number;
    windowIndex: number;
  }> = [];
  const normalizedContent = content.toLowerCase();

  for (let windowIndex = 0; windowIndex < windows.length; windowIndex++) {
    const window = windows[windowIndex].toLowerCase();
    let windowStart = 0;

    // Calculate the start position of this window in the full content
    for (let i = 0; i < windowIndex; i++) {
      windowStart += windows[i].length + 1; // +1 for separator
    }

    for (const keyword of keywords) {
      const expandedKeywords = expandKeyword(keyword);

      for (const expandedKeyword of expandedKeywords) {
        const pattern = new RegExp(
          `\\b${expandedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "gi"
        );
        let match;

        while ((match = pattern.exec(window)) !== null) {
          positions.push({
            keyword: expandedKeyword,
            position: windowStart + match.index,
            windowIndex,
          });
        }
      }
    }
  }

  return positions;
}

/**
 * Finds all positions where an article reference appears in content
 */
function findArticlePositions(
  articleRef: string,
  framework: "GDPR" | "AI_ACT" | "ISO_42001",
  content: string,
  windows: string[]
): Array<{ position: number; windowIndex: number }> {
  const positions: Array<{ position: number; windowIndex: number }> = [];
  const patterns = generateArticlePatterns(articleRef, framework);
  const normalizedContent = content.toLowerCase();

  for (let windowIndex = 0; windowIndex < windows.length; windowIndex++) {
    const window = windows[windowIndex].toLowerCase();
    let windowStart = 0;

    // Calculate the start position of this window in the full content
    for (let i = 0; i < windowIndex; i++) {
      windowStart += windows[i].length + 1;
    }

    for (const pattern of patterns) {
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\s+/g, "\\s*")
        .replace(/§/g, "§?");

      const regex = new RegExp(regexPattern, "gi");
      let match;

      while ((match = regex.exec(window)) !== null) {
        positions.push({
          position: windowStart + match.index,
          windowIndex,
        });
      }
    }
  }

  return positions;
}

/**
 * Checks if keywords and article references appear within the same context window
 * Returns a score from 0 to 1 based on proximity and co-occurrence
 * Requires both keywords AND article references for a match
 */
function checkProximity(
  keywordPositions: Array<{
    keyword: string;
    position: number;
    windowIndex: number;
  }>,
  articlePositions: Array<{ position: number; windowIndex: number }>,
  maxDistance: number = 100
): { matched: boolean; score: number } {
  if (keywordPositions.length === 0 && articlePositions.length === 0) {
    return { matched: false, score: 0 };
  }

  // Require BOTH keywords AND article references for a match
  // If we only have keywords but no article refs, it's NOT a match
  if (keywordPositions.length > 0 && articlePositions.length === 0) {
    return { matched: false, score: 0.2 }; // Low score but not a match
  }

  // If we only have article refs but no keywords, it's NOT a match
  // Article references alone don't indicate actual clause content
  if (articlePositions.length > 0 && keywordPositions.length === 0) {
    return { matched: false, score: 0.2 }; // Low score but not a match
  }

  // Check if any keyword and article ref appear in the same window
  let bestScore = 0;
  let foundMatch = false;

  for (const kwPos of keywordPositions) {
    for (const artPos of articlePositions) {
      // Same window = high score
      if (kwPos.windowIndex === artPos.windowIndex) {
        foundMatch = true;
        const distance = Math.abs(kwPos.position - artPos.position);
        // Score decreases with distance, but same window is always high
        const score =
          distance < maxDistance ? 1.0 - (distance / maxDistance) * 0.3 : 0.7;
        bestScore = Math.max(bestScore, score);
      }
    }
  }

  // Only match if we found keywords AND article refs in proximity
  return {
    matched: foundMatch,
    score: bestScore || 0,
  };
}

/**
 * Checks if multiple keywords appear in the same context window
 * Returns the number of unique keywords found in the same window
 */
function checkKeywordCoOccurrence(
  keywords: string[],
  content: string,
  windows: string[]
): { matchedKeywords: string[]; coOccurrenceScore: number } {
  const keywordPositions = findKeywordPositions(keywords, content, windows);

  // Group positions by window
  const keywordsByWindow = new Map<number, Set<string>>();

  for (const pos of keywordPositions) {
    if (!keywordsByWindow.has(pos.windowIndex)) {
      keywordsByWindow.set(pos.windowIndex, new Set());
    }
    keywordsByWindow.get(pos.windowIndex)!.add(pos.keyword);
  }

  // Find the window with the most keywords
  let maxKeywords = 0;
  let bestWindow = -1;

  for (const [windowIndex, keywordSet] of keywordsByWindow.entries()) {
    if (keywordSet.size > maxKeywords) {
      maxKeywords = keywordSet.size;
      bestWindow = windowIndex;
    }
  }

  const matchedKeywords =
    bestWindow >= 0 ? Array.from(keywordsByWindow.get(bestWindow)!) : [];

  // Score based on how many keywords co-occur (normalized by total keywords)
  const coOccurrenceScore =
    keywords.length > 0 ? maxKeywords / keywords.length : 0;

  return { matchedKeywords, coOccurrenceScore };
}

/**
 * Context-aware rule checking with proximity-based matching
 * Checks if keywords appear within same paragraph (or 100-word window)
 * Verifies article references appear near relevant keywords
 * Scores matches higher when keyword + article ref appear together
 */
function checkRuleWithContext(
  rule: ComplianceRule,
  content: string,
  sectionName?: string
): {
  matched: boolean;
  score: number;
  details: {
    proximityScore: number;
    coOccurrenceScore: number;
    contextScore: number;
  };
} {
  const normalizedContent = content.toLowerCase().replace(/\s+/g, " ");

  // Split content into context windows (paragraphs or 100-word chunks)
  const windows = splitIntoContextWindows(normalizedContent, 100);

  // Find keyword positions
  const keywordPositions = findKeywordPositions(
    rule.keywords,
    normalizedContent,
    windows
  );

  // Find article reference positions
  const articlePositions = findArticlePositions(
    rule.article_ref,
    rule.framework,
    normalizedContent,
    windows
  );

  // Check proximity between keywords and article references
  const proximityResult = checkProximity(
    keywordPositions,
    articlePositions,
    100
  );

  // Check keyword co-occurrence for semantic relationship detection
  const coOccurrenceResult = checkKeywordCoOccurrence(
    rule.keywords,
    normalizedContent,
    windows
  );

  // For complex rules (multiple keywords), require higher co-occurrence
  const isComplexRule = rule.keywords.length >= 3;
  const minCoOccurrenceThreshold = isComplexRule ? 0.6 : 0.4; // Increased thresholds

  // Calculate context score based on section name (if provided)
  let contextScore = 1.0;
  if (sectionName) {
    contextScore = calculateSectionContextScore(rule, sectionName);
  }

  // Combine scores: proximity, co-occurrence, and context
  const finalScore =
    proximityResult.score * 0.4 +
    coOccurrenceResult.coOccurrenceScore * 0.4 +
    contextScore * 0.2;

  // Multiple conditions for matching
  const hasArticleRefs = articlePositions.length > 0;
  const hasKeywords = keywordPositions.length > 0;
  const hasKeywordsWithCoOccurrence =
    coOccurrenceResult.coOccurrenceScore >= minCoOccurrenceThreshold;

  // Check for content length/substance
  // Ensure the content window containing matches has substantial content (not just mentions)
  let hasSubstantialContent = false;
  if (hasKeywords && hasArticleRefs) {
    // Find windows that contain both keywords and article refs
    const relevantWindows = windows.filter((_, idx) => {
      const hasKwInWindow = keywordPositions.some((pos) => pos.windowIndex === idx);
      const hasArtInWindow = articlePositions.some((pos) => pos.windowIndex === idx);
      return hasKwInWindow && hasArtInWindow;
    });
    
    // Check if any relevant window has substantial content (>100 words)
    hasSubstantialContent = relevantWindows.some(
      (window) => window.split(/\s+/).length > 100
    );
  }

  // For required rules, enforce stricter minimum keyword count
  const minKeywordCount = rule.required ? 2 : 1;
  const hasMinKeywords = 
    coOccurrenceResult.matchedKeywords.length >= minKeywordCount;

  // Match requires:
  // 1. BOTH keywords AND article refs in proximity, AND
  // 2. Co-occurrence threshold met (for keyword quality), AND
  // 3. Minimum keyword count met, AND
  // 4. Substantial content present (for required rules)
  // OR
  // 5. Very strong keyword presence (high co-occurrence >= 0.7) with multiple unique keywords
  const hasStrongKeywordPresence =
    hasKeywords &&
    coOccurrenceResult.coOccurrenceScore >= 0.7 &&
    coOccurrenceResult.matchedKeywords.length >= Math.max(3, Math.ceil(rule.keywords.length * 0.6));

  const hasFullMatch =
    proximityResult.matched &&
    hasKeywords &&
    hasArticleRefs &&
    hasKeywordsWithCoOccurrence &&
    hasMinKeywords &&
    (!rule.required || hasSubstantialContent);

  const matched = hasFullMatch || hasStrongKeywordPresence;

  return {
    matched,
    score: finalScore,
    details: {
      proximityScore: proximityResult.score,
      coOccurrenceScore: coOccurrenceResult.coOccurrenceScore,
      contextScore,
    },
  };
}

/**
 * Calculates how semantically related a rule is to a section heading
 * Returns a score from 0 to 1, where 1 means highly related
 */
function calculateSectionContextScore(
  rule: ComplianceRule,
  sectionName: string
): number {
  const sectionLower = sectionName.toLowerCase();
  const clauseLower = rule.clause_text.toLowerCase();

  // Extract key terms from section name and clause text
  const sectionTerms = sectionLower
    .split(/\s+/)
    .filter((term) => term.length > 3);
  const clauseTerms = clauseLower
    .split(/\s+/)
    .filter((term) => term.length > 3);

  // Check for semantic relationships
  const semanticMappings: Record<string, string[]> = {
    cookie: ["consent", "tracking", "storage"],
    "data collection": [
      "processing",
      "personal data",
      "lawful basis",
      "consent",
    ],
    "data processing": [
      "lawful basis",
      "processing",
      "personal data",
      "legal basis",
    ],
    privacy: ["data protection", "personal data", "rights", "gdpr"],
    rights: [
      "data subject",
      "access",
      "erasure",
      "rectification",
      "portability",
    ],
    security: ["data protection", "security measures", "breach", "encryption"],
    breach: ["data breach", "notification", "incident", "security"],
    ai: [
      "artificial intelligence",
      "machine learning",
      "ai system",
      "algorithm",
    ],
    risk: ["risk management", "risk assessment", "high-risk", "mitigation"],
    transparency: [
      "information",
      "disclosure",
      "explainability",
      "documentation",
    ],
  };

  // Check if section terms match semantic mappings
  let matchScore = 0;
  let matchCount = 0;

  for (const sectionTerm of sectionTerms) {
    for (const [key, relatedTerms] of Object.entries(semanticMappings)) {
      if (sectionTerm.includes(key) || key.includes(sectionTerm)) {
        // Check if rule keywords or clause text contain related terms
        const ruleText = (
          rule.keywords.join(" ") +
          " " +
          clauseLower
        ).toLowerCase();
        for (const relatedTerm of relatedTerms) {
          if (ruleText.includes(relatedTerm)) {
            matchScore += 1.0;
            matchCount++;
            break;
          }
        }
      }
    }

    // Direct keyword match in section name
    for (const keyword of rule.keywords) {
      if (
        sectionLower.includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(sectionTerm)
      ) {
        matchScore += 0.8;
        matchCount++;
      }
    }
  }

  // Normalize score (max 1.0)
  return matchCount > 0 ? Math.min(1.0, matchScore / matchCount) : 0.5;
}

/**
 * Filters and prioritizes rules based on section context
 * Rules semantically related to the section topic are prioritized
 */
function prioritizeRulesBySection(
  rules: ComplianceRule[],
  sectionName: string
): ComplianceRule[] {
  // Calculate context scores for all rules
  const rulesWithScores = rules.map((rule) => ({
    rule,
    contextScore: calculateSectionContextScore(rule, sectionName),
  }));

  // Sort by context score (highest first)
  rulesWithScores.sort((a, b) => b.contextScore - a.contextScore);

  return rulesWithScores.map((item) => item.rule);
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
  const matchedKeywords = rule.keywords.filter((keyword) =>
    matchKeyword(keyword, normalizedContent)
  );
  const keywordMatch = matchedKeywords.length > 0;

  // Check article reference matches with enhanced pattern matching
  const articleMatch = matchArticleReference(
    rule.article_ref,
    rule.framework,
    normalizedContent
  );

  // Require BOTH keywords AND article references
  // OR require very strong keyword presence (multiple keywords with high co-occurrence)
  if (!keywordMatch && !articleMatch) {
    return false;
  }

  // If we have both keywords and article refs, validate they're contextually related
  if (keywordMatch && articleMatch) {
    // For required rules, ensure we have substantial content (not just isolated mentions)
    if (rule.required) {
      // Extract context around article references (100 chars before and after)
      const articlePatterns = generateArticlePatterns(
        rule.article_ref,
        rule.framework
      );
      let hasContextualContent = false;

      for (const pattern of articlePatterns) {
        const regexPattern = pattern
          .replace(/\./g, "\\.")
          .replace(/\s+/g, "\\s*")
          .replace(/§/g, "§?");
        const regex = new RegExp(`.{0,100}${regexPattern}.{0,100}`, "gi");
        const matches = normalizedContent.match(regex);

        if (matches) {
          // Check if any match contains keywords (not just article ref)
          hasContextualContent = matches.some((match) =>
            matchedKeywords.some((kw) =>
              match.toLowerCase().includes(kw.toLowerCase())
            )
          );
          if (hasContextualContent) break;
        }
      }

      // Require article refs to appear near keywords for required rules
      if (!hasContextualContent) {
        // Fall through to keyword-only validation
        return (
          matchedKeywords.length >=
          Math.max(3, Math.ceil(rule.keywords.length * 0.6))
        );
      }
    }
    return true;
  }

  // For stronger keyword matching without article refs
  // Require multiple keywords AND substantial content
  if (keywordMatch && !articleMatch) {
    // Different thresholds for required vs optional rules
    const minKeywords = rule.required ? 3 : 2;
    const percentageThreshold = rule.required ? 0.6 : 0.5;
    const keywordThreshold = Math.max(
      minKeywords,
      Math.ceil(rule.keywords.length * percentageThreshold)
    );

    if (matchedKeywords.length < keywordThreshold) {
      return false;
    }

    // Verify keywords aren't just isolated mentions
    // Check for keyword density - matched keywords should appear in proximity
    const windows = splitIntoContextWindows(normalizedContent, 150);
    let maxKeywordsInWindow = 0;

    for (const window of windows) {
      const keywordsInWindow = matchedKeywords.filter((kw) =>
        window.toLowerCase().includes(kw.toLowerCase())
      ).length;
      maxKeywordsInWindow = Math.max(maxKeywordsInWindow, keywordsInWindow);
    }

    // Require at least 50% of matched keywords to appear in same context window
    const densityThreshold = Math.ceil(matchedKeywords.length * 0.5);
    return maxKeywordsInWindow >= densityThreshold;
  }

  // Article refs alone are NOT sufficient
  // Only allow if we find substantial clause content
  if (articleMatch && !keywordMatch) {
    // Check if clause text keywords appear (even if not in the main keywords list)
    const clauseTextLower = rule.clause_text.toLowerCase();
    const clauseKeywords = clauseTextLower
      .split(/\s+/)
      .filter((word) => word.length > 4); // Filter out short words

    // Require at least 2 clause keywords for required rules, 1 for optional
    const minClauseKeywords = rule.required ? 2 : 1;
    const clauseKeywordMatches = clauseKeywords.filter((word) =>
      normalizedContent.includes(word)
    );

    return clauseKeywordMatches.length >= minClauseKeywords;
  }

  return false;
}

/**
 * Context-aware rule checking (uses proximity and semantic analysis)
 * This is the enhanced version that should be used for better accuracy
 */
function checkRuleWithContextOnly(
  rule: ComplianceRule,
  content: string,
  sectionName?: string
): boolean {
  const result = checkRuleWithContext(rule, content, sectionName);
  return result.matched;
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
  const aiActPattern =
    /\(AI\s+Act\s+(?:Art\.|Article|Art)\s*([\d\.]+)[^)]*\)/gi;

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
    isoPatterns.forEach((pattern) => {
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
    ...isoPatterns.map((p) => ({
      pattern: p,
      framework: "ISO_42001" as const,
    })),
  ];

  // Remove duplicates by checking if we already found this mapping
  const existingMappings = new Set(
    mappings.map((m) => `${m.framework}:${m.article_ref}`)
  );

  allPatterns.forEach(({ pattern, framework }) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(normalizedContent)) !== null) {
      const articleRef =
        framework === "ISO_42001"
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
