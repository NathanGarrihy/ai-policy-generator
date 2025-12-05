/**
 * Parser Module Unit Tests
 * Tests all parsing functions including fallback logic, placeholder detection, and validation
 */

import {
  parsePolicyOutput,
  extractMappingsFromMetadata,
  validatePolicyStructure,
  detectPlaceholders,
  replaceDatePlaceholders,
  replaceContactPlaceholders,
  removeContactInfoFromMappingAppendix,
  validateMappingAppendix,
  extractSections,
  validateContactInformation,
  validateLastUpdatedFooter,
  validateFrameworkReferences,
  type PolicyMetadata,
} from "@/lib/parser";

describe("parsePolicyOutput", () => {
  it("should parse structured format with POLICY-MARKDOWN and METAJSON blocks", () => {
    const content = `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy

We collect email addresses (GDPR Art. 6).
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
      "framework_refs": ["GDPR Art. 6"]
    }
  ]
}
-----END POLICY-METAJSON-----`;

    const result = parsePolicyOutput(content);

    expect(result.hasStructure).toBe(true);
    expect(result.content).toContain("# Privacy Policy");
    expect(result.metadata).not.toBeNull();
    expect(result.metadata?.policy_type).toBe("privacy");
  });

  it("should handle fallback parsing when delimiters are missing", () => {
    const content = `# Privacy Policy

We collect email addresses (GDPR Art. 6).

Last updated: 2024-12-19`;

    const result = parsePolicyOutput(content);

    expect(result.content).toContain("# Privacy Policy");
    // Fallback should still extract content
    expect(result.content.length).toBeGreaterThan(0);
  });

  it("should handle malformed METAJSON gracefully", () => {
    const content = `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy
-----END POLICY-MARKDOWN-----
-----BEGIN POLICY-METAJSON-----
{ invalid json }
-----END POLICY-METAJSON-----`;

    const result = parsePolicyOutput(content);

    expect(result.hasStructure).toBe(true);
    expect(result.content).toContain("# Privacy Policy");
    // Should handle JSON parse error gracefully
    expect(result.metadata).toBeNull();
  });

  it("should handle empty content", () => {
    const result = parsePolicyOutput("");

    expect(result.hasStructure).toBe(false);
    expect(result.content).toBe("");
    expect(result.metadata).toBeNull();
  });

  it("should handle content with only markdown headings", () => {
    const content = `# Introduction
## Data Collection
### Contact Information`;

    const result = parsePolicyOutput(content);

    expect(result.content).toContain("# Introduction");
    expect(result.hasStructure).toBe(true); // Should detect partial structure
  });
});

describe("extractMappingsFromMetadata", () => {
  it("should extract GDPR mappings from metadata", () => {
    const metadata: PolicyMetadata = {
      policy_type: "privacy",
      sections: [
        {
          id: "sec_intro",
          title: "Introduction",
          framework_refs: ["GDPR Art. 13", "GDPR Art. 6"],
        },
      ],
    };

    const mappings = extractMappingsFromMetadata(metadata);

    expect(mappings.length).toBe(2);
    expect(mappings[0].framework).toBe("GDPR");
    expect(mappings[0].article_ref).toBe("Art. 13");
  });

  it("should extract AI Act mappings from metadata", () => {
    const metadata: PolicyMetadata = {
      policy_type: "ai_usage",
      sections: [
        {
          id: "sec_ai_usage",
          title: "AI Usage",
          framework_refs: ["AI Act Art. 9", "AI Act Art. 10"],
        },
      ],
    };

    const mappings = extractMappingsFromMetadata(metadata);

    expect(mappings.length).toBe(2);
    expect(mappings[0].framework).toBe("AI_ACT");
    expect(mappings[0].article_ref).toBe("Art. 9");
  });

  it("should extract ISO 42001 mappings from metadata", () => {
    const metadata: PolicyMetadata = {
      policy_type: "privacy",
      sections: [
        {
          id: "sec_privacy",
          title: "Privacy",
          framework_refs: ["ISO 42001 §8.2"],
        },
      ],
    };

    const mappings = extractMappingsFromMetadata(metadata);

    expect(mappings.length).toBe(1);
    expect(mappings[0].framework).toBe("ISO_42001");
    expect(mappings[0].article_ref).toBe("§8.2");
  });

  it("should return empty array for null metadata", () => {
    const mappings = extractMappingsFromMetadata(null);
    expect(mappings).toEqual([]);
  });
});

describe("detectPlaceholders", () => {
  it("should detect contact placeholders", () => {
    const content = `Contact us at [Action Required: Provide DPO Contact Email]`;
    const placeholders = detectPlaceholders(content);

    expect(placeholders.length).toBe(1);
    expect(placeholders[0].type).toBe("contact");
  });

  it("should detect date placeholders", () => {
    const content = `Last updated: [Action Required: Provide current date]`;
    const placeholders = detectPlaceholders(content);

    expect(placeholders.length).toBe(1);
    expect(placeholders[0].type).toBe("date");
  });

  it("should detect multiple placeholders", () => {
    const content = `[Action Required: Company Name] uses [Action Required: Data Type]`;
    const placeholders = detectPlaceholders(content);

    expect(placeholders.length).toBe(2);
  });

  it("should return empty array when no placeholders", () => {
    const content = `This is normal content without placeholders`;
    const placeholders = detectPlaceholders(content);

    expect(placeholders).toEqual([]);
  });
});

describe("replaceDatePlaceholders", () => {
  it("should replace date placeholders with current date", () => {
    const content = `Last updated: [current date in YYYY-MM-DD format]`;
    const result = replaceDatePlaceholders(content);

    expect(result).not.toContain("[current date");
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("should replace outdated dates", () => {
    const content = `Last updated: 2022-01-01`;
    const result = replaceDatePlaceholders(content);

    expect(result).not.toContain("2022-01-01");
    const currentYear = new Date().getFullYear();
    expect(result).toContain(currentYear.toString());
  });

  it("should not replace recent dates", () => {
    const currentYear = new Date().getFullYear();
    const content = `Last updated: ${currentYear}-12-19`;
    const result = replaceDatePlaceholders(content);

    expect(result).toContain(`${currentYear}-12-19`);
  });
});

describe("replaceContactPlaceholders", () => {
  it("should replace DPO contact placeholder in privacy policy", () => {
    const content = `Contact: [Action Required: Provide DPO Contact Email]`;
    const questionnaireData = { dpo_contact: "dpo@example.com" };
    const result = replaceContactPlaceholders(
      content,
      questionnaireData,
      "privacy_policy"
    );

    expect(result).toContain("dpo@example.com");
    expect(result).not.toContain("[Action Required");
  });

  it("should replace responsible person placeholder in AI usage policy", () => {
    const content = `Contact: [Action Required: Full Name of Responsible Person]`;
    const questionnaireData = { responsible_person: "John Doe" };
    const result = replaceContactPlaceholders(
      content,
      questionnaireData,
      "ai_usage_policy"
    );

    expect(result).toContain("John Doe");
    expect(result).not.toContain("[Action Required");
  });

  it("should replace governance owner placeholder in AI governance policy", () => {
    const content = `Contact: [Action Required: Full Name of AI Governance Owner]`;
    const questionnaireData = {
      ai_governance_owner_name: "Jane Smith",
      ai_governance_owner_contact: "governance@example.com",
    };
    const result = replaceContactPlaceholders(
      content,
      questionnaireData,
      "ai_governance_policy"
    );

    expect(result).toContain("Jane Smith");
  });
});

describe("removeContactInfoFromMappingAppendix", () => {
  it("should remove Contact Information from mapping appendix", () => {
    const content = `## Mapping Appendix

- Introduction: GDPR Art. 13
- Contact Information: GDPR Art. 6
- Data Collection: GDPR Art. 6

## Last updated: 2024-12-19`;

    const result = removeContactInfoFromMappingAppendix(content);

    expect(result).not.toContain("Contact Information");
    expect(result).toContain("Introduction");
    expect(result).toContain("Data Collection");
  });

  it("should not modify content without mapping appendix", () => {
    const content = `# Privacy Policy

## Contact Information

Email: contact@example.com`;

    const result = removeContactInfoFromMappingAppendix(content);

    expect(result).toBe(content);
  });
});

describe("validatePolicyStructure", () => {
  it("should validate privacy policy structure", () => {
    const content = `# Introduction & Scope
## Data Collection Categories & Purposes
## Cookies and Similar Technologies
## Third-Party Sharing/Disclosure
## Data Rights & Transparency
## Data Retention & Deletion
## Security Measures
## Contact Information
## Mapping Appendix`;

    const result = validatePolicyStructure(content, "privacy_policy", null);

    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should detect missing mandatory sections", () => {
    const content = `# Introduction
## Data Collection`;

    const result = validatePolicyStructure(content, "privacy_policy", null);

    expect(result.isValid).toBe(false);
    expect(result.missingMandatorySections.length).toBeGreaterThan(0);
  });
});

describe("validateFrameworkReferences", () => {
  it("should validate correct GDPR citations", () => {
    const content = `We process data (GDPR Art. 6) and provide information (GDPR Art. 13)`;
    const result = validateFrameworkReferences(content);

    expect(result.isValid).toBe(true);
    expect(result.validReferences.length).toBe(2);
  });

  it("should detect invalid article numbers", () => {
    const content = `We process data (GDPR Art. 999)`;
    const result = validateFrameworkReferences(content);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should validate AI Act citations", () => {
    const content = `We use AI systems (AI Act Art. 9) with risk management (AI Act Art. 10)`;
    const result = validateFrameworkReferences(content);

    expect(result.isValid).toBe(true);
    expect(
      result.validReferences.filter((r) => r.framework === "AI_ACT").length
    ).toBe(2);
  });

  it("should validate ISO 42001 citations", () => {
    const content = `We handle privacy (ISO 42001 §8.2)`;
    const result = validateFrameworkReferences(content);

    expect(result.isValid).toBe(true);
    expect(
      result.validReferences.filter((r) => r.framework === "ISO_42001").length
    ).toBe(1);
  });
});


