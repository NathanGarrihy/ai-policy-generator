/**
 * Compliance Rules Module Unit Tests
 * Tests rule filtering, applicability, and section eligibility
 */

import {
  GDPR_RULES,
  AI_ACT_RULES,
  ISO_42001_RULES,
  ALL_RULES,
  getClauseEligibleSections,
  type ComplianceRule,
} from "@/lib/compliance-rules";
import type { RuleApplicability } from "@/lib/types";

describe("Compliance Rules", () => {
  it("should have GDPR rules defined", () => {
    expect(GDPR_RULES.length).toBeGreaterThan(0);
    expect(GDPR_RULES.every((r) => r.framework === "GDPR")).toBe(true);
  });

  it("should have AI Act rules defined", () => {
    expect(AI_ACT_RULES.length).toBeGreaterThan(0);
    expect(AI_ACT_RULES.every((r) => r.framework === "AI_ACT")).toBe(true);
  });

  it("should have ISO 42001 rules defined", () => {
    expect(ISO_42001_RULES.length).toBeGreaterThan(0);
    expect(ISO_42001_RULES.every((r) => r.framework === "ISO_42001")).toBe(true);
  });

  it("should combine all rules correctly", () => {
    expect(ALL_RULES.length).toBe(
      GDPR_RULES.length + AI_ACT_RULES.length + ISO_42001_RULES.length
    );
  });
});

describe("Rule Applicability", () => {
  it("should filter rules by applicability context", () => {
    const context: RuleApplicability = {
      hasInternationalTransfers: true,
      usesThirdPartyProcessors: true,
    };

    // Find rules with applicability functions
    const applicableRules = GDPR_RULES.filter((rule) => {
      if (!rule.applicability) return true;
      return rule.applicability(context);
    });

    expect(applicableRules.length).toBeGreaterThan(0);
  });

  it("should include rules without applicability functions", () => {
    const context: RuleApplicability = {};

    const rulesWithoutApplicability = GDPR_RULES.filter(
      (r) => !r.applicability
    );

    expect(rulesWithoutApplicability.length).toBeGreaterThan(0);
  });

  it("should filter high-risk AI rules correctly", () => {
    const context: RuleApplicability = {
      deploysHighRiskAI: true,
    };

    const applicableRules = AI_ACT_RULES.filter((rule) => {
      if (!rule.applicability) return true;
      return rule.applicability(context);
    });

    // Should include high-risk specific rules
    const highRiskRules = applicableRules.filter((r) =>
      r.article_ref.includes("9") || r.article_ref.includes("11")
    );
    expect(highRiskRules.length).toBeGreaterThan(0);
  });
});

describe("getClauseEligibleSections", () => {
  it("should return section IDs for rules with section restrictions", () => {
    const ruleWithSections: ComplianceRule = {
      framework: "GDPR",
      article_ref: "Art. 13",
      clause_text: "Information to be provided",
      required: true,
      keywords: ["information"],
      section_ids: ["sec_data_collection", "Data Collection"],
    };

    const sections = getClauseEligibleSections(ruleWithSections);

    expect(sections.length).toBe(2);
    expect(sections).toContain("sec_data_collection");
  });

  it("should return empty array for rules without section restrictions", () => {
    const ruleWithoutSections: ComplianceRule = {
      framework: "GDPR",
      article_ref: "Art. 6",
      clause_text: "Lawful basis",
      required: true,
      keywords: ["lawful basis"],
    };

    const sections = getClauseEligibleSections(ruleWithoutSections);

    expect(sections).toEqual([]);
  });
});

describe("Rule Keywords", () => {
  it("should have keywords for all required rules", () => {
    const requiredRules = ALL_RULES.filter((r) => r.required);

    for (const rule of requiredRules) {
      expect(rule.keywords.length).toBeGreaterThan(0);
    }
  });

  it("should have meaningful keywords", () => {
    const rule = GDPR_RULES.find((r) => r.article_ref === "Art. 6");

    expect(rule).toBeDefined();
    expect(rule!.keywords.length).toBeGreaterThan(5);
    expect(rule!.keywords.some((kw) => kw.includes("lawful"))).toBe(true);
  });
});

describe("Hard Mandatory Rules", () => {
  it("should identify hard mandatory rules", () => {
    const hardMandatoryRules = ALL_RULES.filter((r) => r.hard_mandatory === true);

    expect(hardMandatoryRules.length).toBeGreaterThan(0);
    expect(hardMandatoryRules.every((r) => r.required === true)).toBe(true);
  });

  it("should have hard mandatory rules for critical articles", () => {
    const art6Rule = GDPR_RULES.find((r) => r.article_ref === "Art. 6");
    const art13Rule = GDPR_RULES.find((r) => r.article_ref === "Art. 13");

    expect(art6Rule?.hard_mandatory).toBe(true);
    expect(art13Rule?.hard_mandatory).toBe(true);
  });
});


