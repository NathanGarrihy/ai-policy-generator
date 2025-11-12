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
  const markdownBlockRegex = /-{3,}\s*BEGIN\s+POLICY-MARKDOWN\s*-{3,}([\s\S]*?)-{3,}\s*END\s+POLICY-MARKDOWN\s*-{3,}/i;
  const metajsonBlockRegex = /-{3,}\s*BEGIN\s+POLICY-METAJSON\s*-{3,}([\s\S]*?)-{3,}\s*END\s+POLICY-METAJSON\s*-{3,}/i;

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
  fallbackContent = fallbackContent.replace(
    /-{3,}\s*(BEGIN|END)\s+POLICY-(MARKDOWN|METAJSON)\s*-{3,}/gi,
    ""
  ).trim();

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

