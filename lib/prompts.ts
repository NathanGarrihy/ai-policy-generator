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

## Citation Format

Include inline citations where relevant using these formats:
- GDPR: (GDPR Art. 6)
- AI Act: (AI Act Art. 9)
- ISO 42001: (ISO 42001 §8.2)

Citations should be included naturally where they add value and help demonstrate compliance coverage.

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

## Format Reminders for GPT-3.5

1. Write the policy content in Markdown
2. Wrap it with these delimiters:
-----BEGIN POLICY-MARKDOWN-----
[policy content]
-----END POLICY-MARKDOWN-----

3. Add METAJSON block:
-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "${policyTypeNormalized}",
  "placeholders_present": false,
  "jurisdictions": [],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": [...]
}
-----END POLICY-METAJSON-----

Important: Use valid JSON in METAJSON (no trailing commas). Include citations naturally where relevant.`;
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
8. Data Breach Notification (map to GDPR Art. 33, 34)
9. International Data Transfers (map to GDPR Art. 44, 46, 48)
10. Contact Information (including DPO/privacy contact)
11. Mapping Appendix (list all sections with their framework references - EXCLUDE Contact Information as it has no framework references)
12. Last updated: YYYY-MM-DD (use the actual current date in YYYY-MM-DD format, for example: Last updated: 2024-12-19)

## GDPR Citation Guidance

Include citations for relevant GDPR articles where they apply. Key articles to consider:
- (GDPR Art. 5) - Use when discussing data processing principles (lawfulness, fairness, transparency, purpose limitation, data minimization)
- (GDPR Art. 6) - Use when explaining lawful basis for processing (consent, contract, legal obligation, legitimate interests)
- (GDPR Art. 7) - Use when explaining how consent is obtained, that it can be withdrawn, and how to withdraw it
- (GDPR Art. 13) - Use when providing information about data collection (controller identity, purposes, legal basis, retention, rights)
- (GDPR Art. 15) - Use when explaining right of access to personal data
- (GDPR Art. 16) - Use when explaining right to rectification of inaccurate data
- (GDPR Art. 17) - Use when explaining right to erasure (right to be forgotten)
- (GDPR Art. 18) - Use when explaining right to restriction of processing
- (GDPR Art. 20) - Use when explaining right to data portability (receive data in structured, machine-readable format)
- (GDPR Art. 21) - Use when explaining right to object to processing
- (GDPR Art. 32) - Use when describing technical and organizational security measures
- (GDPR Art. 33) - Use when explaining breach notification to supervisory authority within 72 hours
- (GDPR Art. 34) - Use when explaining communication of breach to affected data subjects
- (GDPR Art. 44) - Use when discussing international data transfers and safeguards
- (GDPR Art. 46) - Use when discussing Standard Contractual Clauses or other transfer mechanisms
- (GDPR Art. 48) - Use when stating we do not transfer data based on unauthorized third-country judgments

Example sentences with citations:
"We process your personal data based on lawful grounds including consent, contractual necessity, and legitimate interests (GDPR Art. 6)."
"You may withdraw your consent at any time by contacting us, without affecting the lawfulness of prior processing (GDPR Art. 7)."
"You have the right to receive your personal data in a structured, commonly used, machine-readable format (GDPR Art. 20)."
"In the event of a personal data breach likely to result in risk to your rights, we will notify the supervisory authority within 72 hours (GDPR Art. 33)."
"If a breach is likely to result in high risk to your rights and freedoms, we will communicate the breach to you without undue delay (GDPR Art. 34)."
"We do not transfer personal data based on court orders or judgments from third countries that are not recognized under EU law (GDPR Art. 48)."

Important:
- Include citations where they naturally fit and demonstrate compliance
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
- AI Act: ≥70% (PRIMARY FOCUS - AI usage policies MUST comprehensively address AI Act requirements with explicit citations)
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

Required Sections (include AI Act citations where relevant):
1. Scope and Purpose of AI Usage (MUST cite: AI Act Art. 3 for definitions, ISO 42001 §6)
2. AI Use Cases and Applications (MUST cite: AI Act Art. 4 for prohibited practices, AI Act Art. 52 for transparency, ISO 42001 §6.2)
3. Data Handling and Privacy Considerations (MUST cite: AI Act Art. 10 for data governance, GDPR Art. 5, ISO 42001 §8.2)
4. Human Oversight Procedures (MUST cite: AI Act Art. 14 for human oversight, ISO 42001 §7.3)
5. Risk Management and Classification (MUST cite: AI Act Art. 6 for classification, AI Act Art. 9 for risk management, ISO 42001 §8.1)
6. Model Governance and Retraining Procedures (MUST cite: AI Act Art. 10, AI Act Art. 11 for documentation, ISO 42001 §8.3)
7. Responsibilities and Accountability (MUST cite: AI Act Art. 26 for provider obligations, ISO 42001 §5.3)
8. Contact Information for responsible person
9. Mapping Appendix (list all sections with their framework references)
10. Last updated: YYYY-MM-DD (use the actual current date in YYYY-MM-DD format, for example: Last updated: 2024-12-19)

## AI Act Citation Guidance

Include citations for relevant AI Act articles where they apply. Key articles to consider:
- (AI Act Art. 3) - Use in Scope section when defining AI systems
- (AI Act Art. 4) - Use when discussing prohibited practices we avoid
- (AI Act Art. 5) - Use when discussing AI literacy and training
- (AI Act Art. 6) - Use when classifying AI system risk levels
- (AI Act Art. 9) - Use when describing risk management procedures
- (AI Act Art. 10) - Use when discussing data governance and quality
- (AI Act Art. 11) - Use when discussing documentation requirements
- (AI Act Art. 12) - Use when discussing logging and record-keeping
- (AI Act Art. 13) - Use when discussing transparency to users
- (AI Act Art. 14) - Use when describing ${humanOversightLevel} human oversight
- (AI Act Art. 26) - Use when discussing compliance and quality management
- (AI Act Art. 52) - Use when discussing transparency for AI interactions
- (AI Act Art. 73) - Use when discussing incident reporting

Example sentence with citation:
"We classify our AI systems according to their risk level and intended purpose (AI Act Art. 6). Our AI systems are not used for prohibited practices such as subliminal manipulation or social scoring (AI Act Art. 4)."

Important:
- EVERY section about AI MUST have at least one (AI Act Art. X) citation
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details above
- Include inline mapping notes like "(AI Act Art. 9 – Risk Management)" or "(ISO 42001 §6.2 – AI System Life Cycle)"
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
- AI Act: ≥70% (PRIMARY FOCUS - AI governance policies MUST comprehensively address AI Act requirements with explicit citations)
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

Required Sections (include AI Act citations where relevant):
1. Governance Framework and Organizational Structure (MUST cite: AI Act Art. 6, AI Act Art. 26 for provider obligations, ISO 42001 §5)
2. Responsible AI Principles (Transparency, Fairness, Accountability) (MUST cite: AI Act Art. 10, AI Act Art. 13 for transparency, AI Act Art. 27 for fundamental rights, ISO 42001 §4.2)
3. Documentation and Review Procedures (MUST cite: AI Act Art. 11 for documentation, AI Act Art. 12 for record-keeping, ISO 42001 §8.4)
4. Training and Awareness Programs (MUST cite: AI Act Art. 5 for AI literacy, AI Act Art. 4 for prohibited practices, ISO 42001 §7.2)
5. Incident Reporting and Response Procedures (MUST cite: AI Act Art. 73 for incident reporting, ISO 42001 §8.5)
6. Monitoring and Continuous Improvement (MUST cite: AI Act Art. 9 for risk management, AI Act Art. 12, ISO 42001 §10)
7. Compliance and Audit Procedures (MUST cite: AI Act Art. 26 for compliance, AI Act Art. 8, ISO 42001 §9)
8. Contact Information for governance owner
9. Mapping Appendix (list all sections with their framework references)
10. Last updated: YYYY-MM-DD (use the actual current date in YYYY-MM-DD format, for example: Last updated: 2024-12-19)

## CRITICAL: AI Act Citation Requirements (MINIMUM 12 AI Act citations required)

You MUST include inline citations for ALL of these AI Act articles:
- (AI Act Art. 3) - Use when defining AI systems and scope
- (AI Act Art. 4) - Use when discussing prohibited practices employees must avoid
- (AI Act Art. 5) - Use when discussing AI literacy and training requirements
- (AI Act Art. 6) - Use when discussing governance structure and risk classification
- (AI Act Art. 8) - Use when discussing compliance requirements
- (AI Act Art. 9) - Use when describing risk management system
- (AI Act Art. 10) - Use when discussing transparency and data governance
- (AI Act Art. 11) - Use when discussing ${documentationFrequency} documentation and review
- (AI Act Art. 12) - Use when discussing monitoring, logging, and record-keeping
- (AI Act Art. 13) - Use when discussing transparency obligations
- (AI Act Art. 14) - Use when discussing human oversight requirements
- (AI Act Art. 26) - Use when discussing provider obligations and compliance verification
- (AI Act Art. 27) - Use when discussing fundamental rights impact assessment
- (AI Act Art. 52) - Use when discussing transparency for AI systems
- (AI Act Art. 73) - Use when discussing incident reporting and escalation procedures

Example sentence with citation:
"The ${aiGovernanceOwnerRole} is responsible for ensuring our AI systems comply with regulatory requirements (AI Act Art. 26). We maintain comprehensive documentation of all AI systems (AI Act Art. 11) and ensure transparency in AI decision-making (AI Act Art. 10)."

Important:
- EVERY section MUST have at least one (AI Act Art. X) citation
- DO NOT use [Action Required: ...] placeholders if the information is provided in Company Details above
- For Incident Reporting Procedure: if details are provided in Company Details, use them directly
- Include inline mapping notes like "(AI Act Art. 10 – Transparency)" or "(ISO 42001 §5.3 – Roles, Responsibilities and Authorities)"
- The Mapping Appendix must list each section with its framework references
- Set policy_type to "ai_governance" in METAJSON
- Set jurisdictions to [] (empty array for AI Governance Policy)
- Set placeholders_present to true if any [Action Required: ...] appears in the policy
    `.trim();
  }

  return "Policy type not supported yet.";
}

