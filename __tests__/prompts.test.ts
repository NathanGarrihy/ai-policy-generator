/**
 * Prompts Module Unit Tests
 * Tests prompt building for all policy types and model-specific adjustments
 */

import {
  buildPrompt,
  buildPromptForModel,
} from "@/lib/prompts";
import type {
  PrivacyQuestionnaire,
  AIUsageQuestionnaire,
  AIGovernanceQuestionnaire,
} from "@/lib/types";

describe("buildPrompt", () => {
  it("should build privacy policy prompt", () => {
    const questionnaire: Partial<PrivacyQuestionnaire> = {
      company_name: "Test Company",
      jurisdictions: ["GDPR (EU)"],
      data_collected: ["Email", "Name"],
      purpose_of_processing: "Providing services",
      third_parties: "Yes",
      cookies_used: "Yes",
      data_retention: "1 year",
      dpo_contact: "dpo@test.com",
    };

    const prompt = buildPrompt("privacy-policy", questionnaire);

    expect(prompt).toContain("Test Company");
    expect(prompt).toContain("GDPR");
    expect(prompt).toContain("Email");
    expect(prompt).toContain("dpo@test.com");
  });

  it("should build AI usage policy prompt", () => {
    const questionnaire: Partial<AIUsageQuestionnaire> = {
      company_name: "AI Company",
      ai_used_where: ["support", "content"],
      ai_model_provider: "OpenAI",
      data_sent_to_models: "User queries and responses",
      human_oversight_level: "medium",
      ai_risk_rating: "medium",
      ai_retraining_frequency: "quarterly",
      responsible_person: "John Doe",
    };

    const prompt = buildPrompt("ai-usage-policy", questionnaire);

    expect(prompt).toContain("AI Company");
    expect(prompt).toContain("OpenAI");
    expect(prompt).toContain("AI Act");
    expect(prompt).toContain("John Doe");
  });

  it("should build AI governance policy prompt", () => {
    const questionnaire: Partial<AIGovernanceQuestionnaire> = {
      company_name: "Governance Corp",
      ai_governance_owner_role: "CTO",
      documentation_frequency: "quarterly",
      responsible_ai_principles: ["Transparency", "Fairness"],
      training_provided: "Yes",
      incident_reporting_procedure: "Yes",
    };

    const prompt = buildPrompt("ai-governance-policy", questionnaire);

    expect(prompt).toContain("Governance Corp");
    expect(prompt).toContain("CTO");
    expect(prompt).toContain("AI Act");
    expect(prompt).toContain("Transparency");
  });

  it("should handle missing questionnaire fields with placeholders", () => {
    const questionnaire: Partial<PrivacyQuestionnaire> = {
      company_name: "Test",
    };

    const prompt = buildPrompt("privacy-policy", questionnaire);

    expect(prompt).toContain("[Action Required");
  });
});

describe("buildPromptForModel", () => {
  it("should add GPT-3.5 specific instructions", () => {
    const prompt = buildPromptForModel("gpt-3.5-turbo", "privacy-policy", {
      responses: {},
    });

    expect(prompt).toContain("GPT-3.5-TURBO");
    expect(prompt).toContain("CRITICAL FORMAT REQUIREMENTS");
    expect(prompt).toContain("Step 1");
    expect(prompt).toContain("Step 2");
    expect(prompt).toContain("Step 3");
  });

  it("should add minimal clarifications for GPT-4", () => {
    const prompt = buildPromptForModel("gpt-4o", "privacy-policy", {
      responses: {},
    });

    expect(prompt).toContain("Additional Clarifications");
    expect(prompt).not.toContain("Step 1");
  });

  it("should handle different policy types", () => {
    const privacyPrompt = buildPromptForModel("gpt-3.5-turbo", "privacy-policy", {
      responses: {},
    });
    const aiUsagePrompt = buildPromptForModel("gpt-3.5-turbo", "ai-usage-policy", {
      responses: {},
    });

    expect(privacyPrompt).toContain('"policy_type": "privacy"');
    expect(aiUsagePrompt).toContain('"policy_type": "ai_usage"');
  });
});


