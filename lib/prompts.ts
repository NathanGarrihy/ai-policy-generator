// lib/prompts.ts
import type {
  PrivacyQuestionnaire,
  AIUsageQuestionnaire,
  AIGovernanceQuestionnaire,
} from "@/lib/types";

type Answers =
  | Partial<PrivacyQuestionnaire>
  | Partial<AIUsageQuestionnaire>
  | Partial<AIGovernanceQuestionnaire>
  | Record<string, any>;

export type BuildPromptContext = {
  responses: Answers;
};

function getJurisdictions(a: Answers) {
  // Support both keys used across the codebase: "jurisdictions" (current) and "jurisdiction" (legacy)
  // Use type assertion to access properties that may not exist on all union types
  const answers = a as Record<string, any>;
  const list = (answers.jurisdictions ??
    answers.jurisdiction ??
    []) as string[];
  return Array.isArray(list) && list.length
    ? list.join(", ")
    : "None specified";
}

const SYSTEM_PROMPT_BASE = `You are a compliance drafter generating EU-grade policies aligned with GDPR, EU AI Act, and ISO/IEC 42001.
Write in clear, professional English with short, factual sentences and a neutral legal tone.

## Output Format (MUST FOLLOW EXACTLY)

Return exactly two blocks, using these delimiters:

-----BEGIN POLICY-MARKDOWN-----
[Complete policy text in Markdown]
-----END POLICY-MARKDOWN-----

-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "privacy|ai_usage|ai_governance",
  "placeholders_present": false,
  "jurisdictions": ["GDPR_EU"],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": [
    {
      "id": "sec_intro",
      "title": "Introduction & Scope",
      "framework_refs": ["GDPR Art. 13"]
    }
  ]
}
-----END POLICY-METAJSON-----

## Citation Format (CRITICAL)

Use ONLY these inline formats after relevant sentences:
- GDPR: (GDPR Art. 6)
- AI Act: (AI Act Art. 9)
- ISO 42001: (ISO 42001 §8.2)

## Coverage Targets

- Privacy Policy: GDPR ≥70%, ISO 42001 ≥60%
- AI Usage Policy: GDPR ≥30%, AI Act ≥70%, ISO 42001 ≥70%
- AI Governance Policy: GDPR ≥20%, AI Act ≥70%, ISO 42001 ≥70%

## METAJSON Rules

- policy_type: "privacy" | "ai_usage" | "ai_governance"
- placeholders_present: true if any [Action Required: ...] is used
- jurisdictions: e.g. ["GDPR_EU", "UK_GDPR"] or []
- coverage: leave all values at 0
- sections: id, title, framework_refs (citation strings)

## General Rules

- Follow the requested section order; include every section, even if placeholder-only.
- No reasoning, notes, disclaimers, or commentary outside the policy text.
- Use [Action Required: ...] ONLY when data is truly missing.
- Include a Mapping Appendix listing sections with framework references, but EXCLUDE "Contact Information".
- Footer: Last updated: YYYY-MM-DD (use the actual current date, e.g., Last updated: 2024-12-19).

## DO NOT

- DO NOT hallucinate frameworks or articles.
- DO NOT change delimiter format or omit the METAJSON block.
- DO NOT invent missing data; use [Action Required: ...] instead.
- DO NOT change citation formats – use only (GDPR Art. X), (AI Act Art. X), (ISO 42001 §X.X).`;

/**
 * Builds a model-specific system prompt based on SYSTEM_PROMPT_BASE
 * @param modelName - The OpenAI model identifier (e.g., "gpt-3.5-turbo", "gpt-4")
 * @param policyType - The policy type being generated
 * @param context - Context containing questionnaire responses
 * @returns The full system prompt string with model-specific adjustments
 */
export function buildPromptForModel(
  modelName: string,
  policyType: string,
  context: BuildPromptContext
): string {
  const isGPT35 = modelName.includes("gpt-3.5");
  
  if (isGPT35) {
    // For GPT-3.5-turbo, add explicit step-by-step guidance with concrete examples
    const policyTypeNormalized = policyType === "privacy-policy" || policyType === "privacy_policy" 
      ? "privacy" 
      : policyType === "ai-usage-policy" || policyType === "ai_usage_policy" 
      ? "ai_usage" 
      : "ai_governance";
    
    return `${SYSTEM_PROMPT_BASE}

## GPT-3.5-TURBO: Instructions

1. Write complete policy content in Markdown using headings (# Section Title).
2. Use 1–2 concise paragraphs per section with inline citations: (GDPR Art. 6), (AI Act Art. 9), (ISO 42001 §8.2).
3. Wrap the policy with the POLICY-MARKDOWN delimiters shown above.
4. Create a METAJSON block:
   - Set "policy_type" to "${policyTypeNormalized}".
   - Include an entry in "sections" for each section that has framework_refs.
5. Wrap METAJSON with the POLICY-METAJSON delimiters shown above.

Citation formats MUST exactly match the formats listed in the Citation section.`;
  } else {
    // For GPT-4 and higher models, keep instructions closer to base with minimal clarifications
    return `${SYSTEM_PROMPT_BASE}

## Additional Clarifications

- Ensure all citations use the exact formats specified above
- The METAJSON sections array must include every section from the policy that has framework references
- Policy type in METAJSON must exactly match: "privacy", "ai_usage", or "ai_governance"`;
  }
}

export function buildPrompt(policyType: string, responses: Answers) {
  // Use type assertion to access properties that may not exist on all union types
  const r = responses as Record<string, any>;

  if (policyType === "privacy-policy" || policyType === "privacy_policy") {
    const companyName =
      r.company_name || "[Action Required: Provide Company Name]";
    const jurisdictions = getJurisdictions(responses);
    const dataCollected =
      (r.data_collected ?? []).length > 0
        ? (r.data_collected ?? []).join(", ")
        : "[Action Required: Specify Data Collected]";
    const purposeOfProcessing =
      r.purpose_of_processing?.trim() ||
      "[Action Required: Specify Purpose of Processing]";
    const thirdParties =
      r.third_parties || "[Action Required: Specify Third-Party Sharing]";
    const cookiesUsed =
      r.cookies_used || "[Action Required: Specify Cookie Usage]";
    const dataRetention =
      r.data_retention || "[Action Required: Specify Data Retention Period]";
    const dpoContact =
      r.dpo_contact?.trim() ||
      "[Action Required: Provide DPO/Privacy Contact Email]";

    // Determine jurisdictions for METAJSON
    const jurisdictionList: string[] = [];
    const jurisArray = (r.jurisdictions ?? []) as string[];
    if (jurisArray.includes("GDPR (EU)")) jurisdictionList.push("GDPR_EU");
    if (jurisArray.includes("UK GDPR")) jurisdictionList.push("UK_GDPR");
    if (jurisArray.includes("CCPA (California)")) jurisdictionList.push("CCPA");
    if (jurisArray.includes("PIPEDA (Canada)")) jurisdictionList.push("PIPEDA");

    return `Generate a **Privacy Policy** for ${companyName}.

Coverage Targets:
- GDPR: ≥70% (Primary focus - privacy policies must comprehensively address GDPR requirements)
- ISO 42001: ≥60% (Important - privacy policies should reference ISO 42001 for data handling and privacy management)

Company Details:
- Name: ${companyName}
- Jurisdictions: ${jurisdictions}
- Data Collected: ${dataCollected}
- Purpose of Processing: ${purposeOfProcessing}
- Shares with Third Parties: ${thirdParties}
- Uses Cookies: ${cookiesUsed}
- Data Retention: ${dataRetention}
- DPO/Privacy Contact: ${dpoContact}

Required Sections (include all, even if placeholder-only):
1. Introduction & Scope (map to GDPR Art. 13)
2. Data Collection Categories & Purposes (map to GDPR Art. 6, 7, 13)
3. Cookies and Similar Technologies (reference Cookie Policy if applicable)
4. Third-Party Sharing/Disclosure (if any) (map to GDPR Art. 13, 14)
5. Data Rights & Transparency (GDPR Art. 15-22) and notices (CCPA), in plain English
6. Data Retention & Deletion (map to GDPR Art. 5, 17)
7. Security Measures (high-level) (map to GDPR Art. 32, ISO 42001 §8.2)
8. Contact Information (including DPO/privacy contact)
9. Mapping Appendix (list all sections with their framework references - EXCLUDE Contact Information as it has no framework references)
10. Last updated: YYYY-MM-DD (use the actual current date in YYYY-MM-DD format, for example: Last updated: 2024-12-19)

Critical Required Articles (address clearly and cite):
- GDPR Art. 6: lawful basis for each main processing purpose.
- GDPR Art. 7: how consent is obtained and withdrawn.
- GDPR Art. 13: controller identity, purposes, legal basis, retention, rights.
- GDPR Art. 15-22: main data subject rights and how to exercise them.
- GDPR Art. 32: key technical and organisational security measures.

Important:
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details above.
- Include inline mapping notes in parentheses like "(GDPR Art. 13 – Information to be provided)" or "(ISO 42001 §8.2 – Privacy)".
- The Mapping Appendix must list each section with its framework references.
- Set policy_type to "privacy" in METAJSON.
- Set jurisdictions to ${JSON.stringify(
      jurisdictionList.length > 0
        ? jurisdictionList
        : ["[Action Required: Specify Jurisdictions]"]
    )}
- Set placeholders_present to true if any [Action Required: ...] appears in the policy.
    `.trim();
  }

  if (policyType === "cookie-policy") {
    const juris = getJurisdictions(responses);
    const usesCookies = r.cookies_used === "Yes";
    const third = r.third_parties === "Yes";

    const cookieUseNote = usesCookies
      ? "Describe categories (strictly necessary, functional, analytics, advertising), purposes, typical examples, and retention."
      : "State that non-essential cookies are not intentionally used; clarify strictly necessary cookies/local storage may still be used for core functionality; explain browser controls.";

    const thirdPartyNote = third
      ? "Include third-party cookies (e.g., analytics/ads), how they are set, links to their policies, and opt-out guidance."
      : "State that third-party cookies are not used; note that if this changes the policy will be updated.";

    return `
You are a compliance-savvy legal/technical writer. Produce a concise, human-readable **Cookie Policy** for **${r.company_name}** in **Markdown**.

Context
- Jurisdictions to align with: ${juris}
- Uses cookies: ${r.cookies_used}
- Shares data with third parties: ${r.third_parties}
- Typical data retention preference: ${r.data_retention}

Requirements
1) Short plain-English explanation of cookies and similar technologies.
2) ${cookieUseNote}
3) ${thirdPartyNote}
4) Explain consent (banner, Accept/Reject, and changing preferences later).
5) Explain browser controls; acknowledge Do Not Track neutrally.
6) Reference the Privacy Policy and provide a contact email.
7) Include "Last updated: YYYY-MM-DD".
8) Keep language GDPR/CCPA-aware (transparency/rights) without inventing citations.

Return only the policy content.
    `.trim();
  }

  if (policyType === "ai-usage-policy" || policyType === "ai_usage_policy") {
    const companyName =
      r.company_name || "[Action Required: Provide Company Name]";
    const aiUsedWhere = Array.isArray(r.ai_used_where)
      ? r.ai_used_where.join(", ")
      : r.ai_used_where || "[Action Required: Specify Where AI is Used]";
    const aiModelProvider =
      r.ai_model_provider || "[Action Required: Specify AI Model Provider]";
    const dataSentToModels =
      r.data_sent_to_models?.trim() ||
      "[Action Required: Specify Data Sent to Models]";
    const humanOversightLevel =
      r.human_oversight_level ||
      "[Action Required: Specify Human Oversight Level]";
    const aiRiskRating =
      r.ai_risk_rating || "[Action Required: Specify AI Risk Rating]";
    const aiRetrainingFrequency =
      r.ai_retraining_frequency ||
      "[Action Required: Specify AI Retraining Frequency]";
    // Extract responsible person and contact - check multiple possible fields
    const responsiblePerson =
      r.responsible_person?.trim() ||
      r.responsible_person_name?.trim() ||
      "[Action Required: Provide Full Name of Responsible Person]";
    const responsiblePersonContact =
      r.responsible_person_contact?.trim() ||
      r.responsible_person_email?.trim() ||
      r.contact_email?.trim() ||
      "[Action Required: Contact Information for Responsible Person]";

    return `Generate an **AI Usage Policy** for ${companyName}.

Coverage Targets:
- GDPR: ≥30% (Secondary - AI usage policies focus on AI Act compliance, GDPR is relevant for data handling)
- AI Act: ≥70% (Primary focus - AI usage policies must comprehensively address AI Act requirements)
- ISO 42001: ≥70% (Primary focus - AI usage policies should comprehensively address ISO 42001 for AI system management)

Company Details:
- Name: ${companyName}
- AI Used Where: ${aiUsedWhere}
- AI Model Provider: ${aiModelProvider}
- Data Sent to Models: ${dataSentToModels}
- Human Oversight Level: ${humanOversightLevel}
- AI Risk Rating: ${aiRiskRating}
- AI Retraining Frequency: ${aiRetrainingFrequency}
- Responsible Person: ${responsiblePerson}
- Responsible Person Contact: ${responsiblePersonContact}

Required Sections (include all, even if placeholder-only):
1. Scope and Purpose of AI Usage (map to AI Act Art. 3, ISO 42001 §6)
2. AI Use Cases and Applications (map to AI Act Art. 4, ISO 42001 §6.2)
3. Data Handling and Privacy Considerations (map to AI Act Art. 10, GDPR Art. 5, ISO 42001 §8.2)
4. Human Oversight Procedures (map to AI Act Art. 14, ISO 42001 §7.3)
5. Risk Management and Classification (map to AI Act Art. 8, 9, ISO 42001 §8.1)
6. Model Governance and Retraining Procedures (map to AI Act Art. 10, ISO 42001 §8.3)
7. Responsibilities and Accountability (map to AI Act Art. 6, ISO 42001 §5.3)
8. Contact Information for responsible person
9. Mapping Appendix (list all sections with their framework references)
10. Last updated: YYYY-MM-DD (use the actual current date in YYYY-MM-DD format, for example: Last updated: 2024-12-19)

Critical Required Articles (address clearly and cite):
- AI Act Art. 3: scope and key AI system definitions used by the company.
- AI Act Art. 4: confirm prohibited practices are not used.
- AI Act Art. 8–9: describe risk classification and risk management.
- AI Act Art. 10: explain data governance and training data quality.
- AI Act Art. 14: describe ${humanOversightLevel} human oversight and intervention.
- AI Act Art. 6: explain how AI systems are classified and whether they are high-risk.

Important:
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details above, including Responsible Person name and contact.
- Include inline mapping notes like "(AI Act Art. 9 – Risk Management)" or "(ISO 42001 §6.2 – AI System Life Cycle)".
- The Mapping Appendix must list each section with its framework references.
- Set policy_type to "ai_usage" in METAJSON.
- Set jurisdictions to [] (empty array for AI Usage Policy).
- Set placeholders_present to true if any [Action Required: ...] appears in the policy.
    `.trim();
  }

  if (
    policyType === "ai-governance-policy" ||
    policyType === "ai_governance_policy"
  ) {
    const companyName =
      r.company_name || "[Action Required: Provide Company Name]";
    const aiGovernanceOwnerRole =
      r.ai_governance_owner_role?.trim() ||
      "[Action Required: Specify AI Governance Owner Role]";
    // Extract governance owner name and contact - check multiple possible fields
    const aiGovernanceOwnerName =
      r.ai_governance_owner_name?.trim() ||
      r.governance_owner_name?.trim() ||
      "[Action Required: Full Name of AI Governance Owner]";
    const aiGovernanceOwnerContact =
      r.ai_governance_owner_contact?.trim() ||
      r.governance_owner_contact?.trim() ||
      r.governance_owner_email?.trim() ||
      r.cto_contact?.trim() ||
      r.contact_email?.trim() ||
      "[Action Required: Please provide contact information for the CTO]";
    const documentationFrequency =
      r.documentation_frequency ||
      "[Action Required: Specify Documentation Frequency]";
    const principles = Array.isArray(r.responsible_ai_principles)
      ? r.responsible_ai_principles.length > 0
        ? r.responsible_ai_principles.join(", ")
        : "[Action Required: Specify Responsible AI Principles]"
      : r.responsible_ai_principles ||
        "[Action Required: Specify Responsible AI Principles]";
    const trainingProvided =
      r.training_provided || "[Action Required: Specify Training Provided]";
    const incidentReportingProcedure =
      r.incident_reporting_procedure?.trim() ||
      r.incident_reporting_procedure_details?.trim() ||
      "[Action Required: Please provide details on the incident reporting and response procedures]";

    return `Generate an **AI Governance & Ethics Policy** for ${companyName}.

Coverage Targets:
- GDPR: ≥20% (Minimal - AI governance policies focus on governance structures, GDPR is minimal)
- AI Act: ≥70% (Primary focus - AI governance policies must comprehensively address AI Act governance requirements)
- ISO 42001: ≥70% (Primary focus - AI governance policies should comprehensively address ISO 42001 governance requirements)

Company Details:
- Name: ${companyName}
- AI Governance Owner Role: ${aiGovernanceOwnerRole}
- AI Governance Owner Name: ${aiGovernanceOwnerName}
- AI Governance Owner Contact: ${aiGovernanceOwnerContact}
- Documentation Frequency: ${documentationFrequency}
- Responsible AI Principles: ${principles}
- Training Provided: ${trainingProvided}
- Incident Reporting Procedure: ${incidentReportingProcedure}

Required Sections (include all, even if placeholder-only):
1. Governance Framework and Organizational Structure (map to AI Act Art. 6, ISO 42001 §5)
2. Responsible AI Principles (Transparency, Fairness, Accountability) (map to AI Act Art. 10, ISO 42001 §4.2)
3. Documentation and Review Procedures (map to AI Act Art. 11, ISO 42001 §8.4)
4. Training and Awareness Programs (map to AI Act Art. 4, ISO 42001 §7.2)
5. Incident Reporting and Response Procedures (map to AI Act Art. 73, ISO 42001 §8.5)
6. Monitoring and Continuous Improvement (map to AI Act Art. 12, ISO 42001 §10)
7. Compliance and Audit Procedures (map to AI Act Art. 26, ISO 42001 §9)
8. Contact Information for governance owner
9. Mapping Appendix (list all sections with their framework references)
10. Last updated: YYYY-MM-DD (use the actual current date in YYYY-MM-DD format, for example: Last updated: 2024-12-19)

Critical Required Articles (address clearly and cite):
- AI Act Art. 6: governance structure, roles, and responsibilities.
- AI Act Art. 10: transparency, explainability, and communication of AI decisions.
- AI Act Art. 11: documentation scope and ${documentationFrequency} review cadence.
- AI Act Art. 12: monitoring procedures and continuous improvement.
- AI Act Art. 26: compliance verification and audit procedures.
- AI Act Art. 73: incident reporting, escalation, and response.

Important:
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details above, including AI Governance Owner name, role, and contact information.
- For Incident Reporting Procedure: if details are provided in Company Details, use them directly. Only use a placeholder if truly missing.
- Include inline mapping notes like "(AI Act Art. 10 – Transparency)" or "(ISO 42001 §5.3 – Roles, Responsibilities and Authorities)".
- The Mapping Appendix must list each section with its framework references.
- Set policy_type to "ai_governance" in METAJSON.
- Set jurisdictions to [] (empty array for AI Governance Policy).
- Set placeholders_present to true if any [Action Required: ...] appears in the policy.
    `.trim();
  }

  return "Policy type not supported yet.";
}

/**
 * Remove Contact Information from Mapping Appendix
 * Contact Information should not appear in the Mapping Appendix as it has no framework references
 */
export function removeContactInfoFromMappingAppendix(content: string): string {
  if (!content || typeof content !== "string") {
    return content;
  }

  // Find the Mapping Appendix section
  const mappingAppendixRegex = /(#{1,3}\s*Mapping\s+Appendix[\s\S]*?)(?=#{1,3}\s*Last\s+updated|$)/i;
  const match = content.match(mappingAppendixRegex);
  
  if (!match) {
    return content; // No mapping appendix found, return as-is
  }

  const mappingAppendix = match[1];
  const beforeAppendix = content.substring(0, match.index!);
  const afterAppendix = content.substring(match.index! + match[0].length);

  // Remove lines containing "Contact Information" from the mapping appendix
  // This handles various formats:
  // - "Contact Information" (standalone)
  // - "Contact Information (GDPR Art. X)" (with fake references)
  // - "- Contact Information" (list item)
  // - "| Contact Information |" (table row)
  const cleanedAppendix = mappingAppendix
    .split('\n')
    .filter(line => {
      const lineLower = line.toLowerCase().trim();
      // Skip lines that contain "Contact Information" but keep the section header
      if (lineLower.includes('contact information')) {
        // Check if it's the section header itself (starts with #)
        if (lineLower.match(/^#{1,3}\s*contact\s+information/i)) {
          return false; // Remove Contact Information section header if it appears in appendix
        }
        // Check if it's a mapping entry (contains framework references or is a list/table item)
        if (
          lineLower.includes('gdpr') ||
          lineLower.includes('ai act') ||
          lineLower.includes('iso') ||
          lineLower.startsWith('-') ||
          lineLower.startsWith('|') ||
          lineLower.match(/^\s*contact\s+information/i)
        ) {
          return false; // Remove Contact Information mapping entries
        }
      }
      return true;
    })
    .join('\n');

  // Reconstruct content
  return beforeAppendix + cleanedAppendix + afterAppendix;
}
