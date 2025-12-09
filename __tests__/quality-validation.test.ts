/**
 * Quality Validation Tests
 * 
 * Tests that quality scoring catches low-quality outputs and retry logic triggers correctly
 */

import {
  calculateQualityScore,
  validatePolicyQuality,
  analyzePolicyCompliance,
  type PolicyType,
  type PolicyCopResult,
} from "@/lib/policycop";
import { parsePolicyOutput } from "@/lib/parser";

/**
 * Mock low-quality policy content (missing structure, invalid METAJSON, low coverage)
 */
const mockLowQualityContent = {
  noStructure: `# Privacy Policy

This is a privacy policy without proper structure.
We collect data and use it for services.
You have rights to your data.

Last updated: 2024-12-19`,

  invalidMetajson: `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy

We collect email addresses (GDPR Art. 6).

Last updated: 2024-12-19
-----END POLICY-MARKDOWN-----

-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "privacy",
  "invalid_field": "this should not be here"
}
-----END POLICY-METAJSON-----`,

  lowCoverage: `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy

We collect some data.

Last updated: 2024-12-19
-----END POLICY-MARKDOWN-----

-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "privacy",
  "placeholders_present": false,
  "jurisdictions": ["GDPR_EU"],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": []
}
-----END POLICY-METAJSON-----`,

  noFrameworkRefs: `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy

We collect email addresses and names for providing services.
You can contact us if you have questions.

Last updated: 2024-12-19
-----END POLICY-MARKDOWN-----

-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "privacy",
  "placeholders_present": false,
  "jurisdictions": ["GDPR_EU"],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": [
    {
      "id": "sec_intro",
      "title": "Introduction",
      "framework_refs": []
    }
  ]
}
-----END POLICY-METAJSON-----`,

  highQuality: `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy

## Introduction & Scope

This Privacy Policy applies to Test Company and describes how we collect, use, and protect your personal data (GDPR Art. 13).

## Data Collection Categories & Purposes

We process personal data, including email addresses and names, based on your consent and for the performance of our services (GDPR Art. 6(1)(a), GDPR Art. 6(1)(b)). We ensure that data processing is lawful and transparent (GDPR Art. 7).

## Data Rights & Transparency

You have comprehensive rights regarding your personal data, including the right to access (GDPR Art. 15), rectification (GDPR Art. 16), erasure (GDPR Art. 17), restriction of processing (GDPR Art. 18), data portability (GDPR Art. 20), and objection to processing (GDPR Art. 21).

## Security Measures

We implement technical and organizational security measures to protect your personal data against unauthorized access, loss, or destruction (GDPR Art. 32, ISO 42001 §8.2).

## Mapping Appendix

- Introduction & Scope: GDPR Art. 13
- Data Collection Categories & Purposes: GDPR Art. 6, GDPR Art. 7
- Data Rights & Transparency: GDPR Art. 15, GDPR Art. 16, GDPR Art. 17, GDPR Art. 18, GDPR Art. 20, GDPR Art. 21
- Security Measures: GDPR Art. 32, ISO 42001 §8.2

Last updated: 2024-12-19
-----END POLICY-MARKDOWN-----

-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "privacy",
  "placeholders_present": false,
  "jurisdictions": ["GDPR_EU"],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": [
    {
      "id": "sec_intro",
      "title": "Introduction & Scope",
      "framework_refs": ["GDPR Art. 13"]
    },
    {
      "id": "sec_data_collection",
      "title": "Data Collection Categories & Purposes",
      "framework_refs": ["GDPR Art. 6", "GDPR Art. 7"]
    },
    {
      "id": "sec_rights",
      "title": "Data Rights & Transparency",
      "framework_refs": ["GDPR Art. 15", "GDPR Art. 16", "GDPR Art. 17", "GDPR Art. 18", "GDPR Art. 20", "GDPR Art. 21"]
    },
    {
      "id": "sec_security",
      "title": "Security Measures",
      "framework_refs": ["GDPR Art. 32", "ISO 42001 §8.2"]
    }
  ]
}
-----END POLICY-METAJSON-----`,
};

/**
 * Test: Quality scoring catches low-quality outputs
 */
export function testQualityScoringCatchesLowQuality() {
  const policyType: PolicyType = "privacy_policy";
  const results: Array<{
    testName: string;
    content: string;
    qualityScore: number;
    meetsThreshold: boolean;
    issues: string[];
  }> = [];

  // Test 1: No structure
  const parsedNoStructure = parsePolicyOutput(mockLowQualityContent.noStructure);
  const policyCopNoStructure = analyzePolicyCompliance(
    parsedNoStructure.content || mockLowQualityContent.noStructure,
    policyType
  );
  const qualityNoStructure = calculateQualityScore(
    mockLowQualityContent.noStructure,
    policyType,
    policyCopNoStructure
  );
  results.push({
    testName: "No Structure",
    content: mockLowQualityContent.noStructure,
    qualityScore: qualityNoStructure.score,
    meetsThreshold: qualityNoStructure.score >= 0.8,
    issues: qualityNoStructure.issues,
  });

  // Test 2: Low coverage
  const parsedLowCoverage = parsePolicyOutput(mockLowQualityContent.lowCoverage);
  const policyCopLowCoverage = analyzePolicyCompliance(
    parsedLowCoverage.content || mockLowQualityContent.lowCoverage,
    policyType
  );
  const qualityLowCoverage = calculateQualityScore(
    mockLowQualityContent.lowCoverage,
    policyType,
    policyCopLowCoverage
  );
  results.push({
    testName: "Low Coverage",
    content: mockLowQualityContent.lowCoverage,
    qualityScore: qualityLowCoverage.score,
    meetsThreshold: qualityLowCoverage.score >= 0.8,
    issues: qualityLowCoverage.issues,
  });

  // Test 3: No framework references
  const parsedNoRefs = parsePolicyOutput(mockLowQualityContent.noFrameworkRefs);
  const policyCopNoRefs = analyzePolicyCompliance(
    parsedNoRefs.content || mockLowQualityContent.noFrameworkRefs,
    policyType
  );
  const qualityNoRefs = calculateQualityScore(
    mockLowQualityContent.noFrameworkRefs,
    policyType,
    policyCopNoRefs
  );
  results.push({
    testName: "No Framework References",
    content: mockLowQualityContent.noFrameworkRefs,
    qualityScore: qualityNoRefs.score,
    meetsThreshold: qualityNoRefs.score >= 0.8,
    issues: qualityNoRefs.issues,
  });

  // Test 4: High quality (should pass)
  const parsedHighQuality = parsePolicyOutput(mockLowQualityContent.highQuality);
  const policyCopHighQuality = analyzePolicyCompliance(
    parsedHighQuality.content || mockLowQualityContent.highQuality,
    policyType
  );
  const qualityHighQuality = calculateQualityScore(
    mockLowQualityContent.highQuality,
    policyType,
    policyCopHighQuality
  );
  results.push({
    testName: "High Quality",
    content: mockLowQualityContent.highQuality,
    qualityScore: qualityHighQuality.score,
    meetsThreshold: qualityHighQuality.score >= 0.8,
    issues: qualityHighQuality.issues,
  });

  console.log("Quality Scoring Test Results:", {
    lowQualityTests: results
      .filter((r) => r.testName !== "High Quality")
      .map((r) => ({
        testName: r.testName,
        qualityScore: r.qualityScore.toFixed(3),
        meetsThreshold: r.meetsThreshold,
        issuesCount: r.issues.length,
      })),
    highQualityTest: results
      .filter((r) => r.testName === "High Quality")
      .map((r) => ({
        testName: r.testName,
        qualityScore: r.qualityScore.toFixed(3),
        meetsThreshold: r.meetsThreshold,
        issuesCount: r.issues.length,
      }))[0],
  });

  // Validate that low-quality outputs are caught
  const lowQualityCaught = results
    .filter((r) => r.testName !== "High Quality")
    .every((r) => !r.meetsThreshold);
  const highQualityPasses = results
    .filter((r) => r.testName === "High Quality")
    .every((r) => r.meetsThreshold);

  return {
    lowQualityCaught,
    highQualityPasses,
    allTestsPass: lowQualityCaught && highQualityPasses,
    results,
  };
}

/**
 * Test: Retry logic triggers correctly
 * 
 * Simulates the retry logic by checking if quality score < 0.8 triggers retry
 */
export function testRetryLogicTriggers() {
  const qualityThreshold = 0.8;
  const testCases: Array<{
    qualityScore: number;
    shouldRetry: boolean;
    shouldFallbackToGPT4: boolean;
  }> = [
    {
      qualityScore: 0.5,
      shouldRetry: true,
      shouldFallbackToGPT4: false, // First retry with GPT-3.5
    },
    {
      qualityScore: 0.75,
      shouldRetry: true,
      shouldFallbackToGPT4: false, // Second retry with GPT-3.5
    },
    {
      qualityScore: 0.65,
      shouldRetry: true,
      shouldFallbackToGPT4: true, // Third attempt should use GPT-4
    },
    {
      qualityScore: 0.85,
      shouldRetry: false,
      shouldFallbackToGPT4: false, // Quality sufficient, no retry needed
    },
  ];

  const results = testCases.map((testCase) => {
    const shouldRetry = testCase.qualityScore < qualityThreshold;
    const attemptNumber = shouldRetry ? 1 : 0; // Simulate attempt number
    const shouldFallbackToGPT4 =
      shouldRetry && attemptNumber >= 2; // Fallback on 3rd attempt

    return {
      qualityScore: testCase.qualityScore,
      shouldRetry,
      shouldFallbackToGPT4,
      matchesExpected: {
        retry: shouldRetry === testCase.shouldRetry,
        fallback: shouldFallbackToGPT4 === testCase.shouldFallbackToGPT4,
      },
    };
  });

  console.log("Retry Logic Test Results:", {
    testCases: results.map((r) => ({
      qualityScore: r.qualityScore.toFixed(2),
      shouldRetry: r.shouldRetry,
      shouldFallbackToGPT4: r.shouldFallbackToGPT4,
      matchesExpected: r.matchesExpected,
    })),
  });

  const allTestsPass = results.every(
    (r) => r.matchesExpected.retry && r.matchesExpected.fallback
  );

  return {
    allTestsPass,
    results,
  };
}

/**
 * Test: Validate policy quality function
 */
export function testValidatePolicyQuality() {
  const policyType: PolicyType = "privacy_policy";

  // Test with low-quality content
  const validationLowQuality = validatePolicyQuality(
    mockLowQualityContent.lowCoverage,
    policyType
  );

  // Test with high-quality content
  const validationHighQuality = validatePolicyQuality(
    mockLowQualityContent.highQuality,
    policyType
  );

  console.log("Policy Quality Validation Results:", {
    lowQuality: {
      isValid: validationLowQuality.isValid,
      qualityScore: validationLowQuality.qualityScore.toFixed(3),
      issuesCount: validationLowQuality.issues.length,
      warningsCount: validationLowQuality.warnings.length,
      actionableFeedbackCount: validationLowQuality.actionableFeedback.length,
    },
    highQuality: {
      isValid: validationHighQuality.isValid,
      qualityScore: validationHighQuality.qualityScore.toFixed(3),
      issuesCount: validationHighQuality.issues.length,
      warningsCount: validationHighQuality.warnings.length,
      actionableFeedbackCount: validationHighQuality.actionableFeedback.length,
    },
  });

  return {
    lowQualityIsInvalid: !validationLowQuality.isValid,
    highQualityIsValid: validationHighQuality.isValid,
    allTestsPass:
      !validationLowQuality.isValid && validationHighQuality.isValid,
    lowQuality: validationLowQuality,
    highQuality: validationHighQuality,
  };
}

describe("Quality Validation Tests", () => {
  it("should catch low-quality outputs", () => {
    const result = testQualityScoringCatchesLowQuality();
    expect(result.lowQualityCaught).toBe(true);
    expect(result.highQualityPasses).toBe(true);
    expect(result.allTestsPass).toBe(true);
  });

  it("should trigger retry logic when quality score < 0.8", () => {
    const result = testRetryLogicTriggers();
    expect(result.allTestsPass).toBe(true);
  });

  it("should validate policy quality correctly", () => {
    const result = testValidatePolicyQuality();
    expect(result.lowQualityIsInvalid).toBe(true);
    expect(result.highQualityIsValid).toBe(true);
    expect(result.allTestsPass).toBe(true);
  });
});

