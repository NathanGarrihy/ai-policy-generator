import {
  ALL_RULES,
  GDPR_RULES,
  AI_ACT_RULES,
  ISO_42001_RULES,
  type ComplianceRule,
  getClauseEligibleSections,
} from "./compliance-rules";
import {
  type PolicyMetadata,
  detectPlaceholders,
  parsePolicyOutput,
} from "./parser";
import type {
  RuleApplicability,
  PrivacyQuestionnaire,
  AIUsageQuestionnaire,
  AIGovernanceQuestionnaire,
} from "./types";
import {
  WINDOW_SIZES,
  CO_OCCURRENCE_THRESHOLDS,
  KEYWORD_THRESHOLDS,
  CONTENT_THRESHOLDS,
  FRAMEWORK_REFERENCES,
  QUALITY_THRESHOLDS,
  REGEX_CACHE,
} from "./constants";

export type PolicyType = "privacy_policy" | "ai_usage_policy" | "ai_governance_policy";

/**
 * Build applicability context from questionnaire data
 * Derives boolean flags that determine which compliance rules apply to this company
 */
export function buildApplicabilityContext(
  questionnaireData: Record<string, any>,
  policyType: PolicyType
): RuleApplicability {
  const context: RuleApplicability = {};
  if (policyType === "privacy_policy") {
    const privacyData = questionnaireData as Partial<PrivacyQuestionnaire>;

    /**
     * International transfers & processors
     *
     * We deliberately avoid assuming that any EU/UK jurisdiction implies
     * international transfers. Instead, we only infer transfers where there
     * is a clear signal of non‑EU/UK frameworks in scope alongside third
     * parties. This keeps us conservative and avoids over‑scoping Art. 44–49.
     */
    const usesThirdParties = privacyData.third_parties === "Yes";
    const jurisdictions = privacyData.jurisdictions ?? [];

    const targetsNonEuOrUkFrameworks = jurisdictions.some((j) =>
      // Current questionnaire uses framework labels rather than true
      // jurisdictions. Treat clearly non‑EU/UK frameworks as a proxy for
      // cross‑border exposure instead of assuming all GDPR/UK GDPR implies it.
      j.includes("CCPA") || j.includes("PIPEDA")
    );

    context.hasInternationalTransfers =
      usesThirdParties && targetsNonEuOrUkFrameworks;

    // Third‑party processors are inferred directly from the checkbox
    context.usesThirdPartyProcessors = privacyData.third_parties === "Yes";

    /**
     * Special‑category / high‑risk processing
     *
     * The current MVP questionnaire does not explicitly ask about GDPR
     * special‑category data (health, religion, biometrics, etc.). Earlier
     * heuristics treated “Payment info” as special category, which is not
     * legally accurate. Until we add dedicated fields, we keep this flag
     * conservative and do not infer special‑category processing at all.
     */
    context.processesSpecialCategoryData = false;

    // Treat truly indefinite retention as a generic high‑risk signal.
    context.hasHighRiskProcessing =
      privacyData.data_retention === "Indefinitely";
  } else if (policyType === "ai_usage_policy") {
    const aiUsageData = questionnaireData as Partial<AIUsageQuestionnaire>;

    // Check if AI is used with personal data
    const dataSent = aiUsageData.data_sent_to_models?.toLowerCase() || "";
    context.usesAIForPersonalData =
      dataSent.includes("pii") ||
      dataSent.includes("personal data") ||
      dataSent.includes("personal information") ||
      dataSent.includes("email") ||
      dataSent.includes("name") ||
      dataSent.includes("user data");
    // Check if high-risk AI is deployed
    context.deploysHighRiskAI = aiUsageData.ai_risk_rating === "high";
    /**
     * Automated decision‑making
     *
     * Do NOT infer this solely from “low oversight” or “high risk”, which
     * would massively over‑scope AI Act obligations. With the current
     * questionnaire shape we can only make a conservative guess. For now,
     * we only flag automated decision‑making when the risk is explicitly
     * marked high AND human oversight is low.
     */
    context.usesAutomatedDecisionMaking =
      aiUsageData.ai_risk_rating === "high" &&
      aiUsageData.human_oversight_level === "low";
  } else if (policyType === "ai_governance_policy") {
    const aiGovData = questionnaireData as Partial<AIGovernanceQuestionnaire>;

    /**
     * High‑risk AI for governance
     *
     * Earlier versions assumed that the mere existence of an AI governance
     * policy implied deployment of high‑risk AI systems. That is too broad:
     * many teams introduce governance before any high‑risk deployment.
     *
     * Until the governance questionnaire explicitly captures high‑risk
     * system inventory or classification, we do NOT infer high‑risk usage
     * from this form alone.
     */
    context.deploysHighRiskAI = false;

    // Check if offering AI as a product in the EU (very light‑weight heuristic)
    context.offersAIAsProductInEU =
      aiGovData.ai_governance_owner_role?.toLowerCase().includes("product") === true ||
      aiGovData.ai_governance_owner_role?.toLowerCase().includes("cto") === true;
  }

  // Default all undefined flags to false for clarity
  return {
    usesAIForPersonalData: context.usesAIForPersonalData ?? false,
    deploysHighRiskAI: context.deploysHighRiskAI ?? false,
    offersAIAsProductInEU: context.offersAIAsProductInEU ?? false,
    usesAutomatedDecisionMaking: context.usesAutomatedDecisionMaking ?? false,
    processesSpecialCategoryData: context.processesSpecialCategoryData ?? false,
    hasInternationalTransfers: context.hasInternationalTransfers ?? false,
    usesThirdPartyProcessors: context.usesThirdPartyProcessors ?? false,
    hasHighRiskProcessing: context.hasHighRiskProcessing ?? false,
  };
}

/**
 * Maps policy types to their allowed ISO 42001 sections
 * null means all ISO 42001 sections are allowed
 */
export const POLICY_ISO_SECTIONS: Record<PolicyType, string[] | null> = {
  privacy_policy: ["§8.2"],
  ai_usage_policy: null,
  ai_governance_policy: null,
};

/**
 * Maps policy types to their allowed frameworks
 * For privacy_policy, ISO_42001 is limited to §8.2 only
 */
export const POLICY_FRAMEWORK_SCOPE: Record<
  PolicyType,
  {
    frameworks: Array<"GDPR" | "AI_ACT" | "ISO_42001">;
    iso42001Section82Only?: boolean; // Flag for privacy_policy to only use ISO 42001 §8.2
  }
> = {
  privacy_policy: {
    frameworks: ["GDPR", "ISO_42001"],
    iso42001Section82Only: true, // Privacy policy only uses ISO 42001 §8.2
  },
  ai_usage_policy: {
    frameworks: ["GDPR", "AI_ACT", "ISO_42001"],
  },
  ai_governance_policy: {
    frameworks: ["GDPR", "AI_ACT", "ISO_42001"],
  },
};

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
  missing_mandatory_clauses?: Array<{
    framework: string;
    article_ref: string;
    clause_text: string;
  }>;
  missing_required_clauses?: Array<{
    framework: string;
    article_ref: string;
    clause_text: string;
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

export type PolicyCoverageThresholds = {
  gdpr: number;
  ai_act: number;
  iso_42001: number;
};

/**
 * Get policy-type-specific coverage thresholds
 * Different policy types have different expected coverage levels
 * If applicabilityContext is provided, thresholds are calculated dynamically based on applicable rules
 */
export function getPolicyThresholds(
  policyType: PolicyType,
  applicabilityContext?: RuleApplicability
): PolicyCoverageThresholds {
  // If no applicability context provided, use static thresholds (backward compatible)
  if (!applicabilityContext) {
    switch (policyType) {
      case "privacy_policy":
        return {
          gdpr: 0.7, // 70% - Privacy policies should have high GDPR coverage
          ai_act: 0, // Privacy policies don't support AI Act per POLICY_FRAMEWORK_SCOPE
          iso_42001: 0.6, // 60% - Privacy policies should reference ISO 42001 for data handling
        };
      case "ai_usage_policy":
        return {
          gdpr: 0.3, // 30% - AI Usage policies focus on AI Act, GDPR is secondary
          ai_act: 0.7, // 70% - AI Usage policies should have high AI Act coverage
          iso_42001: 0.7, // 70% - AI Usage policies should have high ISO 42001 coverage
        };
      case "ai_governance_policy":
        return {
          gdpr: 0.2, // 20% - AI Governance policies focus on governance, GDPR is minimal
          ai_act: 0.7, // 70% - AI Governance policies should have high AI Act coverage
          iso_42001: 0.7, // 70% - AI Governance policies should have high ISO 42001 coverage
        };
      default:
        // Default thresholds (conservative)
        return {
          gdpr: 0.5,
          ai_act: 0.5,
          iso_42001: 0.5,
        };
    }
  }

  // Dynamic threshold calculation based on applicable rules
  // Filter rules by applicability context (with caching)
  const thresholdCacheKey = generateRulesCacheKey(policyType, applicabilityContext);
  const applicableGdprRules = filterRulesByApplicability(GDPR_RULES, applicabilityContext, `${thresholdCacheKey}:GDPR:threshold`);
  const applicableAiActRules = filterRulesByApplicability(AI_ACT_RULES, applicabilityContext, `${thresholdCacheKey}:AI_ACT:threshold`);
  const applicableIsoRules = filterRulesByApplicability(ISO_42001_RULES, applicabilityContext, `${thresholdCacheKey}:ISO_42001:threshold`);

  // Get base thresholds for the policy type (use switch statement directly to avoid recursion)
  let baseThresholds: PolicyCoverageThresholds;
  switch (policyType) {
    case "privacy_policy":
      baseThresholds = {
        gdpr: 0.7,
        ai_act: 0,
        iso_42001: 0.6,
      };
      break;
    case "ai_usage_policy":
      baseThresholds = {
        gdpr: 0.3,
        ai_act: 0.7,
        iso_42001: 0.7,
      };
      break;
    case "ai_governance_policy":
      baseThresholds = {
        gdpr: 0.2,
        ai_act: 0.7,
        iso_42001: 0.7,
      };
      break;
    default:
      baseThresholds = {
        gdpr: 0.5,
        ai_act: 0.5,
        iso_42001: 0.5,
      };
  }

  // Calculate dynamic thresholds
  let gdprThreshold = baseThresholds.gdpr;
  let aiActThreshold = baseThresholds.ai_act;
  let isoThreshold = baseThresholds.iso_42001;

  // If no AI Act rules are applicable, set AI Act threshold to 0
  if (applicableAiActRules.length === 0) {
    aiActThreshold = 0;
  } else {
    // If AI Act rules are applicable, use base threshold (already set for AI Usage/Governance)
    // For privacy policies, if AI Act rules become applicable, use a lower threshold
    if (policyType === "privacy_policy" && applicableAiActRules.length > 0) {
      aiActThreshold = 0.4; // Lower threshold for privacy policies with AI Act rules
    }
  }

  // GDPR and ISO thresholds remain the same (they're always applicable)
  // But we could adjust them if needed based on applicable rule count

  return {
    gdpr: gdprThreshold,
    ai_act: aiActThreshold,
    iso_42001: isoThreshold,
  };
}

/**
 * Normalizes section names for comparison
 * Lowercases, trims whitespace, replaces underscores with spaces, and collapses multiple spaces
 * Handles variations like "Risk Management" vs "Risk Management Procedures" vs "sec_risk_management"
 */
function normalizeSectionName(name: string): string {
  let normalized = name.toLowerCase().trim();
  
  // Replace underscores with spaces
  normalized = normalized.replace(/_/g, " ");
  
  // Collapse multiple spaces into single space
  normalized = normalized.replace(/\s+/g, " ");
  
  return normalized;
}

/**
 * Parses policy content into sections based on markdown headings (H2/H3)
 * Handles edge cases: no headings, nested headings
 * Each H2 or H3 heading starts a new section
 * Returns sections with both original name and normalized name
 */
export function parsePolicySections(policyContent: string): Array<{
  name: string;
  content: string;
  normalizedName: string;
}> {
  const sections: Array<{ name: string; content: string; normalizedName: string }> = [];
  const lines = policyContent.split("\n");

  let currentSection: { name: string; content: string; normalizedName: string } | null = null;
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
      currentSection = { 
        name: sectionName, 
        content: "",
        normalizedName: normalizeSectionName(sectionName),
      };
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
    const defaultName = "Policy Content";
    sections.push({
      name: defaultName,
      content: currentContent.join("\n").trim(),
      normalizedName: normalizeSectionName(defaultName),
    });
  }

  // Final fallback: if no sections were found at all
  if (sections.length === 0) {
    const defaultName = "Policy Content";
    sections.push({
      name: defaultName,
      content: policyContent.trim(),
      normalizedName: normalizeSectionName(defaultName),
    });
  }

  return sections;
}

/**
 * Gets the framework scope for a policy type, optionally overridden by frameworks_selected
 * Returns the list of frameworks that should be evaluated for this policy
 */
function getFrameworkScopeForPolicyType(
  policyType?: PolicyType,
  frameworksSelected?: string[]
): Array<"GDPR" | "AI_ACT" | "ISO_42001"> {
  // If frameworks_selected is provided and non-empty, use it to override
  if (frameworksSelected && frameworksSelected.length > 0) {
    // Normalize framework names from METAJSON (e.g., "GDPR", "AI Act", "ISO 42001")
    const normalizedFrameworks: Array<"GDPR" | "AI_ACT" | "ISO_42001"> = [];
    
    for (const framework of frameworksSelected) {
      const normalized = framework.toUpperCase().trim();
      if (normalized === "GDPR" || normalized.includes("GDPR")) {
        normalizedFrameworks.push("GDPR");
      } else if (normalized === "AI_ACT" || normalized.includes("AI ACT") || normalized.includes("AIACT")) {
        normalizedFrameworks.push("AI_ACT");
      } else if (normalized === "ISO_42001" || normalized.includes("ISO 42001") || normalized.includes("ISO42001")) {
        normalizedFrameworks.push("ISO_42001");
      }
    }
    
    // Return normalized frameworks if any were recognized, otherwise fall through to policy type default
    if (normalizedFrameworks.length > 0) {
      return normalizedFrameworks;
    }
  }
  
  // Fallback to policy type default
  if (!policyType) {
    return ["GDPR", "AI_ACT", "ISO_42001"]; // Default: all frameworks
  }

  const scope = POLICY_FRAMEWORK_SCOPE[policyType];
  if (!scope) {
    return ["GDPR", "AI_ACT", "ISO_42001"]; // Fallback: all frameworks
  }

  return scope.frameworks;
}

/**
 * LRU Cache for filtered compliance rules
 * Caches rules filtered by policy type and applicability context
 */
class RulesCache {
  private cache: Map<string, ComplianceRule[]> = new Map();
  private accessOrder: string[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = RULES_CACHE.MAX_SIZE) {
    this.maxSize = maxSize;
  }

  get(key: string): ComplianceRule[] | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return undefined;
  }

  set(key: string, rules: ComplianceRule[]): void {
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    // Add to cache
    this.cache.set(key, rules);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }
}

// Global rules cache instance
const rulesCache = new RulesCache();

/**
 * Generate cache key from policy type and applicability context
 */
function generateRulesCacheKey(
  policyType: PolicyType | undefined,
  applicabilityContext: RuleApplicability | undefined,
  frameworksSelected?: string[]
): string {
  const parts: string[] = [];
  
  if (policyType) {
    parts.push(`type:${policyType}`);
  }
  
  if (frameworksSelected && frameworksSelected.length > 0) {
    parts.push(`frameworks:${frameworksSelected.sort().join(",")}`);
  }
  
  if (applicabilityContext) {
    // Create hash-like key from applicability context
    const contextParts: string[] = [];
    if (applicabilityContext.usesAIForPersonalData) contextParts.push("ai-personal");
    if (applicabilityContext.deploysHighRiskAI) contextParts.push("high-risk");
    if (applicabilityContext.offersAIAsProductInEU) contextParts.push("ai-product");
    if (applicabilityContext.usesAutomatedDecisionMaking) contextParts.push("automated");
    if (applicabilityContext.processesSpecialCategoryData) contextParts.push("special-category");
    if (applicabilityContext.hasInternationalTransfers) contextParts.push("transfers");
    if (applicabilityContext.usesThirdPartyProcessors) contextParts.push("third-party");
    if (applicabilityContext.hasHighRiskProcessing) contextParts.push("high-risk-processing");
    
    if (contextParts.length > 0) {
      parts.push(`context:${contextParts.sort().join(",")}`);
    }
  }
  
  return parts.join("|");
}

/**
 * Filter rules by applicability context
 * Rules without applicability function are always included (backward compatible)
 * Rules with applicability function are included only if function returns true
 * Uses caching for performance optimization
 */
function filterRulesByApplicability(
  rules: ComplianceRule[],
  applicabilityContext: RuleApplicability,
  cacheKey?: string
): ComplianceRule[] {
  // Check cache if key provided
  if (cacheKey) {
    const cached = rulesCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  const filtered = rules.filter((rule) => {
    // If rule has no applicability function, it's always applicable (backward compatible)
    if (!rule.applicability) {
      return true;
    }
    // Otherwise, check if applicability function returns true for this context
    return rule.applicability(applicabilityContext);
  });
  
  // Cache result if key provided
  if (cacheKey) {
    rulesCache.set(cacheKey, filtered);
  }
  
  return filtered;
}

/**
 * Categorize rules by mandatory status
 * Returns three groups: hard mandatory, soft required, and optional
 */
function categorizeRules(rules: ComplianceRule[]): {
  hardMandatory: ComplianceRule[];
  softRequired: ComplianceRule[];
  optional: ComplianceRule[];
} {
  const hardMandatory: ComplianceRule[] = [];
  const softRequired: ComplianceRule[] = [];
  const optional: ComplianceRule[] = [];

  for (const rule of rules) {
    if (rule.hard_mandatory === true) {
      hardMandatory.push(rule);
    } else if (rule.required === true) {
      softRequired.push(rule);
    } else {
      optional.push(rule);
    }
  }

  return { hardMandatory, softRequired, optional };
}

/**
 * Filters rules based on policy type and framework scope
 * Returns filtered rules array based on POLICY_FRAMEWORK_SCOPE
 * For ISO_42001 rules, also filters by allowed sections from POLICY_ISO_SECTIONS
 * Optionally accepts frameworks_selected override from METAJSON
 */
function filterRulesByPolicyType(
  rules: ComplianceRule[],
  policyType?: PolicyType,
  frameworksSelected?: string[]
): ComplianceRule[] {
  // Get the resolved framework scope (with frameworks_selected override if provided)
  const allowedFrameworks = getFrameworkScopeForPolicyType(policyType, frameworksSelected);

  if (!policyType) {
    // If no policy type, filter by allowed frameworks only
    return rules.filter((rule) => allowedFrameworks.includes(rule.framework));
  }

  const allowedIsoSections = POLICY_ISO_SECTIONS[policyType];

  return rules.filter((rule) => {
    // Filter by allowed frameworks (from frameworks_selected or policy type default)
    if (!allowedFrameworks.includes(rule.framework)) {
      return false;
    }

    // For ISO_42001 rules, filter by allowed sections if policy type has restrictions
    if (rule.framework === "ISO_42001" && allowedIsoSections !== null) {
      // Extract section identifier from article_ref (e.g., "§8.2" -> "§8.2")
      // ISO 42001 article_ref format is "§X.Y" or "§X"
      const isoSection = rule.article_ref;
      
      // Check if the rule's section is in the allowed list
      if (!allowedIsoSections.includes(isoSection)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks if a rule is eligible for a given section based on section_ids
 * Returns true if rule has no section_ids (backward compatible) or if section matches
 */
function isRuleEligibleForSection(
  rule: ComplianceRule,
  normalizedSectionName: string,
  allNormalizedSectionNames: string[]
): boolean {
  const eligibleSections = getClauseEligibleSections(rule);
  
  // If no section_ids defined, rule is eligible everywhere (backward compatible)
  if (eligibleSections.length === 0) {
    return true;
  }
  
  // Normalize eligible section IDs and check for matches
  const normalizedEligibleSections = eligibleSections.map(normalizeSectionName);
  
  // Check if any eligible section matches the current section (fuzzy match)
  for (const eligibleSection of normalizedEligibleSections) {
    // Direct match
    if (normalizedSectionName === eligibleSection) {
      return true;
    }
    
    // Contains match (e.g., "risk management procedures" contains "risk management")
    if (normalizedSectionName.includes(eligibleSection) || eligibleSection.includes(normalizedSectionName)) {
      return true;
    }
    
    // Check against all section names (for cross-section matching)
    for (const sectionName of allNormalizedSectionNames) {
      if (sectionName.includes(eligibleSection) || eligibleSection.includes(sectionName)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Analyzes a single section's compliance against all frameworks
 * Uses context-aware matching for better accuracy
 */
function analyzeSectionCompliance(
  sectionContent: string,
  sectionName?: string,
  policyType?: PolicyType,
  allNormalizedSectionNames?: string[],
  frameworksSelected?: string[],
  applicabilityContext?: RuleApplicability
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
  const normalizedSectionName = sectionName ? normalizeSectionName(sectionName) : "";
  const normalizedSectionNames = allNormalizedSectionNames || [];

  // Generate cache key for this combination
  const cacheKey = generateRulesCacheKey(policyType, applicabilityContext, frameworksSelected);
  const gdprCacheKey = `${cacheKey}:GDPR`;
  const aiActCacheKey = `${cacheKey}:AI_ACT`;
  const isoCacheKey = `${cacheKey}:ISO_42001`;

  // Filter rules by applicability FIRST (if context provided)
  let gdprRulesToFilter = GDPR_RULES;
  let aiActRulesToFilter = AI_ACT_RULES;
  let isoRulesToFilter = ISO_42001_RULES;

  if (applicabilityContext) {
    gdprRulesToFilter = filterRulesByApplicability(GDPR_RULES, applicabilityContext, gdprCacheKey);
    aiActRulesToFilter = filterRulesByApplicability(AI_ACT_RULES, applicabilityContext, aiActCacheKey);
    isoRulesToFilter = filterRulesByApplicability(ISO_42001_RULES, applicabilityContext, isoCacheKey);
  }

  // Then filter by policy type and frameworks_selected override
  const filteredGdprRules = policyType || frameworksSelected
    ? filterRulesByPolicyType(gdprRulesToFilter, policyType, frameworksSelected, `${gdprCacheKey}:filtered`)
    : gdprRulesToFilter;
  const filteredAiActRules = policyType || frameworksSelected
    ? filterRulesByPolicyType(aiActRulesToFilter, policyType, frameworksSelected, `${aiActCacheKey}:filtered`)
    : aiActRulesToFilter;
  const filteredIsoRules = policyType || frameworksSelected
    ? filterRulesByPolicyType(isoRulesToFilter, policyType, frameworksSelected, `${isoCacheKey}:filtered`)
    : isoRulesToFilter;

  // Prioritize rules based on section context (if section name provided)
  const prioritizedGdprRules = sectionName
    ? prioritizeRulesBySection(filteredGdprRules, sectionName)
    : filteredGdprRules;
  const prioritizedAiActRules = sectionName
    ? prioritizeRulesBySection(filteredAiActRules, sectionName)
    : filteredAiActRules;
  const prioritizedIsoRules = sectionName
    ? prioritizeRulesBySection(filteredIsoRules, sectionName)
    : filteredIsoRules;

  // Check GDPR rules with context-aware matching
  const gdprMatches = prioritizedGdprRules.map(
    (rule) => checkRuleWithContext(rule, contentLower, sectionName).matched
  );
  const gdprCoverage = calculateCoverage(gdprMatches, filteredGdprRules);

  // Check AI Act rules with context-aware matching
  const aiActMatches = prioritizedAiActRules.map(
    (rule) => checkRuleWithContext(rule, contentLower, sectionName).matched
  );
  const aiActCoverage = calculateCoverage(aiActMatches, filteredAiActRules);

  // Check ISO 42001 rules with context-aware matching
  const isoMatches = prioritizedIsoRules.map(
    (rule) => checkRuleWithContext(rule, contentLower, sectionName).matched
  );
  const isoCoverage = calculateCoverage(isoMatches, filteredIsoRules);

  // Find missing clauses (required ones that weren't found)
  // Filter ALL_RULES by applicability first (if context provided)
  let allRulesToFilter = ALL_RULES;
  const allRulesCacheKey = `${cacheKey}:ALL`;
  if (applicabilityContext) {
    allRulesToFilter = filterRulesByApplicability(ALL_RULES, applicabilityContext, allRulesCacheKey);
  }

  // Then filter by policy type and frameworks_selected override
  const filteredAllRules = policyType || frameworksSelected
    ? filterRulesByPolicyType(allRulesToFilter, policyType, frameworksSelected, `${allRulesCacheKey}:filtered`)
    : allRulesToFilter;

  const missingClauses = filteredAllRules.filter((rule) => {
    if (!rule.required) return false;
    
    // Check section eligibility: if rule has section_ids, only check if section matches
    if (normalizedSectionName && !isRuleEligibleForSection(rule, normalizedSectionName, normalizedSectionNames)) {
      return false; // Skip this rule - not eligible for this section
    }
    
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
 * Content analysis accumulator
 * Processes content once and stores all keyword/article positions for reuse
 */
type ContentAnalysisAccumulator = {
  normalizedContent: string;
  windows: string[];
  allKeywordPositions: Map<string, Array<{ keyword: string; position: number; windowIndex: number }>>;
  allArticlePositions: Map<string, Array<{ position: number; windowIndex: number }>>;
};

/**
 * Build content analysis accumulator in single pass
 * Processes content once and stores positions for all keywords and article refs
 */
function buildContentAccumulator(
  content: string,
  allRules: ComplianceRule[]
): ContentAnalysisAccumulator {
  const normalizedContent = content.toLowerCase().replace(/\s+/g, " ");
  const windows = splitIntoContextWindows(normalizedContent, WINDOW_SIZES.STANDARD);
  
  // Collect all unique keywords and article refs from all rules
  const allKeywords = new Set<string>();
  const allArticleRefs = new Map<string, { ref: string; framework: "GDPR" | "AI_ACT" | "ISO_42001" }>();
  
  for (const rule of allRules) {
    // Add all keywords from this rule
    for (const keyword of rule.keywords) {
      const expanded = expandKeyword(keyword);
      expanded.forEach(kw => allKeywords.add(kw));
    }
    
    // Add article ref
    const key = `${rule.framework}:${rule.article_ref}`;
    if (!allArticleRefs.has(key)) {
      allArticleRefs.set(key, { ref: rule.article_ref, framework: rule.framework });
    }
  }
  
  // Find positions for all keywords in single pass
  const allKeywordPositions = new Map<string, Array<{ keyword: string; position: number; windowIndex: number }>>();
  for (const keyword of allKeywords) {
    const positions = findKeywordPositions([keyword], normalizedContent, windows);
    if (positions.length > 0) {
      allKeywordPositions.set(keyword, positions);
    }
  }
  
  // Find positions for all article refs in single pass
  const allArticlePositions = new Map<string, Array<{ position: number; windowIndex: number }>>();
  for (const [key, { ref, framework }] of allArticleRefs.entries()) {
    const positions = findArticlePositions(ref, framework, normalizedContent, windows);
    if (positions.length > 0) {
      allArticlePositions.set(key, positions);
    }
  }
  
  return {
    normalizedContent,
    windows,
    allKeywordPositions,
    allArticlePositions,
  };
}

/**
 * Check rule using pre-built accumulator (optimized single-pass)
 */
function checkRuleWithAccumulator(
  rule: ComplianceRule,
  accumulator: ContentAnalysisAccumulator,
  sectionName?: string
): boolean {
  // Collect keyword positions for this rule from accumulator
  const keywordPositions: Array<{ keyword: string; position: number; windowIndex: number }> = [];
  for (const keyword of rule.keywords) {
    const expanded = expandKeyword(keyword);
    for (const expandedKeyword of expanded) {
      const positions = accumulator.allKeywordPositions.get(expandedKeyword);
      if (positions) {
        keywordPositions.push(...positions);
      }
    }
  }
  
  // Get article positions from accumulator
  const articleKey = `${rule.framework}:${rule.article_ref}`;
  const articlePositions = accumulator.allArticlePositions.get(articleKey) || [];
  
  // Use existing checkProximity and checkKeywordCoOccurrence logic
  const proximityResult = checkProximity(
    keywordPositions,
    articlePositions,
    WINDOW_SIZES.MAX_DISTANCE
  );
  
  const coOccurrenceResult = checkKeywordCoOccurrence(
    rule.keywords,
    accumulator.normalizedContent,
    accumulator.windows
  );
  
  // Build match results using extracted functions
  const proximityMatch = checkProximityMatch(
    keywordPositions,
    articlePositions,
    proximityResult
  );
  
  const keywordMatch = checkKeywordCoOccurrenceMatch(rule, coOccurrenceResult);
  
  return combineMatchResults(proximityMatch, keywordMatch, articlePositions);
}

/**
 * Analyzes policy content against compliance rules
 * Now includes section-level scoring
 * Uses single-pass content analysis for performance optimization
 * 
 * @param policyContent - The policy content to analyze
 * @param policyType - Optional policy type to filter rules by framework scope
 *                     If not provided, checks all frameworks (legacy behavior)
 * @param options - Optional metadata/options object containing frameworks_selected override and applicabilityContext
 */
export function analyzePolicyCompliance(
  policyContent: string,
  policyType?: PolicyType,
  options?: {
    frameworks_selected?: string[];
    applicabilityContext?: RuleApplicability;
  }
): PolicyCopResult {
  const contentLower = policyContent.toLowerCase();
  const frameworksSelected = options?.frameworks_selected;
  const applicabilityContext = options?.applicabilityContext;

  // TODO: Deprecate behavior when policyType is missing
  // In future versions, policyType should be required
  if (!policyType) {
    // Keep current behavior (check all frameworks) for backward compatibility
  }

  // Parse policy into sections
  const sections = parsePolicySections(policyContent);
  
  // Build list of normalized section names for cross-section matching
  const normalizedSectionNames = sections.map(s => s.normalizedName);

  // Generate cache key for this combination
  const cacheKey = generateRulesCacheKey(policyType, applicabilityContext, frameworksSelected);
  const gdprCacheKey = `${cacheKey}:GDPR`;
  const aiActCacheKey = `${cacheKey}:AI_ACT`;
  const isoCacheKey = `${cacheKey}:ISO_42001`;

  // Analyze each section with context-aware matching
  const sectionScores = sections.map((section) => ({
    section_name: section.name,
    ...analyzeSectionCompliance(section.content, section.name, policyType, normalizedSectionNames, frameworksSelected, applicabilityContext),
  }));

  // Filter rules by applicability FIRST (if context provided)
  let gdprRulesToFilter = GDPR_RULES;
  let aiActRulesToFilter = AI_ACT_RULES;
  let isoRulesToFilter = ISO_42001_RULES;

  if (applicabilityContext) {
    gdprRulesToFilter = filterRulesByApplicability(GDPR_RULES, applicabilityContext, gdprCacheKey);
    aiActRulesToFilter = filterRulesByApplicability(AI_ACT_RULES, applicabilityContext, aiActCacheKey);
    isoRulesToFilter = filterRulesByApplicability(ISO_42001_RULES, applicabilityContext, isoCacheKey);
  }

  // Then filter by policy type and frameworks_selected override
  const filteredGdprRules = policyType || frameworksSelected
    ? filterRulesByPolicyType(gdprRulesToFilter, policyType, frameworksSelected, `${gdprCacheKey}:filtered`)
    : gdprRulesToFilter;
  const filteredAiActRules = policyType || frameworksSelected
    ? filterRulesByPolicyType(aiActRulesToFilter, policyType, frameworksSelected, `${aiActCacheKey}:filtered`)
    : aiActRulesToFilter;
  const filteredIsoRules = policyType || frameworksSelected
    ? filterRulesByPolicyType(isoRulesToFilter, policyType, frameworksSelected, `${isoCacheKey}:filtered`)
    : isoRulesToFilter;

  // Build content accumulator once for all rules (single-pass optimization)
  const allFilteredRules = [...filteredGdprRules, ...filteredAiActRules, ...filteredIsoRules];
  const accumulator = buildContentAccumulator(contentLower, allFilteredRules);

  // Calculate overall scores using accumulator (single-pass)
  const gdprMatches = filteredGdprRules.map((rule) =>
    checkRuleWithAccumulator(rule, accumulator)
  );
  const gdprCoverage = calculateCoverage(gdprMatches, filteredGdprRules);

  const aiActMatches = filteredAiActRules.map((rule) =>
    checkRuleWithAccumulator(rule, accumulator)
  );
  const aiActCoverage = calculateCoverage(aiActMatches, filteredAiActRules);

  const isoMatches = filteredIsoRules.map((rule) =>
    checkRuleWithAccumulator(rule, accumulator)
  );
  const isoCoverage = calculateCoverage(isoMatches, filteredIsoRules);

  // Find missing clauses (required ones that weren't found)
  // Filter ALL_RULES by applicability first (if context provided)
  let allRulesToFilter = ALL_RULES;
  const allRulesCacheKey = `${cacheKey}:ALL`;
  if (applicabilityContext) {
    allRulesToFilter = filterRulesByApplicability(ALL_RULES, applicabilityContext, allRulesCacheKey);
  }

  // Then filter by policy type and frameworks_selected override
  const filteredAllRules = policyType || frameworksSelected
    ? filterRulesByPolicyType(allRulesToFilter, policyType, frameworksSelected, `${allRulesCacheKey}:filtered`)
    : allRulesToFilter;

  // Filter rules based on section eligibility: keep a rule if:
  // - getClauseEligibleSections(rule) returns empty array (no section restriction), OR
  // - At least one of its section_ids normalized matches one of the normalizedSectionNames entries
  const filteredRules = filteredAllRules.filter((rule) => {
    const eligibleSections = getClauseEligibleSections(rule);
    
    // If no section_ids defined, rule is eligible everywhere (backward compatible)
    if (eligibleSections.length === 0) {
      return true;
    }
    
    // Rule has section_ids - check if any eligible section matches policy sections
    const normalizedEligibleSections = eligibleSections.map(normalizeSectionName);
    return normalizedSectionNames.some(policySectionName => {
      return normalizedEligibleSections.some(eligibleSection => {
        // Exact or substring match
        return policySectionName === eligibleSection || 
               policySectionName.includes(eligibleSection) || 
               eligibleSection.includes(policySectionName);
      });
    });
  });

  // Categorize rules by mandatory status
  const { hardMandatory, softRequired } = categorizeRules(filteredRules);

  // Compute missing clauses using filteredRules
  const missingClauses = filteredRules.filter((rule) => {
    if (!rule.required) return false;
    
    // Rule is eligible - check if it's present in the policy
    const matched = checkRuleWithContext(rule, contentLower).matched;
    return !matched;
  }).map((rule) => ({
    framework: rule.framework,
    article_ref: rule.article_ref,
    clause_text: rule.clause_text,
    required: rule.required,
  }));

  // Track missing hard mandatory clauses separately
  const missingMandatoryClauses = hardMandatory
    .filter((rule) => {
      const matched = checkRuleWithContext(rule, contentLower).matched;
      return !matched;
    })
    .map((rule) => ({
      framework: rule.framework,
      article_ref: rule.article_ref,
      clause_text: rule.clause_text,
    }));

  // Track missing soft required clauses separately
  const missingRequiredClauses = softRequired
    .filter((rule) => {
      const matched = checkRuleWithContext(rule, contentLower).matched;
      return !matched;
    })
    .map((rule) => ({
      framework: rule.framework,
      article_ref: rule.article_ref,
      clause_text: rule.clause_text,
    }));

  return {
    gdpr_coverage: Math.round(gdprCoverage * 100) / 100,
    ai_act_coverage: Math.round(aiActCoverage * 100) / 100,
    iso_42001_coverage: Math.round(isoCoverage * 100) / 100,
    missing_clauses: missingClauses,
    missing_mandatory_clauses: missingMandatoryClauses.length > 0 ? missingMandatoryClauses : undefined,
    missing_required_clauses: missingRequiredClauses.length > 0 ? missingRequiredClauses : undefined,
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
 * Uses regex cache to avoid recompiling patterns
 */
function createFuzzyPattern(keyword: string): RegExp {
  // Escape special regex characters
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = `\\b${escaped}\\b`;
  
  // Get from cache or create new
  return regexCache.get(pattern, "gi");
}

/**
 * Checks if a keyword matches in content using word boundary matching
 * with support for variations and fuzzy matching
 * Uses regex cache for performance optimization
 */
function matchKeyword(keyword: string, content: string): boolean {
  // Expand keyword to include variations
  const expandedKeywords = expandKeyword(keyword);

  // Try exact word boundary match first (most reliable)
  for (const expandedKeyword of expandedKeywords) {
    // Escape and create pattern
    const escaped = expandedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = `\\b${escaped}\\b`;
    
    // Get regex from cache
    const exactPattern = regexCache.get(pattern, "i");
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
 * Uses regex cache for performance optimization
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

    // Get regex from cache
    const patternKey = `\\b${regexPattern}\\b`;
    const regex = regexCache.get(patternKey, "i");
    if (regex.test(normalizedContent)) {
      return true;
    }

    // Also try without word boundaries for cases like "Art.6" (no space)
    const loosePattern = pattern.replace(/\s+/g, "\\s*");
    const loosePatternKey = loosePattern;
    const looseRegex = regexCache.get(loosePatternKey, "i");
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
  windowSize: number = WINDOW_SIZES.STANDARD
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
 * More lenient: allows matches when keywords OR article refs are found (scored lower)
 */
function checkProximity(
  keywordPositions: Array<{
    keyword: string;
    position: number;
    windowIndex: number;
  }>,
  articlePositions: Array<{ position: number; windowIndex: number }>,
  maxDistance: number = WINDOW_SIZES.MAX_DISTANCE
): { matched: boolean; score: number } {
  if (keywordPositions.length === 0 && articlePositions.length === 0) {
    return { matched: false, score: 0 };
  }

  // Check if any keyword and article ref appear in the same window (strongest match)
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

  // If we have keywords but no article refs, give partial score (clause might be addressed)
  if (keywordPositions.length > 0 && articlePositions.length === 0) {
    return { matched: false, score: CO_OCCURRENCE_THRESHOLDS.KEYWORD_ONLY }; // Partial score - keywords found
  }

  // If we have article refs but no keywords, give partial score (might be in mapping appendix)
  if (articlePositions.length > 0 && keywordPositions.length === 0) {
    return { matched: false, score: CO_OCCURRENCE_THRESHOLDS.STRONG }; // Lower score - only article ref
  }

  // Match if we found keywords AND article refs in proximity
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
 * Check if keywords and article references appear in proximity
 * Returns match result with proximity information
 */
function checkProximityMatch(
  keywordPositions: Array<{ keyword: string; position: number; windowIndex: number }>,
  articlePositions: Array<{ position: number; windowIndex: number }>,
  proximityResult: { matched: boolean; score: number }
): {
  hasProximityMatch: boolean;
  hasNearbyMatch: boolean;
  hasKeywordsAndRefsInDocument: boolean;
} {
  const hasArticleRefs = articlePositions.length > 0;
  const hasKeywords = keywordPositions.length > 0;
  const hasKeywordsAndRefsInDocument = hasKeywords && hasArticleRefs;
  
  // Check if keywords and article refs are in exact proximity
  const hasProximityMatch = proximityResult.matched && hasKeywords && hasArticleRefs;
  
  // Check if keywords and article refs are within nearby windows
  let hasNearbyMatch = false;
  if (hasKeywords && hasArticleRefs) {
    const keywordWindowIndices = new Set(keywordPositions.map(p => p.windowIndex));
    const articleWindowIndices = new Set(articlePositions.map(p => p.windowIndex));
    
    for (const kwIdx of keywordWindowIndices) {
      for (const artIdx of articleWindowIndices) {
        if (Math.abs(kwIdx - artIdx) <= WINDOW_SIZES.NEARBY_DISTANCE) {
          hasNearbyMatch = true;
          break;
        }
      }
      if (hasNearbyMatch) break;
    }
  }
  
  return {
    hasProximityMatch,
    hasNearbyMatch,
    hasKeywordsAndRefsInDocument,
  };
}

/**
 * Check keyword co-occurrence match requirements
 * Returns whether keywords meet co-occurrence thresholds
 */
function checkKeywordCoOccurrenceMatch(
  rule: ComplianceRule,
  coOccurrenceResult: { matchedKeywords: string[]; coOccurrenceScore: number }
): {
  hasKeywordsWithCoOccurrence: boolean;
  hasMinKeywords: boolean;
  hasStrongKeywordPresence: boolean;
  hasKeywordOnlyMatch: boolean;
  hasKeywords: boolean;
  hasArticleRefs: boolean;
} {
  const isComplexRule = rule.keywords.length >= 5;
  const minCoOccurrenceThreshold = isComplexRule 
    ? CO_OCCURRENCE_THRESHOLDS.COMPLEX 
    : CO_OCCURRENCE_THRESHOLDS.SIMPLE;
  
  const minKeywordCount = rule.required 
    ? KEYWORD_THRESHOLDS.REQUIRED 
    : KEYWORD_THRESHOLDS.OPTIONAL;
  
  const hasKeywordsWithCoOccurrence =
    coOccurrenceResult.coOccurrenceScore >= minCoOccurrenceThreshold;
  const hasMinKeywords = 
    coOccurrenceResult.matchedKeywords.length >= minKeywordCount;
  
  const hasStrongKeywordPresence =
    coOccurrenceResult.coOccurrenceScore >= CO_OCCURRENCE_THRESHOLDS.STRONG &&
    coOccurrenceResult.matchedKeywords.length >= Math.max(
      KEYWORD_THRESHOLDS.OPTIONAL, 
      Math.ceil(rule.keywords.length * KEYWORD_THRESHOLDS.KEYWORD_ONLY_PERCENTAGE)
    );
  
  // Keyword-only match (no article refs needed)
  const hasKeywordOnlyMatch =
    coOccurrenceResult.coOccurrenceScore >= CO_OCCURRENCE_THRESHOLDS.KEYWORD_ONLY &&
    coOccurrenceResult.matchedKeywords.length >= Math.max(
      KEYWORD_THRESHOLDS.REQUIRED, 
      Math.ceil(rule.keywords.length * KEYWORD_THRESHOLDS.KEYWORD_ONLY_PERCENTAGE)
    );
  
  return {
    hasKeywordsWithCoOccurrence,
    hasMinKeywords,
    hasStrongKeywordPresence,
    hasKeywordOnlyMatch,
    hasKeywords: coOccurrenceResult.matchedKeywords.length > 0,
    hasArticleRefs: false, // Will be set by caller
  };
}

/**
 * Combine all match results to determine final match status
 */
function combineMatchResults(
  proximityMatch: {
    hasProximityMatch: boolean;
    hasNearbyMatch: boolean;
    hasKeywordsAndRefsInDocument: boolean;
  },
  keywordMatch: {
    hasKeywordsWithCoOccurrence: boolean;
    hasMinKeywords: boolean;
    hasStrongKeywordPresence: boolean;
    hasKeywordOnlyMatch: boolean;
    hasKeywords: boolean;
    hasArticleRefs: boolean;
  },
  articlePositions: Array<{ position: number; windowIndex: number }>
): boolean {
  const hasArticleRefs = articlePositions.length > 0;
  const hasKeywords = keywordMatch.hasKeywords;
  
  // Update hasArticleRefs in keywordMatch result
  keywordMatch.hasArticleRefs = hasArticleRefs;
  
  // Full match: proximity/nearby + co-occurrence + minimum keywords
  const hasFullMatch =
    (proximityMatch.hasProximityMatch || proximityMatch.hasNearbyMatch) &&
    keywordMatch.hasKeywordsWithCoOccurrence &&
    keywordMatch.hasMinKeywords;
  
  // Partial match: keywords and refs in document + co-occurrence + minimum keywords
  const hasPartialMatch =
    proximityMatch.hasKeywordsAndRefsInDocument &&
    keywordMatch.hasKeywordsWithCoOccurrence &&
    keywordMatch.hasMinKeywords;
  
  // Strong keyword presence (even without article refs)
  const hasStrongKeywordPresence = 
    hasKeywords &&
    keywordMatch.hasStrongKeywordPresence;
  
  // Keyword-only match (no article refs)
  const hasKeywordOnlyMatch =
    hasKeywords &&
    !hasArticleRefs &&
    keywordMatch.hasKeywordOnlyMatch;
  
  return hasFullMatch || hasPartialMatch || hasStrongKeywordPresence || hasKeywordOnlyMatch;
}

/**
 * Context-aware rule checking with proximity-based matching
 * Checks if keywords appear within same paragraph (or standard word window)
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

  // Split content into context windows (paragraphs or standard word chunks)
  const windows = splitIntoContextWindows(normalizedContent, WINDOW_SIZES.STANDARD);

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
    WINDOW_SIZES.MAX_DISTANCE
  );

  // Check keyword co-occurrence for semantic relationship detection
  const coOccurrenceResult = checkKeywordCoOccurrence(
    rule.keywords,
    normalizedContent,
    windows
  );

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

  // Check proximity match
  const proximityMatch = checkProximityMatch(
    keywordPositions,
    articlePositions,
    proximityResult
  );

  // Check keyword co-occurrence match
  const keywordMatch = checkKeywordCoOccurrenceMatch(rule, coOccurrenceResult);

  // Combine all match results
  const matched = combineMatchResults(proximityMatch, keywordMatch, articlePositions);

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
        // RELAXED: Reduced threshold from 3/0.6 to 2/0.4
        return (
          matchedKeywords.length >=
          Math.max(2, Math.ceil(rule.keywords.length * 0.4))
        );
      }
    }
    return true;
  }

  // For stronger keyword matching without article refs
  // Require multiple keywords AND substantial content
  // RELAXED: Significantly reduced thresholds for better matching
  if (keywordMatch && !articleMatch) {
    // Different thresholds for required vs optional rules
    const minKeywords = rule.required 
      ? KEYWORD_THRESHOLDS.REQUIRED 
      : KEYWORD_THRESHOLDS.OPTIONAL;
    const percentageThreshold = rule.required 
      ? KEYWORD_THRESHOLDS.REQUIRED_PERCENTAGE 
      : KEYWORD_THRESHOLDS.OPTIONAL_PERCENTAGE;
    const keywordThreshold = Math.max(
      minKeywords,
      Math.ceil(rule.keywords.length * percentageThreshold)
    );

    if (matchedKeywords.length < keywordThreshold) {
      return false;
    }

    // Verify keywords aren't just isolated mentions
    // Check for keyword density - matched keywords should appear in proximity
    const windows = splitIntoContextWindows(normalizedContent, WINDOW_SIZES.EXTENDED);
    let maxKeywordsInWindow = 0;

    for (const window of windows) {
      const keywordsInWindow = matchedKeywords.filter((kw) =>
        window.toLowerCase().includes(kw.toLowerCase())
      ).length;
      maxKeywordsInWindow = Math.max(maxKeywordsInWindow, keywordsInWindow);
    }

    // Require at least minimum density of matched keywords to appear in same context window
    const densityThreshold = Math.ceil(matchedKeywords.length * CONTENT_THRESHOLDS.KEYWORD_DENSITY);
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

// ============================================================================
// Quality Scoring & Validation
// ============================================================================

export type QualityScoreResult = {
  score: number; // 0-1 score
  issues: string[];
  checks: {
    structuredFormat: boolean;
    metajsonValid: boolean;
    frameworkReferences: {
      count: number;
      isValid: boolean;
    };
    coverageThresholds: {
      meetsThresholds: boolean;
      details: {
        framework: string;
        coverage: number;
        threshold: number;
        meets: boolean;
      }[];
    };
    placeholderCount: number;
  };
};

/**
 * Calculate quality score for a policy output
 * Checks: structured format presence, METAJSON validity, framework reference count,
 * PolicyCop coverage thresholds, placeholder count
 * Returns score (0-1) and list of issues
 */
export function calculateQualityScore(
  rawContent: string,
  policyType: PolicyType,
  policyCopResult?: PolicyCopResult,
  applicabilityContext?: RuleApplicability
): QualityScoreResult {
  const issues: string[] = [];
  const checks = {
    structuredFormat: false,
    metajsonValid: false,
    frameworkReferences: {
      count: 0,
      isValid: false,
    },
    coverageThresholds: {
      meetsThresholds: false,
      details: [] as {
        framework: string;
        coverage: number;
        threshold: number;
        meets: boolean;
      }[],
    },
    placeholderCount: 0,
  };

  // Parse the policy output to check structured format
  const parsed = parsePolicyOutput(rawContent);
  checks.structuredFormat = parsed.hasStructure;

  if (!checks.structuredFormat) {
    issues.push("Policy output does not follow structured format (missing POLICY-MARKDOWN block)");
  }

  // Check METAJSON validity
  if (parsed.metadata) {
    try {
      // Basic validation: check if metadata has required fields
      const metadata = parsed.metadata;
      checks.metajsonValid = true;

      // Validate metadata structure
      if (!metadata.policy_type && !metadata.frameworks_selected) {
        issues.push("METAJSON missing policy_type or frameworks_selected");
        checks.metajsonValid = false;
      }
    } catch (e) {
      issues.push(`METAJSON parsing failed: ${e instanceof Error ? e.message : String(e)}`);
      checks.metajsonValid = false;
    }
  } else {
    issues.push("METAJSON block missing or invalid");
    checks.metajsonValid = false;
  }

  // Count framework references in content
  const mappings = extractMappings(parsed.content || rawContent);
  checks.frameworkReferences.count = mappings.length;
  
  // Consider framework references valid if we have at least some references
  // Minimum threshold for a good policy
  checks.frameworkReferences.isValid = checks.frameworkReferences.count >= FRAMEWORK_REFERENCES.MINIMUM_COUNT;

  if (!checks.frameworkReferences.isValid) {
    issues.push(
      `Insufficient framework references found: ${checks.frameworkReferences.count} (minimum: ${FRAMEWORK_REFERENCES.MINIMUM_COUNT})`
    );
  }

  // Check PolicyCop coverage thresholds (if PolicyCop result provided)
  if (policyCopResult) {
    const thresholds = getPolicyThresholds(policyType, applicabilityContext);
    const coverageDetails: {
      framework: string;
      coverage: number;
      threshold: number;
      meets: boolean;
    }[] = [];

    // Check GDPR coverage
    if (policyCopResult.gdpr_coverage !== undefined) {
      const meets = policyCopResult.gdpr_coverage >= thresholds.gdpr;
      coverageDetails.push({
        framework: "GDPR",
        coverage: policyCopResult.gdpr_coverage,
        threshold: thresholds.gdpr,
        meets,
      });
      if (!meets) {
        issues.push(
          `GDPR coverage ${(policyCopResult.gdpr_coverage * 100).toFixed(1)}% below threshold ${(thresholds.gdpr * 100).toFixed(0)}%`
        );
      }
    }

    // Check AI Act coverage (skip if threshold is 0)
    if (thresholds.ai_act > 0 && policyCopResult.ai_act_coverage !== undefined) {
      const meets = policyCopResult.ai_act_coverage >= thresholds.ai_act;
      coverageDetails.push({
        framework: "AI_ACT",
        coverage: policyCopResult.ai_act_coverage,
        threshold: thresholds.ai_act,
        meets,
      });
      if (!meets) {
        issues.push(
          `AI Act coverage ${(policyCopResult.ai_act_coverage * 100).toFixed(1)}% below threshold ${(thresholds.ai_act * 100).toFixed(0)}%`
        );
      }
    }

    // Check ISO 42001 coverage
    if (policyCopResult.iso_42001_coverage !== undefined) {
      const meets = policyCopResult.iso_42001_coverage >= thresholds.iso_42001;
      coverageDetails.push({
        framework: "ISO_42001",
        coverage: policyCopResult.iso_42001_coverage,
        threshold: thresholds.iso_42001,
        meets,
      });
      if (!meets) {
        issues.push(
          `ISO 42001 coverage ${(policyCopResult.iso_42001_coverage * 100).toFixed(1)}% below threshold ${(thresholds.iso_42001 * 100).toFixed(0)}%`
        );
      }
    }

    checks.coverageThresholds.details = coverageDetails;
    checks.coverageThresholds.meetsThresholds = coverageDetails.every((d) => d.meets);
  } else {
    issues.push("PolicyCop analysis not provided - cannot validate coverage thresholds");
  }

  // Count placeholders
  const placeholders = detectPlaceholders(parsed.content || rawContent);
  checks.placeholderCount = placeholders.length;

  // Placeholders are acceptable but should be noted
  if (checks.placeholderCount > 0) {
    issues.push(
      `Policy contains ${checks.placeholderCount} placeholder(s) requiring action`
    );
  }

  // Calculate overall quality score (0-1)
  // Weighted scoring:
  // - Structured format: 20%
  // - METAJSON validity: 20%
  // - Framework references: 20%
  // - Coverage thresholds: 30%
  // - Placeholders: 10% (penalty for excessive placeholders)

  let score = 0;

  // Structured format (20%)
  if (checks.structuredFormat) {
    score += 0.2;
  }

  // METAJSON validity (20%)
  if (checks.metajsonValid) {
    score += 0.2;
  }

  // Framework references (20%)
  // Score based on reference count (normalized to 0-0.2)
  // Ensures minimum 0.1 for 5+ references (meeting minimum threshold)
  const refScore = Math.min(0.2, Math.max(0.1, (checks.frameworkReferences.count / 10) * 0.2));
  score += refScore;

  // Coverage thresholds (30%)
  if (policyCopResult && checks.coverageThresholds.details.length > 0) {
    const coverageScore = checks.coverageThresholds.details.reduce((sum, d) => {
      return sum + (d.meets ? d.coverage / d.threshold : Math.max(0.3, d.coverage / d.threshold * 0.7));
    }, 0) / checks.coverageThresholds.details.length;
    score += Math.min(0.3, coverageScore * 0.3);
  } else {
    // If no PolicyCop result, don't penalize (assume 0.15 for neutral)
    score += 0.15;
  }

  // Placeholders (10% penalty)
  // Fewer placeholders = better score
  const placeholderPenalty = Math.min(0.1, (checks.placeholderCount / 10) * 0.1);
  score += Math.max(0, 0.1 - placeholderPenalty);

  // Ensure score is between 0 and 1
  score = Math.max(0, Math.min(1, score));

  return {
    score,
    issues,
    checks,
  };
}

export type PolicyQualityValidationResult = {
  isValid: boolean;
  qualityScore: number;
  issues: string[];
  warnings: string[];
  policyCopResult: PolicyCopResult;
  qualityChecks: QualityScoreResult["checks"];
  actionableFeedback: string[];
};

/**
 * Validate policy quality by combining PolicyCop analysis with quality checks
 * Returns comprehensive validation result with actionable feedback
 * Checks coverage against policy-specific thresholds with 10% margin
 */
export function validatePolicyQuality(
  policyContent: string,
  policyType: PolicyType,
  options?: {
    frameworks_selected?: string[];
    applicabilityContext?: RuleApplicability;
  }
): PolicyQualityValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const actionableFeedback: string[] = [];
  const applicabilityContext = options?.applicabilityContext;

  // Run PolicyCop analysis
  const policyCopResult = analyzePolicyCompliance(policyContent, policyType, options);

  // Calculate quality score
  const qualityScoreResult = calculateQualityScore(
    policyContent,
    policyType,
    policyCopResult,
    applicabilityContext
  );

  // Get policy-specific thresholds (dynamic if applicability context provided)
  const thresholds = getPolicyThresholds(policyType, applicabilityContext);
  const thresholdMargin = 0.1; // 10% margin

  // Check coverage against thresholds with margin
  const adjustedThresholds = {
    gdpr: thresholds.gdpr * (1 - thresholdMargin),
    ai_act: thresholds.ai_act * (1 - thresholdMargin),
    iso_42001: thresholds.iso_42001 * (1 - thresholdMargin),
  };

  // Validate GDPR coverage
  if (policyCopResult.gdpr_coverage < adjustedThresholds.gdpr) {
    const shortfall = ((adjustedThresholds.gdpr - policyCopResult.gdpr_coverage) * 100).toFixed(1);
    issues.push(
      `GDPR coverage ${(policyCopResult.gdpr_coverage * 100).toFixed(1)}% is below threshold ${(adjustedThresholds.gdpr * 100).toFixed(1)}% (shortfall: ${shortfall}%)`
    );
    actionableFeedback.push(
      `Improve GDPR coverage by ${shortfall}% - add missing clauses: ${policyCopResult.missing_clauses
        .filter((c) => c.framework === "GDPR")
        .slice(0, 3)
        .map((c) => c.article_ref)
        .join(", ")}`
    );
  } else if (policyCopResult.gdpr_coverage < thresholds.gdpr) {
    warnings.push(
      `GDPR coverage ${(policyCopResult.gdpr_coverage * 100).toFixed(1)}% is below target ${(thresholds.gdpr * 100).toFixed(0)}% but within acceptable margin`
    );
  }

  // Validate AI Act coverage (skip if threshold is 0)
  if (thresholds.ai_act > 0 && policyCopResult.ai_act_coverage < adjustedThresholds.ai_act) {
    const shortfall = ((adjustedThresholds.ai_act - policyCopResult.ai_act_coverage) * 100).toFixed(1);
    issues.push(
      `AI Act coverage ${(policyCopResult.ai_act_coverage * 100).toFixed(1)}% is below threshold ${(adjustedThresholds.ai_act * 100).toFixed(1)}% (shortfall: ${shortfall}%)`
    );
    actionableFeedback.push(
      `Improve AI Act coverage by ${shortfall}% - add missing clauses: ${policyCopResult.missing_clauses
        .filter((c) => c.framework === "AI_ACT")
        .slice(0, 3)
        .map((c) => c.article_ref)
        .join(", ")}`
    );
  } else if (policyCopResult.ai_act_coverage < thresholds.ai_act) {
    warnings.push(
      `AI Act coverage ${(policyCopResult.ai_act_coverage * 100).toFixed(1)}% is below target ${(thresholds.ai_act * 100).toFixed(0)}% but within acceptable margin`
    );
  }

  // Validate ISO 42001 coverage
  if (policyCopResult.iso_42001_coverage < adjustedThresholds.iso_42001) {
    const shortfall = ((adjustedThresholds.iso_42001 - policyCopResult.iso_42001_coverage) * 100).toFixed(1);
    issues.push(
      `ISO 42001 coverage ${(policyCopResult.iso_42001_coverage * 100).toFixed(1)}% is below threshold ${(adjustedThresholds.iso_42001 * 100).toFixed(1)}% (shortfall: ${shortfall}%)`
    );
    actionableFeedback.push(
      `Improve ISO 42001 coverage by ${shortfall}% - add missing clauses: ${policyCopResult.missing_clauses
        .filter((c) => c.framework === "ISO_42001")
        .slice(0, 3)
        .map((c) => c.article_ref)
        .join(", ")}`
    );
  } else if (policyCopResult.iso_42001_coverage < thresholds.iso_42001) {
    warnings.push(
      `ISO 42001 coverage ${(policyCopResult.iso_42001_coverage * 100).toFixed(1)}% is below target ${(thresholds.iso_42001 * 100).toFixed(0)}% but within acceptable margin`
    );
  }

  // Add quality score issues
  if (qualityScoreResult.issues.length > 0) {
    issues.push(...qualityScoreResult.issues);
  }

  // Add actionable feedback based on quality checks
  if (!qualityScoreResult.checks.structuredFormat) {
    actionableFeedback.push(
      "Ensure policy output follows structured format with POLICY-MARKDOWN block delimiters"
    );
  }

  if (!qualityScoreResult.checks.metajsonValid) {
    actionableFeedback.push(
      "Include valid METAJSON block with policy_type, frameworks_selected, and sections metadata"
    );
  }

  if (!qualityScoreResult.checks.frameworkReferences.isValid) {
    actionableFeedback.push(
      `Add more framework references (currently ${qualityScoreResult.checks.frameworkReferences.count}, minimum: 5)`
    );
  }

  if (qualityScoreResult.checks.placeholderCount > 0) {
    actionableFeedback.push(
      `Replace ${qualityScoreResult.checks.placeholderCount} placeholder(s) with actual data from questionnaire`
    );
  }

  // Check for missing hard mandatory clauses (fail validation if any are missing)
  const hasMissingMandatoryClauses = 
    policyCopResult.missing_mandatory_clauses && 
    policyCopResult.missing_mandatory_clauses.length > 0;

  if (hasMissingMandatoryClauses) {
    const mandatoryClauses = policyCopResult.missing_mandatory_clauses!;
    issues.push(
      `Missing ${mandatoryClauses.length} mandatory clause(s) that must be present: ${mandatoryClauses
        .slice(0, 5)
        .map((c) => `${c.framework} ${c.article_ref}`)
        .join(", ")}${mandatoryClauses.length > 5 ? "..." : ""}`
    );
    actionableFeedback.push(
      `CRITICAL: Add missing mandatory clauses: ${mandatoryClauses
        .slice(0, 3)
        .map((c) => `${c.framework} ${c.article_ref} - ${c.clause_text.substring(0, 50)}`)
        .join("; ")}`
    );
  }

  // Determine overall validity
  // Policy is valid if:
  // - Quality score meets minimum threshold
  // - All coverage thresholds met (with margin)
  // - No missing hard mandatory clauses
  // - No critical structural issues
  const isValid =
    !hasMissingMandatoryClauses &&
    qualityScoreResult.score >= QUALITY_THRESHOLDS.MINIMUM &&
    policyCopResult.gdpr_coverage >= adjustedThresholds.gdpr &&
    policyCopResult.ai_act_coverage >= adjustedThresholds.ai_act &&
    policyCopResult.iso_42001_coverage >= adjustedThresholds.iso_42001 &&
    qualityScoreResult.checks.structuredFormat &&
    qualityScoreResult.checks.metajsonValid;

  return {
    isValid,
    qualityScore: qualityScoreResult.score,
    issues,
    warnings,
    policyCopResult,
    qualityChecks: qualityScoreResult.checks,
    actionableFeedback,
  };
}
