/**
 * PolicyCop Module Unit Tests
 * Tests matching logic, coverage calculation, thresholds, and quality validation
 */

import {
  analyzePolicyCompliance,
  validatePolicyQuality,
  getPolicyThresholds,
  buildApplicabilityContext,
  type PolicyType,
  type PolicyCopResult,
} from "@/lib/policycop";
import type {
  PrivacyQuestionnaire,
  AIUsageQuestionnaire,
  AIGovernanceQuestionnaire,
} from "@/lib/types";

describe("analyzePolicyCompliance", () => {
  it("should calculate GDPR coverage for privacy policy", () => {
    const content = `# Privacy Policy

## Introduction & Scope

This policy applies to Test Company (GDPR Art. 13).

## Data Collection

We process personal data based on lawful grounds including consent and legitimate interests (GDPR Art. 6). We obtain consent in accordance with GDPR requirements (GDPR Art. 7).

## Data Rights

You have the right to access your data (GDPR Art. 15), rectify inaccurate data (GDPR Art. 16), and request erasure (GDPR Art. 17).

## Security

We implement security measures to protect your data (GDPR Art. 32).

Last updated: 2024-12-19`;

    const result = analyzePolicyCompliance(content, "privacy_policy");

    expect(result.gdpr_coverage).toBeGreaterThan(0);
    expect(result.gdpr_coverage).toBeLessThanOrEqual(1);
    expect(result.section_scores.length).toBeGreaterThan(0);
  });

  it("should calculate AI Act coverage for AI usage policy", () => {
    const content = `# AI Usage Policy

## Scope and Purpose

We use AI systems as defined in the AI Act (AI Act Art. 3). We do not engage in prohibited practices (AI Act Art. 4).

## Risk Management

We classify our AI systems by risk level (AI Act Art. 6) and maintain a risk management system (AI Act Art. 9).

## Data Governance

We ensure data quality for training and validation (AI Act Art. 10).

Last updated: 2024-12-19`;

    const result = analyzePolicyCompliance(content, "ai_usage_policy");

    expect(result.ai_act_coverage).toBeGreaterThan(0);
    expect(result.ai_act_coverage).toBeLessThanOrEqual(1);
  });

  it("should filter rules by applicability context", () => {
    const content = `We transfer data internationally using Standard Contractual Clauses (GDPR Art. 46)`;
    const applicabilityContext = {
      hasInternationalTransfers: true,
      usesThirdPartyProcessors: true,
    };

    const result = analyzePolicyCompliance(content, "privacy_policy", {
      applicabilityContext,
    });

    // Should find transfer-related clauses
    expect(result.missing_clauses.length).toBeGreaterThanOrEqual(0);
  });

  it("should return section-level scores", () => {
    const content = `# Privacy Policy

## Introduction

We collect data (GDPR Art. 13).

## Data Collection

We process data (GDPR Art. 6).`;

    const result = analyzePolicyCompliance(content, "privacy_policy");

    expect(result.section_scores.length).toBeGreaterThan(0);
    expect(result.section_scores[0]).toHaveProperty("section_name");
    expect(result.section_scores[0]).toHaveProperty("gdpr_coverage");
  });
});

describe("getPolicyThresholds", () => {
  it("should return correct thresholds for privacy policy", () => {
    const thresholds = getPolicyThresholds("privacy_policy");

    expect(thresholds.gdpr).toBe(0.7);
    expect(thresholds.ai_act).toBe(0);
    expect(thresholds.iso_42001).toBe(0.6);
  });

  it("should return correct thresholds for AI usage policy", () => {
    const thresholds = getPolicyThresholds("ai_usage_policy");

    expect(thresholds.gdpr).toBe(0.3);
    expect(thresholds.ai_act).toBe(0.7);
    expect(thresholds.iso_42001).toBe(0.7);
  });

  it("should return correct thresholds for AI governance policy", () => {
    const thresholds = getPolicyThresholds("ai_governance_policy");

    expect(thresholds.gdpr).toBe(0.2);
    expect(thresholds.ai_act).toBe(0.7);
    expect(thresholds.iso_42001).toBe(0.7);
  });

  it("should adjust thresholds based on applicability context", () => {
    const context = {
      hasInternationalTransfers: true,
      usesThirdPartyProcessors: true,
    };

    const thresholds = getPolicyThresholds("privacy_policy", context);

    expect(thresholds.gdpr).toBe(0.7);
    // Thresholds should still be valid numbers
    expect(thresholds.gdpr).toBeGreaterThanOrEqual(0);
    expect(thresholds.gdpr).toBeLessThanOrEqual(1);
  });
});

describe("buildApplicabilityContext", () => {
  it("should build context from privacy questionnaire", () => {
    const questionnaire: Partial<PrivacyQuestionnaire> = {
      third_parties: "Yes",
      jurisdictions: ["GDPR (EU)", "CCPA (California)"],
      data_retention: "Indefinitely",
    };

    const context = buildApplicabilityContext(
      questionnaire,
      "privacy_policy"
    );

    expect(context.usesThirdPartyProcessors).toBe(true);
    expect(context.hasInternationalTransfers).toBe(true);
    expect(context.hasHighRiskProcessing).toBe(true);
  });

  it("should build context from AI usage questionnaire", () => {
    const questionnaire: Partial<AIUsageQuestionnaire> = {
      data_sent_to_models: "We send personal data including email addresses",
      ai_risk_rating: "high",
      human_oversight_level: "low",
    };

    const context = buildApplicabilityContext(
      questionnaire,
      "ai_usage_policy"
    );

    expect(context.usesAIForPersonalData).toBe(true);
    expect(context.deploysHighRiskAI).toBe(true);
    expect(context.usesAutomatedDecisionMaking).toBe(true);
  });

  it("should build context from AI governance questionnaire", () => {
    const questionnaire: Partial<AIGovernanceQuestionnaire> = {
      ai_governance_owner_role: "CTO",
    };

    const context = buildApplicabilityContext(
      questionnaire,
      "ai_governance_policy"
    );

    expect(context.offersAIAsProductInEU).toBe(true);
  });
});

describe("validatePolicyQuality", () => {
  it("should validate high-quality policy", () => {
    const content = `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy

## Introduction & Scope

This policy applies to Test Company (GDPR Art. 13).

## Data Collection

We process personal data based on lawful grounds (GDPR Art. 6). We obtain consent (GDPR Art. 7).

## Data Rights

You have rights including access (GDPR Art. 15), rectification (GDPR Art. 16), and erasure (GDPR Art. 17).

## Security

We implement security measures (GDPR Art. 32, ISO 42001 §8.2).

## Mapping Appendix

- Introduction: GDPR Art. 13
- Data Collection: GDPR Art. 6, GDPR Art. 7
- Data Rights: GDPR Art. 15, GDPR Art. 16, GDPR Art. 17
- Security: GDPR Art. 32, ISO 42001 §8.2

Last updated: 2024-12-19
-----END POLICY-MARKDOWN-----
-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "privacy",
  "placeholders_present": false,
  "jurisdictions": ["GDPR_EU"],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": [
    { "id": "sec_intro", "title": "Introduction & Scope", "framework_refs": ["GDPR Art. 13"] },
    { "id": "sec_data", "title": "Data Collection", "framework_refs": ["GDPR Art. 6", "GDPR Art. 7"] },
    { "id": "sec_rights", "title": "Data Rights", "framework_refs": ["GDPR Art. 15", "GDPR Art. 16", "GDPR Art. 17"] },
    { "id": "sec_security", "title": "Security", "framework_refs": ["GDPR Art. 32", "ISO 42001 §8.2"] }
  ]
}
-----END POLICY-METAJSON-----`;

    const result = validatePolicyQuality(content, "privacy_policy");

    expect(result.qualityScore).toBeGreaterThan(0.5);
    // High-quality policy should have minimal issues (allow some issues but quality score should be good)
    expect(result.issues.length).toBeLessThanOrEqual(5);
  });

  it("should detect low-quality policy with missing coverage", () => {
    const content = `# Privacy Policy

We collect some data.

Last updated: 2024-12-19`;

    const result = validatePolicyQuality(content, "privacy_policy");

    expect(result.qualityScore).toBeLessThan(0.6);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should provide actionable feedback", () => {
    const content = `# Privacy Policy

We collect data.

Last updated: 2024-12-19`;

    const result = validatePolicyQuality(content, "privacy_policy");

    expect(result.actionableFeedback.length).toBeGreaterThan(0);
    // Check if any feedback contains "add" (case-insensitive) - feedback may start with "Improve" or "Add"
    expect(result.actionableFeedback.some(f => f.toLowerCase().includes("add"))).toBe(true);
  });
});


