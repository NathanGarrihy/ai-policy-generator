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
Each section should be 1–2 concise paragraphs followed by inline legal citations in this exact format:
(GDPR Art. 6), (AI Act Art. 9), (ISO 42001 §8.2)

Rules:
- Follow the section order provided by the template. Include every section even if empty or placeholder-only.
- Do not output reasoning, notes, disclaimers, or commentary. Only produce the final policy content.
- Insert [Action Required: ...] placeholders where user data is missing — never infer or invent.
- Include a Mapping Appendix at the end listing each section and its referenced frameworks.
- Finish the policy with this exact footer line: Last updated: [current date in YYYY-MM-DD format]

Output Format:
You MUST output your response in exactly two blocks. Follow this format exactly:

-----BEGIN POLICY-MARKDOWN-----
[Your complete policy text in Markdown format here]
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
    }
  ]
}
-----END POLICY-METAJSON-----

CRITICAL: 
- Start with -----BEGIN POLICY-MARKDOWN----- on its own line
- End with -----END POLICY-METAJSON----- on its own line
- Include all sections from the policy in the METAJSON sections array
- Set policy_type to match the policy type being generated ("privacy", "ai_usage", or "ai_governance")
- Set placeholders_present to true if any [Action Required: ...] appears in the policy, false otherwise
- The METAJSON must be valid JSON`;

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

    return `
${SYSTEM_PROMPT_BASE}

Generate a **Privacy Policy** for ${companyName}.

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
9. Mapping Appendix (list all sections with their framework references)
10. Last updated: [current date in YYYY-MM-DD format]

Important:
- Use placeholders [Action Required: ...] for any missing information
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
    const responsiblePerson =
      r.responsible_person?.trim() ||
      "[Action Required: Provide Responsible Person]";

    return `
${SYSTEM_PROMPT_BASE}

Generate an **AI Usage Policy** for ${companyName}.

Company Details:
- Name: ${companyName}
- AI Used Where: ${aiUsedWhere}
- AI Model Provider: ${aiModelProvider}
- Data Sent to Models: ${dataSentToModels}
- Human Oversight Level: ${humanOversightLevel}
- AI Risk Rating: ${aiRiskRating}
- AI Retraining Frequency: ${aiRetrainingFrequency}
- Responsible Person: ${responsiblePerson}

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
10. Last updated: [current date in YYYY-MM-DD format]

Important:
- Use placeholders [Action Required: ...] for any missing information
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
      r.incident_reporting_procedure ||
      "[Action Required: Specify Incident Reporting Procedure]";

    return `
${SYSTEM_PROMPT_BASE}

Generate an **AI Governance & Ethics Policy** for ${companyName}.

Company Details:
- Name: ${companyName}
- AI Governance Owner Role: ${aiGovernanceOwnerRole}
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
10. Last updated: [current date in YYYY-MM-DD format]

Important:
- Use placeholders [Action Required: ...] for any missing information
- Include inline mapping notes in parentheses: "(AI Act Art. 10 – Transparency)" or "(ISO 42001 §5.3 – Roles, Responsibilities and Authorities)"
- The Mapping Appendix must list each section with its framework references
- Set policy_type to "ai_governance" in METAJSON
- Set jurisdictions to [] (empty array for AI Governance Policy)
- Set placeholders_present to true if any [Action Required: ...] appears in the policy
    `.trim();
  }

  return "Policy type not supported yet.";
}
