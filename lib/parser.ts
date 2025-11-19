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

    // List specific placeholders (limit to first 5 to avoid overwhelming the UI)
    const placeholderList = placeholders
      .slice(0, 5)
      .map((p) => `[${p.type}]: ${p.text}`)
      .join("; ");
    if (placeholderList) {
      warnings.push(`Placeholders found: ${placeholderList}${placeholders.length > 5 ? "..." : ""}`);
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
