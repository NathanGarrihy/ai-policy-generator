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

const SYSTEM_PROMPT_BASE = `You are a compliance drafter generating EU-grade policies aligned with the GDPR, EU AI Act, and ISO/IEC 42001.
Write in clear, professional English suitable for procurement review. Use short, factual sentences and a neutral legal tone.

## Format Requirements

You MUST output your response in exactly two blocks with these exact delimiters:

-----BEGIN POLICY-MARKDOWN-----
[Your complete policy text in Markdown format here]
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

**Expected Heading Order**: Follow the section order provided in the user message. Include every section even if empty or placeholder-only.

**METAJSON Schema Fields**:
- policy_type: Must be "privacy", "ai_usage", or "ai_governance"
- placeholders_present: true if any [Action Required: ...] appears, false otherwise
- jurisdictions: Array of jurisdiction codes (e.g., ["GDPR_EU", "UK_GDPR"])
- coverage: Object with gdpr, ai_act, iso_42001 (set to 0, calculated later)
- sections: Array of section objects with id, title, and framework_refs (array of citation strings)

## Citation Format Accuracy

Use ONLY these exact citation formats. Do not deviate:
- GDPR: (GDPR Art. 6), (GDPR Art. 13), (GDPR Art. 15-22)
- AI Act: (AI Act Art. 3), (AI Act Art. 9), (AI Act Art. 14)
- ISO 42001: (ISO 42001 §8.2), (ISO 42001 §6.2), (ISO 42001 §5.3)

Each section should be 1–2 concise paragraphs followed by inline legal citations using the exact formats above.

## Coverage Thresholds

Generated policies must support achieving ≥70% PolicyCop coverage per policy type for primary frameworks:
- Privacy Policy: GDPR ≥70%, AI Act ≥40%, ISO 42001 ≥60%
- AI Usage Policy: GDPR ≥30%, AI Act ≥70%, ISO 42001 ≥70%
- AI Governance Policy: GDPR ≥20%, AI Act ≥70%, ISO 42001 ≥70%

Ensure comprehensive coverage of all required articles to meet these thresholds.

## Rules

- Follow the section order provided by the template. Include every section even if empty or placeholder-only.
- Do not output reasoning, notes, disclaimers, or commentary. Only produce the final policy content.
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details. Only use placeholders when data is truly missing.
- Include a Mapping Appendix at the end listing each section and its referenced frameworks.
- IMPORTANT: The Mapping Appendix should ONLY include sections that have framework references (GDPR articles, AI Act articles, ISO 42001 sections). DO NOT include "Contact Information" in the Mapping Appendix as it has no framework references.
- Finish the policy with this exact footer line: Last updated: YYYY-MM-DD (use the actual current date in YYYY-MM-DD format, for example: Last updated: 2024-12-19)

## DO NOT

- DO NOT hallucinate frameworks or articles that don't exist
- DO NOT add reasoning, explanations, or commentary outside the policy content
- DO NOT change the delimiter format (must be exactly -----BEGIN POLICY-MARKDOWN----- and -----END POLICY-MARKDOWN-----)
- DO NOT omit the METAJSON block
- DO NOT invent missing data - use [Action Required: ...] placeholders instead
- DO NOT change citation formats - use only (GDPR Art. X), (AI Act Art. X), (ISO 42001 §X.X)`;

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
    // For GPT-3.5, add more explicit step-by-step guidance and examples
    return `${SYSTEM_PROMPT_BASE}

## Step-by-Step Format Guidance (GPT-3.5)

1. First, write the complete policy content in Markdown format
2. Then, wrap it with the exact delimiters: -----BEGIN POLICY-MARKDOWN----- and -----END POLICY-MARKDOWN-----
3. Next, create the METAJSON block with all sections and their framework references
4. Wrap the METAJSON with: -----BEGIN POLICY-METAJSON----- and -----END POLICY-METAJSON-----

## Example Output Structure

-----BEGIN POLICY-MARKDOWN-----
# Introduction & Scope

[Policy content here with citations like (GDPR Art. 13)]

# Mapping Appendix

- Introduction & Scope: GDPR Art. 13

Last updated: 2024-12-19
-----END POLICY-MARKDOWN-----

-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "${policyType === "privacy-policy" || policyType === "privacy_policy" ? "privacy" : policyType === "ai-usage-policy" || policyType === "ai_usage_policy" ? "ai_usage" : "ai_governance"}",
  "placeholders_present": false,
  "jurisdictions": [],
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

## Citation Format Reminder (CRITICAL)

Before generating, remember to use ONLY these exact formats:
- (GDPR Art. 6) - NOT "GDPR Article 6" or "Art. 6 GDPR"
- (AI Act Art. 9) - NOT "EU AI Act Article 9" or "Art. 9 AI Act"
- (ISO 42001 §8.2) - NOT "ISO 42001 Section 8.2" or "§ 8.2"

Place citations inline after relevant sentences, not in separate lines.`;
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
- AI Act: ≥40% (Secondary - privacy policies may reference AI Act for AI-related data processing)
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

Critical Required Articles (MUST be comprehensively addressed):
- GDPR Art. 6 (Lawful basis for processing): Explicitly state the legal basis (consent, contract, legal obligation, vital interests, public task, or legitimate interests) for each type of processing. Example: "We process your email address based on your consent (GDPR Art. 6(1)(a)) and for contract performance (GDPR Art. 6(1)(b))."
- GDPR Art. 7 (Conditions for consent): Explain how consent is obtained, that it can be withdrawn, and how to withdraw. Example: "Consent is obtained through clear opt-in mechanisms and can be withdrawn at any time by contacting us."
- GDPR Art. 13 (Information to be provided): Include identity of controller, purposes, legal basis, retention period, and data subject rights. Example: "As the data controller, we process your data for [purpose] based on [legal basis] and retain it for [period]."
- GDPR Art. 15-22 (Data subject rights): Detail each right (access, rectification, erasure, restriction, portability, objection) and how to exercise them. Example: "You have the right to access your personal data (GDPR Art. 15), request rectification (GDPR Art. 16), request erasure (GDPR Art. 17), and object to processing (GDPR Art. 21)."
- GDPR Art. 32 (Security of processing): Describe technical and organizational security measures. Example: "We implement encryption, access controls, and regular security assessments to protect your data (GDPR Art. 32)."

Important:
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details above. Use actual data from Company Details.
- Include inline mapping notes in parentheses: "(GDPR Art. 13 – Information to be provided)" or "(ISO 42001 §8.2 – Privacy)"
- The Mapping Appendix must list each section with its framework references
- Set policy_type to "privacy" in METAJSON
- Set jurisdictions to ${JSON.stringify(
      jurisdictionList.length > 0
        ? jurisdictionList
        : ["[Action Required: Specify Jurisdictions]"]
    )}
- Set placeholders_present to true if any [Action Required: ...] appears in the policy
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

Critical Required Articles (MUST be comprehensively addressed):
- AI Act Art. 3 (Scope and definitions): Define AI systems used, their scope, and key terms. Example: "This policy applies to AI systems used for [purpose], defined as [definition] (AI Act Art. 3)."
- AI Act Art. 4 (Prohibited AI practices): State that prohibited practices are not used. Example: "We do not use AI systems for prohibited practices such as subliminal manipulation or social scoring (AI Act Art. 4)."
- AI Act Art. 8-9 (Risk management): Describe risk classification process and risk management system. Example: "We classify our AI systems as [risk level] and maintain a risk management system that identifies, analyzes, and mitigates risks (AI Act Art. 8, 9)."
- AI Act Art. 10 (Data and data governance): Explain data governance practices, training data quality, and data management. Example: "We implement data governance procedures to ensure training data quality and proper data management (AI Act Art. 10)."
- AI Act Art. 14 (Human oversight): Detail human oversight procedures and intervention mechanisms. Example: "We maintain ${humanOversightLevel} human oversight with regular monitoring and intervention capabilities (AI Act Art. 14)."
- AI Act Art. 6 (Classification rules): Explain how AI systems are classified and whether they are high-risk. Example: "Our AI systems are classified as [classification] based on [criteria] (AI Act Art. 6)."

Important:
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details above. Use actual data from Company Details, including Responsible Person name and contact.
- Include inline mapping notes in parentheses: "(AI Act Art. 9 – Risk Management)" or "(ISO 42001 §6.2 – AI System Life Cycle)"
- The Mapping Appendix must list each section with its framework references
- Set policy_type to "ai_usage" in METAJSON
- Set jurisdictions to [] (empty array for AI Usage Policy)
- Set placeholders_present to true if any [Action Required: ...] appears in the policy
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

Critical Required Articles (MUST be comprehensively addressed):
- AI Act Art. 6 (Governance structure): Describe organizational structure, roles, and responsibilities for AI governance. Example: "Our AI governance structure includes [role] as the AI Governance Owner, responsible for [responsibilities] (AI Act Art. 6)."
- AI Act Art. 10 (Transparency): Explain transparency measures, explainability requirements, and how AI decisions are communicated. Example: "We ensure transparency by [measures] and provide explanations for AI decisions (AI Act Art. 10)."
- AI Act Art. 11 (Documentation): Detail documentation requirements, what is documented, and review frequency. Example: "We document all AI-related activities and review them ${documentationFrequency} to ensure compliance (AI Act Art. 11)."
- AI Act Art. 12 (Monitoring): Describe monitoring procedures and continuous improvement processes. Example: "We monitor AI system performance and effectiveness, implementing improvements as needed (AI Act Art. 12)."
- AI Act Art. 26 (Compliance and audit): Explain compliance verification methods and audit procedures. Example: "We conduct regular audits to ensure compliance with AI Act requirements (AI Act Art. 26)."
- AI Act Art. 73 (Incident reporting): Detail incident reporting procedures, escalation paths, and response mechanisms. Example: "We have established incident reporting procedures that include [details] (AI Act Art. 73)."

Important:
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details above. Use actual data from Company Details, including AI Governance Owner name, role, and contact information.
- For Incident Reporting Procedure: If details are provided in Company Details, use them directly. Only use placeholder if truly missing.
- Include inline mapping notes in parentheses: "(AI Act Art. 10 – Transparency)" or "(ISO 42001 §5.3 – Roles, Responsibilities and Authorities)"
- The Mapping Appendix must list each section with its framework references
- Set policy_type to "ai_governance" in METAJSON
- Set jurisdictions to [] (empty array for AI Governance Policy)
- Set placeholders_present to true if any [Action Required: ...] appears in the policy
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
