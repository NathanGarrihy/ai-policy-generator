// lib/parser.ts
import type { RuleApplicability } from "./types";
import { GENERATION_CONFIG } from "./constants";

/**
 * Parser for structured policy output from OpenAI
 * Extracts POLICY-MARKDOWN and METAJSON blocks from the response
 */

export type PolicyMetadata = {
  policy_type?: string;
  placeholders_present?: boolean;
  jurisdictions?: string[];
  frameworks_selected?: string[];
  coverage?: {
    gdpr?: number;
    ai_act?: number;
    iso_42001?: number;
  };
  sections?: Array<{
    id: string;
    title: string;
    framework_refs: string[];
  }>;
};

export type ParsedPolicy = {
  content: string;
  metadata: PolicyMetadata | null;
  hasStructure: boolean;
};

/**
 * Parse structured policy output from OpenAI
 * Extracts POLICY-MARKDOWN block and optionally METAJSON block
 */
export function parsePolicyOutput(rawContent: string): ParsedPolicy {
  if (!rawContent || typeof rawContent !== "string") {
    return {
      content: "",
      metadata: null,
      hasStructure: false,
    };
  }

  // Use regex to find blocks more flexibly (handle variations in dashes/spacing)
  // Pattern: -----BEGIN POLICY-MARKDOWN----- (with optional whitespace)
  const markdownBlockRegex =
    /-{3,}\s*BEGIN\s+POLICY-MARKDOWN\s*-{3,}([\s\S]*?)-{3,}\s*END\s+POLICY-MARKDOWN\s*-{3,}/i;
  const metajsonBlockRegex =
    /-{3,}\s*BEGIN\s+POLICY-METAJSON\s*-{3,}([\s\S]*?)-{3,}\s*END\s+POLICY-METAJSON\s*-{3,}/i;

  const markdownMatch = rawContent.match(markdownBlockRegex);
  const metajsonMatch = rawContent.match(metajsonBlockRegex);

  // Check if structured format is present
  if (markdownMatch && markdownMatch[1]) {
    // Extract POLICY-MARKDOWN block
    const markdownContent = markdownMatch[1].trim();

    // Extract METAJSON block if present
    let metadata: PolicyMetadata | null = null;
    if (metajsonMatch && metajsonMatch[1]) {
      try {
        const metajsonContent = metajsonMatch[1].trim();
        // Try to parse JSON - might be wrapped in code blocks or have extra text
        // Remove markdown code blocks if present
        const cleanedJson = metajsonContent
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "")
          .trim();
        metadata = JSON.parse(cleanedJson) as PolicyMetadata;
      } catch (e) {
        console.warn("Failed to parse METAJSON block:", e);
        // Continue without metadata
      }
    }

    return {
      content: markdownContent,
      metadata,
      hasStructure: true,
    };
  }

  // Fallback: intelligent parsing when structured format not detected
  // Attempt to extract content more intelligently:
  // 1. Look for markdown headings as section boundaries
  // 2. Detect if JSON block exists anywhere (for METAJSON)
  // 3. Validate partial structure and repair if possible
  
  let fallbackContent = rawContent.trim();
  let fallbackMetadata: PolicyMetadata | null = null;
  let hasPartialStructure = false;
  const fallbackErrors: string[] = [];
  const fallbackWarnings: string[] = [];

  try {
    // Try to find JSON block anywhere in the content (might be outside delimiters)
    // Look for JSON objects that might be METAJSON
    const jsonPatterns = [
      // Look for JSON wrapped in code blocks
      /```json\s*([\s\S]*?)\s*```/i,
      /```\s*({[\s\S]*?"policy_type"[\s\S]*?})\s*```/i,
      // Look for standalone JSON objects with policy_type field
      /\{[\s\S]*?"policy_type"[\s\S]*?\}/i,
    ];

    for (const pattern of jsonPatterns) {
      try {
        const jsonMatch = rawContent.match(pattern);
        if (jsonMatch) {
          try {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const cleanedJson = jsonStr
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/, "")
              .replace(/\s*```$/, "")
              .trim();
            
            if (!cleanedJson || cleanedJson.length === 0) {
              fallbackWarnings.push("Empty JSON string found in pattern match");
              continue;
            }
            
            const parsed = JSON.parse(cleanedJson) as PolicyMetadata;
            
            // Validate it looks like our metadata structure
            if (parsed.policy_type || parsed.frameworks_selected || parsed.sections) {
              fallbackMetadata = parsed;
              hasPartialStructure = true;
              break;
            } else {
              fallbackWarnings.push("JSON found but doesn't match expected metadata structure");
            }
          } catch (parseError: any) {
            // JSON parse error - log but continue trying other patterns
            fallbackWarnings.push(`Failed to parse JSON from pattern: ${parseError.message || String(parseError)}`);
            continue;
          }
        }
      } catch (patternError: any) {
        // Pattern matching error - log but continue
        fallbackWarnings.push(`Error matching JSON pattern: ${patternError.message || String(patternError)}`);
        continue;
      }
    }

    // Try to extract policy content by looking for markdown structure
    // If content starts with markdown headings, it's likely the policy content
    let lines: string[] = [];
    try {
      lines = fallbackContent.split("\n");
    } catch (splitError: any) {
      fallbackErrors.push(`Failed to split content into lines: ${splitError.message || String(splitError)}`);
      // Return minimal fallback result
      return {
        content: fallbackContent,
        metadata: null,
        hasStructure: false,
      };
    }
    
    const firstHeadingIndex = lines.findIndex((line) => {
      try {
        return line.match(/^#{1,3}\s+/) !== null;
      } catch {
        return false;
      }
    });
    
    if (firstHeadingIndex >= 0) {
      // Content appears to start with a heading - likely valid policy content
      // Remove any leading non-markdown content before first heading
      if (firstHeadingIndex > 0) {
        try {
          // Check if content before first heading looks like instructions or metadata
          const preHeading = lines.slice(0, firstHeadingIndex).join("\n").toLowerCase();
          const looksLikeInstructions = 
            preHeading.includes("generate") ||
            preHeading.includes("policy") ||
            preHeading.includes("coverage targets") ||
            preHeading.includes("company details");
          
          if (looksLikeInstructions) {
            // Skip instruction-like content before first heading
            fallbackContent = lines.slice(firstHeadingIndex).join("\n").trim();
            hasPartialStructure = true;
          }
        } catch (extractionError: any) {
          fallbackWarnings.push(`Error extracting content before heading: ${extractionError.message || String(extractionError)}`);
        }
      }
    }

    // Remove any standalone delimiter lines that might be in the content
    try {
      fallbackContent = fallbackContent
        .replace(/-{3,}\s*(BEGIN|END)\s+POLICY-(MARKDOWN|METAJSON)\s*-{3,}/gi, "")
        .trim();
    } catch (replaceError: any) {
      fallbackWarnings.push(`Error removing delimiter lines: ${replaceError.message || String(replaceError)}`);
    }

    // Try to detect if content has partial structure indicators
    // Check for markdown headings and framework references
    let hasMarkdownHeadings = false;
    let hasFrameworkRefs = false;
    
    try {
      // Test for markdown headings (1-6 # symbols followed by space at start of line)
      hasMarkdownHeadings = /^#{1,6}\s+/m.test(fallbackContent);
    } catch (headingTestError: any) {
      fallbackWarnings.push(`Error testing markdown headings: ${headingTestError.message || String(headingTestError)}`);
    }
    
    try {
      hasFrameworkRefs = /(?:GDPR\s+Art\.|AI\s+Act\s+Art\.|ISO\s+42001\s+§)/i.test(fallbackContent);
    } catch (refTestError: any) {
      fallbackWarnings.push(`Error testing framework references: ${refTestError.message || String(refTestError)}`);
    }
    
    // Treat content with headings as structured enough, even if framework refs
    // are missing (e.g., drafts that only include section scaffolding).
    if (hasMarkdownHeadings || hasFrameworkRefs) {
      hasPartialStructure = true;
    }

    // Validate final content before returning
    if (!fallbackContent || fallbackContent.length === 0) {
      fallbackErrors.push("Fallback parsing resulted in empty content");
      return {
        content: rawContent, // Return original as last resort
        metadata: fallbackMetadata,
        hasStructure: false,
      };
    }

    // Log warnings if any occurred (but don't fail)
    if (fallbackWarnings.length > 0) {
      console.warn("[Parser] Fallback parsing warnings:", fallbackWarnings);
    }

    // Log errors if any occurred
    if (fallbackErrors.length > 0) {
      console.error("[Parser] Fallback parsing errors:", fallbackErrors);
    }

    return {
      content: fallbackContent,
      metadata: fallbackMetadata,
      hasStructure: hasPartialStructure,
    };
  } catch (fallbackError: any) {
    // Catch-all for any unexpected errors in fallback logic
    console.error("[Parser] Unexpected error in fallback parsing:", {
      error: fallbackError.message || String(fallbackError),
      stack: fallbackError.stack,
    });
    
    // Return original content as last resort
    return {
      content: rawContent,
      metadata: null,
      hasStructure: false,
    };
  }
}

/**
 * Extract mappings from METAJSON metadata
 * Converts metadata sections to the mapping format used by the database
 */
export function extractMappingsFromMetadata(
  metadata: PolicyMetadata | null
): Array<{
  section_id: string;
  framework: "GDPR" | "AI_ACT" | "ISO_42001";
  article_ref: string;
}> {
  if (!metadata?.sections) {
    return [];
  }

  const mappings: Array<{
    section_id: string;
    framework: "GDPR" | "AI_ACT" | "ISO_42001";
    article_ref: string;
  }> = [];

  metadata.sections.forEach((section) => {
    section.framework_refs.forEach((ref) => {
      // Parse framework reference like "GDPR Art. 13" or "ISO 42001 §8.2"
      const gdprMatch = ref.match(/^GDPR\s+Art\.\s*(\d+(?:\.\d+)?)/i);
      const aiActMatch = ref.match(/^AI\s+Act\s+Art\.\s*(\d+(?:\.\d+)?)/i);
      const isoMatch = ref.match(/^ISO\s+42001\s+§(\d+(?:\.\d+)?)/i);

      if (gdprMatch) {
        mappings.push({
          section_id: section.id || section.title,
          framework: "GDPR",
          article_ref: `Art. ${gdprMatch[1]}`,
        });
      } else if (aiActMatch) {
        mappings.push({
          section_id: section.id || section.title,
          framework: "AI_ACT",
          article_ref: `Art. ${aiActMatch[1]}`,
        });
      } else if (isoMatch) {
        mappings.push({
          section_id: section.id || section.title,
          framework: "ISO_42001",
          article_ref: `§${isoMatch[1]}`,
        });
      }
    });
  });

  return mappings;
}

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  /**
   * Section-level structure information, optionally enriched with
   * applicability-aware mandatory/optional distinctions.
   */
  mandatorySections?: string[];
  optionalSections?: string[];
  missingMandatorySections?: string[];
  missingOptionalSections?: string[];
};

export type RequiredSections = {
  privacy_policy: string[];
  ai_usage_policy: string[];
  ai_governance_policy: string[];
};

/**
 * Required sections for each policy type
 * Based on the prompts in lib/prompts.ts
 */
export const REQUIRED_SECTIONS: RequiredSections = {
  privacy_policy: [
    "Introduction & Scope",
    "Data Collection Categories & Purposes",
    "Cookies and Similar Technologies",
    "Third-Party Sharing/Disclosure",
    "Data Rights & Transparency",
    "Data Retention & Deletion",
    "Security Measures",
    "Contact Information",
    "Mapping Appendix",
  ],
  ai_usage_policy: [
    "Scope and Purpose of AI Usage",
    "AI Use Cases and Applications",
    "Data Handling and Privacy Considerations",
    "Human Oversight Procedures",
    "Risk Management and Classification",
    "Model Governance and Retraining Procedures",
    "Responsibilities and Accountability",
    "Contact Information",
    "Mapping Appendix",
  ],
  ai_governance_policy: [
    "Governance Framework and Organizational Structure",
    "Responsible AI Principles",
    "Documentation and Review Procedures",
    "Training and Awareness Programs",
    "Incident Reporting and Response Procedures",
    "Monitoring and Continuous Improvement",
    "Compliance and Audit Procedures",
    "Contact Information",
    "Mapping Appendix",
  ],
};

/**
 * Derive which sections are mandatory vs optional for a given policy type
 * and applicability context.
 *
 * For now, all template sections remain mandatory. This keeps behaviour
 * backward compatible while giving us a single place to evolve the
 * logic as questionnaires and rule mappings become richer.
 */
export type ContextualSectionRequirements = {
  mandatory: string[];
  optional: string[];
};

export function getRequiredSectionsForContext(
  policyType: "privacy_policy" | "ai_usage_policy" | "ai_governance_policy",
  _applicabilityContext?: RuleApplicability
): ContextualSectionRequirements {
  const baseRequired = REQUIRED_SECTIONS[policyType] ?? [];

  // MVP: treat all template sections as mandatory. When we have
  // tighter rule-to-section mappings, this helper will decide which
  // sections are optional for a given applicability context.
  return {
    mandatory: baseRequired,
    optional: [],
  };
}

/**
 * Check if mapping appendix exists in policy content
 */
export function validateMappingAppendix(content: string): boolean {
  const contentLower = content.toLowerCase();

  // Check for various forms of "Mapping Appendix" heading
  // Support markdown headings (#, ##, ###), bold headings (**), and plain text
  const mappingAppendixPatterns = [
    // Markdown headings: # Mapping Appendix, ## Mapping Appendix, etc.
    /^#{1,3}\s+mapping\s+appendix/im,
    /^#{1,3}\s+framework\s+mapping/im,
    /^#{1,3}\s+compliance\s+mapping/im,
    /^#{1,3}\s+appendix\s*:?\s*mapping/im,
    // Bold headings: **Mapping Appendix**
    /\*\*mapping\s+appendix\*\*/i,
    /\*\*framework\s+mapping\*\*/i,
    /\*\*compliance\s+mapping\*\*/i,
    // Variations: "Appendix: Framework Mapping", "Framework Mappings", etc.
    /appendix\s*:?\s*(framework\s+)?mapping/i,
    /framework\s+mappings/i,
    // Plain text variations (non-heading formats)
    /mapping\s+appendix/i,
    /framework\s+mapping/i,
  ];

  // Check if any pattern matches
  const hasMappingAppendix = mappingAppendixPatterns.some((pattern) => {
    // Check in headings (lines starting with #) and bold headings (**)
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Check markdown headings
      if (trimmedLine.match(/^#{1,3}\s+/) && pattern.test(trimmedLine)) {
        return true;
      }
      // Check bold headings
      if (trimmedLine.match(/^\*\*/) && pattern.test(trimmedLine)) {
        return true;
      }
      // Check plain text (for non-heading formats)
      if (pattern.test(trimmedLine)) {
        return true;
      }
    }
    return false;
  });

  // Also check if there's a table or list that might be a mapping appendix
  // Look for patterns like "Section | Framework | Article"
  const hasMappingTable =
    /(section|framework|article|gdpr|ai act|iso\s+42001).*(\||-|:)/im.test(
      contentLower
    );

  // Check if there are framework references grouped together (indicating mapping)
  // More lenient: look for framework refs within reasonable proximity (500 chars)
  const frameworkRefsPattern =
    /(?:GDPR\s+Art\.|AI\s+Act\s+Art\.|ISO\s+42001\s+§).{0,500}(?:GDPR\s+Art\.|AI\s+Act\s+Art\.|ISO\s+42001\s+§)/im;
  const hasGroupedRefs = frameworkRefsPattern.test(content);

  // Additional check: look for mapping appendix content structure
  // Check if "Mapping Appendix" text appears near framework references
  // This handles cases where the section exists but isn't detected as a heading
  const hasMappingTextNearRefs = /mapping\s+appendix.{0,300}(?:GDPR\s+Art\.|AI\s+Act\s+Art\.|ISO\s+42001\s+§)/im.test(content) ||
    /(?:GDPR\s+Art\.|AI\s+Act\s+Art\.|ISO\s+42001\s+§).{0,300}mapping\s+appendix/im.test(content);

  return hasMappingAppendix || (hasMappingTable && hasGroupedRefs) || hasMappingTextNearRefs;
}

/**
 * Extract section headings from policy content
 */
export function extractSections(content: string): string[] {
  const sections: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match markdown headings (H1, H2, H3)
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      const heading = headingMatch[1].trim();
      // Skip very generic headings that aren't actual sections
      if (
        !heading.match(
          /^(table of contents|toc|last updated|policy|document)$/i
        )
      ) {
        sections.push(heading);
      }
    }
  }

  return sections;
}

/**
 * Validate policy structure against required sections
 */
export function validatePolicyStructure(
  content: string,
  policyType: "privacy_policy" | "ai_usage_policy" | "ai_governance_policy",
  metadata: PolicyMetadata | null,
  options?: {
    applicabilityContext?: RuleApplicability;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingMandatorySections: string[] = [];
  const missingOptionalSections: string[] = [];
  let mandatorySections: string[] = [];
  let optionalSections: string[] = [];

  // Get baseline required sections for this policy type
  const baseRequiredSections = REQUIRED_SECTIONS[policyType];
  if (!baseRequiredSections) {
    errors.push(`Unknown policy type: ${policyType}`);
    return {
      isValid: false,
      errors,
      warnings,
      mandatorySections: [],
      optionalSections: [],
      missingMandatorySections: [],
      missingOptionalSections: [],
    };
  }

  // Derive contextual mandatory/optional sections (currently all mandatory)
  const sectionRequirements = getRequiredSectionsForContext(
    policyType,
    options?.applicabilityContext
  );
  mandatorySections = sectionRequirements.mandatory;
  optionalSections = sectionRequirements.optional;

  // Extract sections from content
  const foundSections = extractSections(content);
  const foundSectionsLower = foundSections.map((s) => s.toLowerCase());

  // Helper to test if a given section label exists (with fuzzy match)
  const hasSection = (label: string): boolean => {
    const requiredLower = label.toLowerCase();

    // Try exact match first
    let found = foundSectionsLower.some((found) => found === requiredLower);

    // If not found, try fuzzy match (contains key words)
    if (!found) {
      const requiredWords = requiredLower
        .split(/\s+/)
        .filter((w) => w.length > 3);
      found = foundSectionsLower.some((foundSection) => {
        return requiredWords.every((word) => foundSection.includes(word));
      });
    }

    return found;
  };

  // Check for mandatory/optional sections (fuzzy matching)
  for (const required of mandatorySections) {
    if (!hasSection(required)) {
      missingMandatorySections.push(required);
    }
  }

  for (const optional of optionalSections) {
    if (!hasSection(optional)) {
      missingOptionalSections.push(optional);
    }
  }

  // Check for mapping appendix
  const hasMappingAppendix = validateMappingAppendix(content);
  if (!hasMappingAppendix) {
    errors.push("Mapping Appendix not found in policy content");
  }

  // Validate metadata if available
  if (metadata) {
    // Check if metadata has sections
    if (!metadata.sections || metadata.sections.length === 0) {
      warnings.push("METAJSON has no sections defined");
    } else {
      // Check if metadata sections match found sections
      const metadataSectionTitles = metadata.sections.map((s) =>
        s.title.toLowerCase()
      );
      const matchCount = foundSectionsLower.filter((found) =>
        metadataSectionTitles.some(
          (meta) => meta.includes(found) || found.includes(meta)
        )
      ).length;

      // Check if at least 50% of sections match
      const MATCH_RATE_THRESHOLD = 0.5;
      if (matchCount < foundSections.length * MATCH_RATE_THRESHOLD) {
        warnings.push(
          "METAJSON sections don't match content sections well (low match rate)"
        );
      }
    }

    // Check if policy_type matches
    const expectedType = policyType.replace("_policy", "");
    if (metadata.policy_type && metadata.policy_type !== expectedType) {
      warnings.push(
        `METAJSON policy_type (${metadata.policy_type}) doesn't match expected type (${expectedType})`
      );
    }
  } else {
    warnings.push("No METAJSON metadata available for validation");
  }

  // Add missing sections to errors / warnings
  if (
    missingMandatorySections.length > 0 ||
    missingOptionalSections.length > 0
  ) {
    // Mapping Appendix is critical, others are downgraded to warnings
    const criticalMissing = missingMandatorySections.filter((s) =>
      s.toLowerCase().includes("mapping appendix")
    );
    const otherMandatoryMissing = missingMandatorySections.filter(
      (s) => !s.toLowerCase().includes("mapping appendix")
    );

    if (criticalMissing.length > 0) {
      errors.push(`Missing critical sections: ${criticalMissing.join(", ")}`);
    }

    if (otherMandatoryMissing.length > 0) {
      warnings.push(
        `Missing mandatory sections: ${otherMandatoryMissing.join(", ")}`
      );
    }

    if (missingOptionalSections.length > 0) {
      warnings.push(
        `Missing optional sections: ${missingOptionalSections.join(", ")}`
      );
    }
  }

  // Check for placeholder handling
  const placeholders = detectPlaceholders(content);
  const hasPlaceholders = placeholders.length > 0;

  if (hasPlaceholders) {
    // Verify METAJSON placeholders_present field matches actual detection
    if (metadata) {
      if (!metadata.placeholders_present) {
        warnings.push(
          "Content contains placeholders but METAJSON indicates none"
        );
      }
    } else {
      warnings.push(
        "Content contains placeholders but no METAJSON metadata available to verify"
      );
    }

    // Add placeholder details to warnings
    const placeholderCount = placeholders.length;
    const placeholderTypes = new Set(placeholders.map((p) => p.type));
    warnings.push(
      `Policy contains ${placeholderCount} placeholder(s) requiring action: ${Array.from(placeholderTypes).join(", ")}`
    );

    // List specific placeholders (limit to avoid overwhelming the UI)
    const placeholderList = placeholders
      .slice(0, GENERATION_CONFIG.MAX_MISSING_CLAUSES)
      .map((p) => `[${p.type}]: ${p.text}`)
      .join("; ");
    if (placeholderList) {
      const maxPlaceholders = GENERATION_CONFIG.MAX_MISSING_CLAUSES;
      warnings.push(`Placeholders found: ${placeholderList}${placeholders.length > maxPlaceholders ? "..." : ""}`);
    }
  } else if (metadata && metadata.placeholders_present) {
    warnings.push(
      "METAJSON indicates placeholders are present but none were detected in content"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    mandatorySections,
    optionalSections,
    missingMandatorySections,
    missingOptionalSections,
  };
}

/**
 * Replace date placeholders and outdated dates with current date
 * Handles:
 * - [current date in YYYY-MM-DD format] placeholder
 * - Hardcoded dates from 2022 or earlier
 * - Other date placeholders
 */
export function replaceDatePlaceholders(content: string): string {
  if (!content || typeof content !== "string") {
    return content;
  }

  // Get current date in YYYY-MM-DD format
  const now = new Date();
  const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD format

  let replaced = content;

  // Replace placeholder text patterns
  const placeholderPatterns = [
    /\[current\s+date\s+in\s+YYYY-MM-DD\s+format\]/gi,
    /\[current\s+date\]/gi,
    /current\s+date\s+in\s+YYYY-MM-DD\s+format/gi,
  ];

  for (const pattern of placeholderPatterns) {
    replaced = replaced.replace(pattern, currentDate);
  }

  // Replace "Last updated: [placeholder]" patterns
  replaced = replaced.replace(
    /Last\s+updated\s*:?\s*\[current\s+date[^\]]*\]/gi,
    `Last updated: ${currentDate}`
  );

  // Replace outdated dates (2022 or earlier) in "Last updated" footer
  // Match "Last updated: YYYY-MM-DD" where YYYY <= 2022
  replaced = replaced.replace(
    /(Last\s+updated\s*:?\s*)(20[0-2][0-9]-\d{2}-\d{2})/gi,
    (match, prefix, date) => {
      const year = parseInt(date.split("-")[0], 10);
      if (year <= 2022) {
        return `${prefix}${currentDate}`;
      }
      return match;
    }
  );

  // Also replace standalone dates from 2022 or earlier that appear to be "last updated" dates
  // This catches cases where the format might be slightly different
  replaced = replaced.replace(
    /(Last\s+updated\s*:?\s*)(\d{4}-\d{2}-\d{2})/gi,
    (match, prefix, date) => {
      const year = parseInt(date.split("-")[0], 10);
      if (year <= 2022) {
        return `${prefix}${currentDate}`;
      }
      return match;
    }
  );

  return replaced;
}

export type DateValidationResult = {
  isValid: boolean;
  hasDate: boolean;
  isPlaceholder: boolean;
  isOutdated: boolean;
  date?: string;
  errors: string[];
  warnings: string[];
};

export type PlaceholderInfo = {
  type: string;
  text: string;
  fullMatch: string;
};

/**
 * Detect and categorize [Action Required: ...] placeholders in policy content
 */
export function detectPlaceholders(content: string): PlaceholderInfo[] {
  if (!content || typeof content !== "string") {
    return [];
  }

  const placeholders: PlaceholderInfo[] = [];
  const placeholderPattern = /\[Action\s+Required:\s*([^\]]+)\]/gi;

  let match;
  while ((match = placeholderPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const placeholderText = match[1].trim();

    // Categorize placeholder based on text content
    let type = "general";
    const textLower = placeholderText.toLowerCase();

    if (
      textLower.includes("contact") ||
      textLower.includes("email") ||
      textLower.includes("dpo") ||
      textLower.includes("responsible person") ||
      textLower.includes("governance owner")
    ) {
      type = "contact";
    } else if (
      textLower.includes("date") ||
      textLower.includes("updated")
    ) {
      type = "date";
    } else if (
      textLower.includes("procedure") ||
      textLower.includes("process") ||
      textLower.includes("method")
    ) {
      type = "procedure";
    } else if (
      textLower.includes("company") ||
      textLower.includes("name")
    ) {
      type = "company";
    } else if (
      textLower.includes("data") ||
      textLower.includes("information")
    ) {
      type = "data";
    } else if (
      textLower.includes("jurisdiction") ||
      textLower.includes("region")
    ) {
      type = "jurisdiction";
    }

    placeholders.push({
      type,
      text: placeholderText,
      fullMatch,
    });
  }

  return placeholders;
}

/**
 * Replace contact and procedure placeholders with actual questionnaire data
 * Handles placeholders for responsible person, governance owner, CTO contact, and incident reporting procedures
 */
export function replaceContactPlaceholders(
  content: string,
  questionnaireData: Record<string, any>,
  policyType: "privacy_policy" | "ai_usage_policy" | "ai_governance_policy"
): string {
  if (!content || typeof content !== "string") {
    return content;
  }

  let replaced = content;
  const r = questionnaireData as Record<string, any>;

  if (policyType === "ai_usage_policy") {
    // Replace responsible person placeholders
    const responsiblePersonName =
      r.responsible_person?.trim() ||
      r.responsible_person_name?.trim() ||
      null;
    const responsiblePersonContact =
      r.responsible_person_contact?.trim() ||
      r.responsible_person_email?.trim() ||
      r.contact_email?.trim() ||
      null;

    if (responsiblePersonName) {
      replaced = replaced.replace(
        /\[Action\s+Required:\s*Full\s+Name\s+of\s+Responsible\s+Person[^\]]*\]/gi,
        responsiblePersonName
      );
      replaced = replaced.replace(
        /\[Action\s+Required:\s*[^\]]*responsible\s+person[^\]]*name[^\]]*\]/gi,
        responsiblePersonName
      );
    }

    if (responsiblePersonContact) {
      replaced = replaced.replace(
        /\[Action\s+Required:\s*Contact\s+Information\s+for\s+Responsible\s+Person[^\]]*\]/gi,
        responsiblePersonContact
      );
      replaced = replaced.replace(
        /\[Action\s+Required:\s*[^\]]*responsible\s+person[^\]]*contact[^\]]*\]/gi,
        responsiblePersonContact
      );
    }
  } else if (policyType === "ai_governance_policy") {
    // Replace governance owner placeholders
    const governanceOwnerName =
      r.ai_governance_owner_name?.trim() ||
      r.governance_owner_name?.trim() ||
      null;
    const governanceOwnerContact =
      r.ai_governance_owner_contact?.trim() ||
      r.governance_owner_contact?.trim() ||
      r.governance_owner_email?.trim() ||
      r.cto_contact?.trim() ||
      r.contact_email?.trim() ||
      null;

    if (governanceOwnerName) {
      replaced = replaced.replace(
        /\[Action\s+Required:\s*Full\s+Name\s+of\s+AI\s+Governance\s+Owner[^\]]*\]/gi,
        governanceOwnerName
      );
      replaced = replaced.replace(
        /\[Action\s+Required:\s*[^\]]*governance\s+owner[^\]]*name[^\]]*\]/gi,
        governanceOwnerName
      );
    }

    if (governanceOwnerContact) {
      // Replace CTO contact placeholder
      replaced = replaced.replace(
        /\[Action\s+Required:\s*Please\s+provide\s+contact\s+information\s+for\s+the\s+CTO[^\]]*\]/gi,
        governanceOwnerContact
      );
      replaced = replaced.replace(
        /\[Action\s+Required:\s*[^\]]*contact\s+information\s+for\s+the\s+CTO[^\]]*\]/gi,
        governanceOwnerContact
      );
      replaced = replaced.replace(
        /\[Action\s+Required:\s*[^\]]*governance\s+owner[^\]]*contact[^\]]*\]/gi,
        governanceOwnerContact
      );
    }

    // Replace incident reporting procedure placeholder
    const incidentProcedure =
      r.incident_reporting_procedure?.trim() ||
      r.incident_reporting_procedure_details?.trim() ||
      null;

    if (incidentProcedure && incidentProcedure !== "Yes" && incidentProcedure !== "No") {
      replaced = replaced.replace(
        /\[Action\s+Required:\s*Please\s+provide\s+details\s+on\s+the\s+incident\s+reporting\s+and\s+response\s+procedures[^\]]*\]/gi,
        incidentProcedure
      );
      replaced = replaced.replace(
        /\[Action\s+Required:\s*Please\s+provide\s+the\s+Incident\s+Reporting\s+Procedure[^\]]*\]/gi,
        incidentProcedure
      );
      replaced = replaced.replace(
        /\[Action\s+Required:\s*[^\]]*incident\s+reporting[^\]]*procedure[^\]]*\]/gi,
        incidentProcedure
      );
    }
  }

  // Generic contact placeholder replacements (for any policy type)
  const dpoContact = r.dpo_contact?.trim() || r.contact_email?.trim() || null;
  if (dpoContact) {
    replaced = replaced.replace(
      /\[Action\s+Required:\s*[^\]]*dpo[^\]]*contact[^\]]*\]/gi,
      dpoContact
    );
    replaced = replaced.replace(
      /\[Action\s+Required:\s*[^\]]*privacy\s+contact[^\]]*\]/gi,
      dpoContact
    );
  }

  return replaced;
}

/**
 * Validate contact information in policy content
 * Checks for presence of contact section and validates email format if present
 */
export function validateContactInformation(
  content: string,
  policyType: "privacy_policy" | "ai_usage_policy" | "ai_governance_policy"
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || typeof content !== "string") {
    errors.push("Content is empty or invalid");
    return { isValid: false, errors, warnings };
  }

  const contentLower = content.toLowerCase();

  // Check for contact information section
  const contactSectionPatterns = [
    /^#{1,3}\s+contact\s+information/i,
    /^#{1,3}\s+contact\s+details/i,
    /^#{1,3}\s+contact/i,
    /contact\s+information/i,
  ];

  const hasContactSection = contactSectionPatterns.some((pattern) => {
    const lines = content.split("\n");
    return lines.some((line) => pattern.test(line.trim()));
  });

  if (!hasContactSection) {
    warnings.push("Contact Information section not found in policy");
  }

  // Check for placeholder contact information
  const placeholderContactPatterns = [
    /\[Action\s+Required:\s*[^\]]*contact[^\]]*\]/i,
    /\[Action\s+Required:\s*[^\]]*email[^\]]*\]/i,
    /\[Action\s+Required:\s*[^\]]*dpo[^\]]*\]/i,
    /\[Action\s+Required:\s*[^\]]*responsible\s+person[^\]]*\]/i,
  ];

  const hasPlaceholderContact = placeholderContactPatterns.some((pattern) =>
    pattern.test(content)
  );

  if (hasPlaceholderContact) {
    warnings.push(
      "Contact information contains placeholders that need to be replaced with actual contact details"
    );
  }

  // Extract email addresses from content
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = content.match(emailPattern) || [];

  // Filter out placeholder-like emails (containing "example", "placeholder", etc.)
  const validEmails = emails.filter(
    (email) =>
      !email.toLowerCase().includes("example") &&
      !email.toLowerCase().includes("placeholder") &&
      !email.toLowerCase().includes("your-email") &&
      !email.toLowerCase().includes("contact@")
  );

  if (hasContactSection && validEmails.length === 0 && !hasPlaceholderContact) {
    warnings.push(
      "Contact Information section found but no valid email address detected"
    );
  }

  // Validate email format if emails are present
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
  for (const email of validEmails) {
    if (!emailRegex.test(email)) {
      warnings.push(`Invalid email format detected: ${email}`);
    }
  }

  // Policy-specific contact requirements
  if (policyType === "privacy_policy") {
    // Privacy policies should have DPO/privacy contact
    const hasDpoContact =
      contentLower.includes("dpo") ||
      contentLower.includes("data protection officer") ||
      contentLower.includes("privacy officer");
    if (!hasDpoContact && !hasPlaceholderContact) {
      warnings.push(
        "Privacy Policy should include DPO (Data Protection Officer) or privacy contact information"
      );
    }
  } else if (policyType === "ai_usage_policy") {
    // AI Usage policies should have responsible person
    const hasResponsiblePerson =
      contentLower.includes("responsible person") ||
      contentLower.includes("responsible party");
    if (!hasResponsiblePerson && !hasPlaceholderContact) {
      warnings.push(
        "AI Usage Policy should include responsible person contact information"
      );
    }
  } else if (policyType === "ai_governance_policy") {
    // AI Governance policies should have governance owner
    const hasGovernanceOwner =
      contentLower.includes("governance owner") ||
      contentLower.includes("ai governance");
    if (!hasGovernanceOwner && !hasPlaceholderContact) {
      warnings.push(
        "AI Governance Policy should include governance owner contact information"
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that policy content has "Last updated" footer
 * Returns detailed validation result including placeholder and outdated date detection
 */
export function validateLastUpdatedFooter(
  content: string
): DateValidationResult {
  const result: DateValidationResult = {
    isValid: false,
    hasDate: false,
    isPlaceholder: false,
    isOutdated: false,
    errors: [],
    warnings: [],
  };

  if (!content || typeof content !== "string") {
    result.errors.push("Content is empty or invalid");
    return result;
  }

  // Check for placeholder patterns
  const placeholderPatterns = [
    /\[current\s+date[^\]]*\]/i,
    /current\s+date\s+in\s+YYYY-MM-DD\s+format/i,
    /\[current\s+date\]/i,
  ];

  const hasPlaceholder = placeholderPatterns.some((pattern) =>
    pattern.test(content)
  );

  if (hasPlaceholder) {
    result.isPlaceholder = true;
    result.errors.push(
      "Last updated footer contains placeholder text instead of actual date"
    );
    return result;
  }

  // Check for date pattern: "Last updated: YYYY-MM-DD"
  const lastUpdatedMatch = content.match(
    /last\s+updated\s*:?\s*(\d{4}-\d{2}-\d{2})/i
  );

  if (!lastUpdatedMatch) {
    result.errors.push(
      "Last updated footer not found or incorrectly formatted (expected: Last updated: YYYY-MM-DD)"
    );
    return result;
  }

  result.hasDate = true;
  const dateStr = lastUpdatedMatch[1];
  result.date = dateStr;

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    result.errors.push(`Invalid date format: ${dateStr} (expected YYYY-MM-DD)`);
    return result;
  }

  // Check if date is outdated (2022 or earlier)
  const year = parseInt(dateStr.split("-")[0], 10);
  const currentYear = new Date().getFullYear();

  if (year <= 2022) {
    result.isOutdated = true;
    result.warnings.push(
      `Last updated date is outdated: ${dateStr} (dates from 2022 or earlier are considered outdated)`
    );
  } else if (year > currentYear) {
    result.warnings.push(
      `Last updated date is in the future: ${dateStr} (should not exceed current year)`
    );
  }

  // Validate date is actually a valid date
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    result.errors.push(`Invalid date value: ${dateStr}`);
    return result;
  }

  // Check if date components match
  const [y, m, d] = dateStr.split("-").map(Number);
  if (
    dateObj.getFullYear() !== y ||
    dateObj.getMonth() + 1 !== m ||
    dateObj.getDate() !== d
  ) {
    result.errors.push(`Invalid date: ${dateStr} (date components don't match)`);
    return result;
  }

  // If we got here and no errors, it's valid
  if (result.errors.length === 0) {
    result.isValid = true;
  }

  return result;
}

/**
 * Remove Contact Information from Mapping Appendix
 * Contact Information should not appear in the Mapping Appendix as it has no framework references
 */
export function removeContactInfoFromMappingAppendix(content: string): string {
  if (!content || typeof content !== "string") {
    return content;
  }

  // Find the Mapping Appendix section
  const mappingAppendixRegex = /(#{1,3}\s*Mapping\s+Appendix[\s\S]*?)(?=#{1,3}\s*Last\s+updated|$)/i;
  const match = content.match(mappingAppendixRegex);
  
  if (!match) {
    return content; // No mapping appendix found, return as-is
  }

  const mappingAppendix = match[1];
  const beforeAppendix = content.substring(0, match.index!);
  const afterAppendix = content.substring(match.index! + match[0].length);

  // Remove lines containing "Contact Information" from the mapping appendix
  // This handles various formats:
  // - "Contact Information" (standalone)
  // - "Contact Information (GDPR Art. X)" (with fake references)
  // - "- Contact Information" (list item)
  // - "| Contact Information |" (table row)
  const cleanedAppendix = mappingAppendix
    .split('\n')
    .filter(line => {
      const lineLower = line.toLowerCase().trim();
      // Skip lines that contain "Contact Information" but keep the section header
      if (lineLower.includes('contact information')) {
        // Check if it's the section header itself (starts with #)
        if (lineLower.match(/^#{1,3}\s*contact\s+information/i)) {
          return false; // Remove Contact Information section header if it appears in appendix
        }
        // Check if it's a mapping entry (contains framework references or is a list/table item)
        if (
          lineLower.includes('gdpr') ||
          lineLower.includes('ai act') ||
          lineLower.includes('iso') ||
          lineLower.startsWith('-') ||
          lineLower.startsWith('|') ||
          lineLower.match(/^\s*contact\s+information/i)
        ) {
          return false; // Remove Contact Information mapping entries
        }
      }
      return true;
    })
    .join('\n');

  // Reconstruct content
  return beforeAppendix + cleanedAppendix + afterAppendix;
}

/**
 * Validates framework reference citations in policy content
 * Checks citation format accuracy: (GDPR Art. X), (AI Act Art. Y), (ISO 42001 §Z)
 * Validates article numbers are reasonable (not invalid like "Art. 999")
 * Returns validation errors for malformed citations
 */
export type FrameworkReferenceValidationResult = {
  isValid: boolean;
  errors: Array<{
    citation: string;
    error: string;
    position?: number;
  }>;
  warnings: Array<{
    citation: string;
    warning: string;
    position?: number;
  }>;
  validReferences: Array<{
    citation: string;
    framework: "GDPR" | "AI_ACT" | "ISO_42001";
    articleRef: string;
    articleNumber: string;
  }>;
};

/**
 * Valid article number ranges for each framework
 * These are reasonable bounds based on actual framework structures
 */
const VALID_ARTICLE_RANGES = {
  GDPR: {
    min: 1,
    max: 99, // GDPR has articles 1-99, with some sub-articles
    subArticleMax: 5, // Sub-articles typically go up to 5 (e.g., Art. 6.1, Art. 6.2)
  },
  AI_ACT: {
    min: 1,
    max: 150, // AI Act has articles 1-150+
    subArticleMax: 10,
  },
  ISO_42001: {
    min: 1,
    max: 15, // ISO 42001 sections are numbered 1-15 with subsections
    subArticleMax: 10, // Subsections can go deeper (e.g., §8.2.1)
  },
};

/**
 * Extract article number from a citation string
 * Returns the numeric part (e.g., "6" from "Art. 6", "8.2" from "§8.2")
 */
function extractArticleNumber(citation: string, framework: "GDPR" | "AI_ACT" | "ISO_42001"): string | null {
  if (framework === "ISO_42001") {
    // ISO format: §8.2, §8.2.1, etc.
    const match = citation.match(/§\s*(\d+(?:\.\d+)*)/i);
    return match ? match[1] : null;
  } else {
    // GDPR/AI Act format: Art. 6, Art. 6.1, Article 6, etc.
    const match = citation.match(/(?:Art\.|Article|Art)\s*(\d+(?:\.\d+)*)/i);
    return match ? match[1] : null;
  }
}

/**
 * Validate article number is within reasonable range
 */
function isValidArticleNumber(
  articleNum: string,
  framework: "GDPR" | "AI_ACT" | "ISO_42001"
): { isValid: boolean; error?: string } {
  const range = VALID_ARTICLE_RANGES[framework];
  const parts = articleNum.split(".").map((p) => parseInt(p, 10));

  // Check main article number
  if (isNaN(parts[0]) || parts[0] < range.min || parts[0] > range.max) {
    return {
      isValid: false,
      error: `Article number ${parts[0]} is outside valid range (${range.min}-${range.max}) for ${framework}`,
    };
  }

  // Check sub-articles if present
  for (let i = 1; i < parts.length; i++) {
    if (isNaN(parts[i]) || parts[i] < 1 || parts[i] > range.subArticleMax) {
      return {
        isValid: false,
        error: `Sub-article number ${parts[i]} is outside valid range (1-${range.subArticleMax}) for ${framework}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate framework reference citations in policy content
 */
export function validateFrameworkReferences(
  content: string
): FrameworkReferenceValidationResult {
  const errors: Array<{
    citation: string;
    error: string;
    position?: number;
  }> = [];
  const warnings: Array<{
    citation: string;
    warning: string;
    position?: number;
  }> = [];
  const validReferences: Array<{
    citation: string;
    framework: "GDPR" | "AI_ACT" | "ISO_42001";
    articleRef: string;
    articleNumber: string;
  }> = [];

  if (!content || typeof content !== "string") {
    return {
      isValid: false,
      errors: [{ citation: "", error: "Content is empty or invalid" }],
      warnings: [],
      validReferences: [],
    };
  }

  // Patterns to match framework citations
  // GDPR: (GDPR Art. 6), (GDPR Article 6), (GDPR Art 6), (GDPR Art.6)
  const gdprPattern = /\(GDPR\s+(?:Art\.|Article|Art)\s*([\d\.]+)[^)]*\)/gi;
  
  // AI Act: (AI Act Art. 9), (AI Act Article 9), (AI Act Art 9)
  const aiActPattern = /\(AI\s+Act\s+(?:Art\.|Article|Art)\s*([\d\.]+)[^)]*\)/gi;
  
  // ISO 42001: (ISO 42001 §8.2), (ISO 42001 Section 8.2), (ISO 42001 Clause 8.2)
  const isoPatterns = [
    /\(ISO\s*42001\s+(?:§|Section|Clause)\s*([\d\.]+)[^)]*\)/gi,
    /\(ISO-42001\s+(?:§|Section|Clause)\s*([\d\.]+)[^)]*\)/gi,
  ];

  // Track all citations found
  const allCitations = new Set<string>();

  // Validate GDPR citations
  let match;
  gdprPattern.lastIndex = 0;
  while ((match = gdprPattern.exec(content)) !== null) {
    const fullCitation = match[0];
    const articleNum = match[1].trim();

    if (allCitations.has(fullCitation)) {
      continue; // Skip duplicates
    }
    allCitations.add(fullCitation);

    const validation = isValidArticleNumber(articleNum, "GDPR");
    if (validation.isValid) {
      validReferences.push({
        citation: fullCitation,
        framework: "GDPR",
        articleRef: `Art. ${articleNum}`,
        articleNumber: articleNum,
      });
    } else {
      errors.push({
        citation: fullCitation,
        error: validation.error || `Invalid GDPR article number: ${articleNum}`,
        position: match.index,
      });
    }
  }

  // Validate AI Act citations
  aiActPattern.lastIndex = 0;
  while ((match = aiActPattern.exec(content)) !== null) {
    const fullCitation = match[0];
    const articleNum = match[1].trim();

    if (allCitations.has(fullCitation)) {
      continue;
    }
    allCitations.add(fullCitation);

    const validation = isValidArticleNumber(articleNum, "AI_ACT");
    if (validation.isValid) {
      validReferences.push({
        citation: fullCitation,
        framework: "AI_ACT",
        articleRef: `Art. ${articleNum}`,
        articleNumber: articleNum,
      });
    } else {
      errors.push({
        citation: fullCitation,
        error: validation.error || `Invalid AI Act article number: ${articleNum}`,
        position: match.index,
      });
    }
  }

  // Validate ISO 42001 citations
  for (const pattern of isoPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const fullCitation = match[0];
      const articleNum = match[1].trim();

      if (allCitations.has(fullCitation)) {
        continue;
      }
      allCitations.add(fullCitation);

      const validation = isValidArticleNumber(articleNum, "ISO_42001");
      if (validation.isValid) {
        validReferences.push({
          citation: fullCitation,
          framework: "ISO_42001",
          articleRef: `§${articleNum}`,
          articleNumber: articleNum,
        });
      } else {
        errors.push({
          citation: fullCitation,
          error: validation.error || `Invalid ISO 42001 section number: ${articleNum}`,
          position: match.index,
        });
      }
    }
  }

  // Check for malformed citations (missing parentheses, wrong format, etc.)
  // Look for patterns that look like citations but don't match our valid patterns
  const malformedPatterns = [
    // Missing opening parenthesis
    /GDPR\s+(?:Art\.|Article|Art)\s*[\d\.]+[^)]/gi,
    /AI\s+Act\s+(?:Art\.|Article|Art)\s*[\d\.]+[^)]/gi,
    /ISO\s*42001\s+(?:§|Section|Clause)\s*[\d\.]+[^)]/gi,
    // Missing closing parenthesis
    /\(GDPR\s+(?:Art\.|Article|Art)\s*[\d\.]+[^(]*$/gi,
    /\(AI\s+Act\s+(?:Art\.|Article|Art)\s*[\d\.]+[^(]*$/gi,
    /\(ISO\s*42001\s+(?:§|Section|Clause)\s*[\d\.]+[^(]*$/gi,
  ];

  for (const pattern of malformedPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const citation = match[0];
      if (!allCitations.has(citation) && !allCitations.has(`(${citation}`) && !allCitations.has(`${citation})`)) {
        warnings.push({
          citation,
          warning: "Citation appears malformed (missing parentheses or incorrect format)",
          position: match.index,
        });
      }
    }
  }

  // Check for citations with incorrect format (e.g., "GDPR Art 999" instead of "GDPR Art. 999")
  const incorrectFormatPatterns = [
    // Missing period after "Art"
    /\(GDPR\s+Art\s+(\d+)\)/gi,
    /\(AI\s+Act\s+Art\s+(\d+)\)/gi,
  ];

  for (const pattern of incorrectFormatPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const citation = match[0];
      if (!allCitations.has(citation)) {
        warnings.push({
          citation,
          warning: "Citation format should use 'Art.' (with period) instead of 'Art'",
          position: match.index,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validReferences,
  };
}