/**
 * PolicyCop Applicability Tests
 *
 * These are lightweight, console-driven checks that exercise the
 * questionnaire-driven applicability logic without relying on a
 * specific test framework. Run them manually or wire them into
 * Jest/Vitest as needed.
 */

import {
  buildApplicabilityContext,
  getPolicyThresholds,
  analyzePolicyCompliance,
  validatePolicyQuality,
  type PolicyType,
} from "@/lib/policycop";
import type {
  PrivacyQuestionnaire,
  AIUsageQuestionnaire,
} from "@/lib/types";

/**
 * Exercise RuleApplicability derivation and dynamic thresholds.
 */
export function testPolicyCopApplicability() {
  const privacyAnswers: PrivacyQuestionnaire = {
    company_name: "TestCo",
    jurisdictions: ["GDPR (EU)"],
    data_collected: ["Email", "Name"],
    purpose_of_processing: "Provide services",
    third_parties: "No",
    cookies_used: "Yes",
    data_retention: "1 year",
    dpo_contact: "privacy@testco.io",
  };

  const privacyContext = buildApplicabilityContext(
    privacyAnswers,
    "privacy_policy"
  );

  console.log("[Applicability] Privacy context", {
    hasInternationalTransfers: privacyContext.hasInternationalTransfers,
    usesThirdPartyProcessors: privacyContext.usesThirdPartyProcessors,
    processesSpecialCategoryData: privacyContext.processesSpecialCategoryData,
    hasHighRiskProcessing: privacyContext.hasHighRiskProcessing,
  });

  const aiUsageAnswers: AIUsageQuestionnaire = {
    company_name: "TestCo",
    ai_used_where: ["support"],
    ai_model_provider: "OpenAI",
    data_sent_to_models: "PII including customer email and name",
    human_oversight_level: "low",
    ai_risk_rating: "high",
    ai_retraining_frequency: "quarterly",
    responsible_person: "CTO",
  };

  const aiUsageContext = buildApplicabilityContext(
    aiUsageAnswers,
    "ai_usage_policy"
  );

  console.log("[Applicability] AI usage context", {
    usesAIForPersonalData: aiUsageContext.usesAIForPersonalData,
    deploysHighRiskAI: aiUsageContext.deploysHighRiskAI,
    usesAutomatedDecisionMaking: aiUsageContext.usesAutomatedDecisionMaking,
  });

  // Dynamic thresholds example: privacy vs AI usage
  const privacyThresholds = getPolicyThresholds("privacy_policy");
  const aiUsageThresholds = getPolicyThresholds("ai_usage_policy");

  const privacyHighRiskContext = getPolicyThresholds("privacy_policy", {
    deploysHighRiskAI: true,
    usesAIForPersonalData: true,
  });

  console.log("[Thresholds] Static privacy", privacyThresholds);
  console.log("[Thresholds] Static ai_usage", aiUsageThresholds);
  console.log("[Thresholds] Privacy with AI context", privacyHighRiskContext);
}

/**
 * Exercise hard-mandatory enforcement with a deliberately weak policy.
 */
export function testMandatoryClauseEnforcement() {
  const policyType: PolicyType = "ai_usage_policy";

  const minimalPolicy = `# AI Usage Policy

This is an intentionally minimal policy for testing.

Last updated: 2024-12-19`;

  const applicabilityContext = {
    usesAIForPersonalData: true,
    deploysHighRiskAI: true,
  };

  const policyCopResult = analyzePolicyCompliance(minimalPolicy, policyType, {
    applicabilityContext,
  });

  const validation = validatePolicyQuality(minimalPolicy, policyType, {
    applicabilityContext,
  });

  console.log("[Mandatory Enforcement] Result", {
    missingMandatoryCount:
      policyCopResult.missing_mandatory_clauses?.length ?? 0,
    isValid: validation.isValid,
    qualityScore: validation.qualityScore.toFixed(3),
    firstIssues: validation.issues.slice(0, 3),
  });
}


