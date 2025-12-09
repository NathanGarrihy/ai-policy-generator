/**
 * PolicyCop Applicability Tests
 *
 * Tests questionnaire-driven applicability logic and dynamic thresholds
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

describe("PolicyCop Applicability", () => {
  it("should build applicability context from privacy questionnaire", () => {
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

    expect(privacyContext).toBeDefined();
    expect(privacyContext.hasInternationalTransfers).toBe(false);
    expect(privacyContext.usesThirdPartyProcessors).toBe(false);
    expect(privacyContext.processesSpecialCategoryData).toBe(false);
    expect(privacyContext.hasHighRiskProcessing).toBe(false);
  });

  it("should build applicability context from AI usage questionnaire", () => {
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

    expect(aiUsageContext).toBeDefined();
    expect(aiUsageContext.usesAIForPersonalData).toBe(true);
    expect(aiUsageContext.deploysHighRiskAI).toBe(true);
  });

  it("should return correct thresholds for different policy types", () => {
    const privacyThresholds = getPolicyThresholds("privacy_policy");
    const aiUsageThresholds = getPolicyThresholds("ai_usage_policy");

    expect(privacyThresholds.gdpr).toBe(0.7);
    expect(privacyThresholds.ai_act).toBe(0);
    expect(privacyThresholds.iso_42001).toBe(0.6);

    expect(aiUsageThresholds.gdpr).toBe(0.3);
    expect(aiUsageThresholds.ai_act).toBe(0.7);
    expect(aiUsageThresholds.iso_42001).toBe(0.7);
  });

  it("should adjust thresholds based on applicability context", () => {
    const context = {
      deploysHighRiskAI: true,
      usesAIForPersonalData: true,
    };

    const privacyHighRiskContext = getPolicyThresholds("privacy_policy", context);

    expect(privacyHighRiskContext).toBeDefined();
    expect(privacyHighRiskContext.gdpr).toBeGreaterThanOrEqual(0);
    expect(privacyHighRiskContext.gdpr).toBeLessThanOrEqual(1);
  });

  it("should detect missing mandatory clauses in minimal policy", () => {
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

    expect(policyCopResult).toBeDefined();
    expect(validation).toBeDefined();
    expect(validation.isValid).toBe(false);
    expect(validation.qualityScore).toBeLessThan(0.8);
  });
});


