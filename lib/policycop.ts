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
};

/**
 * Analyzes policy content against compliance rules
 */
export function analyzePolicyCompliance(
  policyContent: string
): PolicyCopResult {
  const contentLower = policyContent.toLowerCase();

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

function checkRules(rules: ComplianceRule[], content: string): boolean[] {
  return rules.map((rule) => checkRule(rule, content));
}

function checkRule(rule: ComplianceRule, content: string): boolean {
  // Check if any keyword is found in content
  // Also check for article reference patterns like "Art. 6", "art. 6", "Article 6"
  const articlePatterns = [
    rule.article_ref.toLowerCase(),
    rule.article_ref.toLowerCase().replace("art.", "article"),
    rule.article_ref.toLowerCase().replace("art.", "art"),
  ];

  const keywordMatch = rule.keywords.some((keyword) =>
    content.includes(keyword.toLowerCase())
  );

  const articleMatch = articlePatterns.some((pattern) =>
    content.includes(pattern)
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
 * Looks for patterns like "(GDPR Art. 6)", "(AI Act Art. 9)", "(ISO 42001 §8.2)"
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

  // Pattern: (GDPR Art. 6), (AI Act Art. 9), (ISO 42001 §8.2)
  const mappingPattern =
    /\(((?:GDPR|AI\s+Act|ISO\s+42001))\s+(?:Art\.|Article|§)\s*([\d\.]+)[^)]*\)/gi;

  const lines = policyContent.split("\n");
  let currentSection = "";

  lines.forEach((line, index) => {
    // Track current section (H1, H2, H3)
    if (line.match(/^#+\s+/)) {
      currentSection = line.replace(/^#+\s+/, "").trim();
    }

    let match;
    while ((match = mappingPattern.exec(line)) !== null) {
      const frameworkName = match[1].toUpperCase().replace(/\s+/g, "_");
      const articleRef = match[2].trim();

      let framework: "GDPR" | "AI_ACT" | "ISO_42001";
      if (frameworkName === "GDPR") {
        framework = "GDPR";
      } else if (frameworkName === "AI_ACT") {
        framework = "AI_ACT";
      } else if (frameworkName === "ISO_42001") {
        framework = "ISO_42001";
      } else {
        continue;
      }

      mappings.push({
        section_id: currentSection || `line-${index + 1}`,
        framework,
        article_ref: `${framework === "ISO_42001" ? "§" : "Art. "}${articleRef}`,
      });
    }
  });

  return mappings;
}

