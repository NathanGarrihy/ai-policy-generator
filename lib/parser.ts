// lib/parser.ts
/**
 * Parser for structured policy output from OpenAI
 * Extracts POLICY-MARKDOWN and METAJSON blocks from the response
 */

export type PolicyMetadata = {
  policy_type?: string;
  placeholders_present?: boolean;
  jurisdictions?: string[];
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

  // Fallback: if no structured format, return the entire content
  // This handles cases where OpenAI doesn't follow the format exactly
  // or for backwards compatibility
  // Also clean up any obvious delimiter artifacts that might have been left
  let fallbackContent = rawContent.trim();

  // Remove any standalone delimiter lines that might be in the content
  fallbackContent = fallbackContent
    .replace(/-{3,}\s*(BEGIN|END)\s+POLICY-(MARKDOWN|METAJSON)\s*-{3,}/gi, "")
    .trim();

  return {
    content: fallbackContent,
    metadata: null,
    hasStructure: false,
  };
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
 * Check if mapping appendix exists in policy content
 */
export function validateMappingAppendix(content: string): boolean {
  const contentLower = content.toLowerCase();

  // Check for various forms of "Mapping Appendix" heading
  const mappingAppendixPatterns = [
    /^#{1,3}\s+mapping\s+appendix/im,
    /^#{1,3}\s+framework\s+mapping/im,
    /^#{1,3}\s+compliance\s+mapping/im,
    /mapping\s+appendix/i,
    /framework\s+mapping/i,
  ];

  // Check if any pattern matches
  const hasMappingAppendix = mappingAppendixPatterns.some((pattern) => {
    // Check in headings (lines starting with #)
    const lines = content.split("\n");
    for (const line of lines) {
      if (pattern.test(line.trim())) {
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
  const frameworkRefsPattern =
    /(?:GDPR\s+Art\.|AI\s+Act\s+Art\.|ISO\s+42001\s+§).{0,200}(?:GDPR\s+Art\.|AI\s+Act\s+Art\.|ISO\s+42001\s+§)/im;
  const hasGroupedRefs = frameworkRefsPattern.test(content);

  return hasMappingAppendix || (hasMappingTable && hasGroupedRefs);
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
  metadata: PolicyMetadata | null
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get required sections for this policy type
  const requiredSections = REQUIRED_SECTIONS[policyType];
  if (!requiredSections) {
    errors.push(`Unknown policy type: ${policyType}`);
    return { isValid: false, errors, warnings };
  }

  // Extract sections from content
  const foundSections = extractSections(content);
  const foundSectionsLower = foundSections.map((s) => s.toLowerCase());

  // Check for required sections (fuzzy matching)
  const missingSections: string[] = [];
  for (const required of requiredSections) {
    const requiredLower = required.toLowerCase();

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

    if (!found) {
      missingSections.push(required);
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

      if (matchCount < foundSections.length * 0.5) {
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

  // Add missing sections to errors
  if (missingSections.length > 0) {
    // Mapping Appendix is critical, others are warnings if content seems reasonable
    const criticalMissing = missingSections.filter((s) =>
      s.toLowerCase().includes("mapping appendix")
    );
    const nonCriticalMissing = missingSections.filter(
      (s) => !s.toLowerCase().includes("mapping appendix")
    );

    if (criticalMissing.length > 0) {
      errors.push(`Missing critical sections: ${criticalMissing.join(", ")}`);
    }

    if (nonCriticalMissing.length > 0) {
      warnings.push(
        `Missing or unclear sections: ${nonCriticalMissing.join(", ")}`
      );
    }
  }

  // Check for placeholder handling
  const hasPlaceholders = /\[Action\s+Required:.*?\]/i.test(content);
  if (hasPlaceholders && metadata && !metadata.placeholders_present) {
    warnings.push("Content contains placeholders but METAJSON indicates none");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that policy content has "Last updated" footer
 */
export function validateLastUpdatedFooter(content: string): boolean {
  const lastUpdatedPattern = /last\s+updated\s*:?\s*\d{4}-\d{2}-\d{2}/i;
  return lastUpdatedPattern.test(content);
}
