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
  const list = (a.jurisdictions ?? a.jurisdiction ?? []) as string[];
  return Array.isArray(list) && list.length
    ? list.join(", ")
    : "None specified";
}

const SYSTEM_PROMPT_BASE = `You are a compliance officer writing AI Act + ISO 42001–aligned documentation for an EU B2B SaaS. Generate clear, defensible policies referencing relevant articles. Include mapping notes like '(AI Act Art. 9 – Risk Management)' or '(GDPR Art. 6 – Lawful Basis)' or '(ISO 42001 §8.2 – Privacy)' inline where applicable.`;

export function buildPrompt(policyType: string, responses: Answers) {
  if (policyType === "privacy-policy" || policyType === "privacy_policy") {
    return `
${SYSTEM_PROMPT_BASE}

Generate a **Privacy Policy** for ${responses.company_name}.

Company Details:
- Name: ${responses.company_name}
- Jurisdictions: ${getJurisdictions(responses)}
- Data Collected: ${(responses.data_collected ?? []).join(", ")}
- Purpose of Processing: ${responses.purpose_of_processing || "Not specified"}
- Shares with Third Parties: ${responses.third_parties}
- Uses Cookies: ${responses.cookies_used}
- Data Retention: ${responses.data_retention}
- DPO/Privacy Contact: ${responses.dpo_contact || "Not specified"}

Write a clear, professional Privacy Policy in **Markdown** format with H1–H3 headings and short paragraphs. Include:
- Data collection categories & purposes (map to GDPR Art. 6, 7, 13)
- Cookies and similar technologies (reference Cookie Policy if applicable)
- Third-party sharing/disclosure (if any) (map to GDPR Art. 13, 14)
- Rights/transparency (GDPR Art. 15-22) and notices (CCPA), in plain English
- Data retention & deletion (map to GDPR Art. 5, 17)
- Security measures (high-level) (map to GDPR Art. 32, ISO 42001 §8.2)
- Contact info including DPO/privacy contact
- "Last updated: [current date in YYYY-MM-DD format]"

Include inline mapping notes in parentheses where relevant, e.g., "(GDPR Art. 13 – Information to be provided)" or "(ISO 42001 §8.2 – Privacy)".

Return only the policy content in Markdown format.
    `.trim();
  }

  if (policyType === "cookie-policy") {
    const juris = getJurisdictions(responses);
    const usesCookies = responses.cookies_used === "Yes";
    const third = responses.third_parties === "Yes";

    const cookieUseNote = usesCookies
      ? "Describe categories (strictly necessary, functional, analytics, advertising), purposes, typical examples, and retention."
      : "State that non-essential cookies are not intentionally used; clarify strictly necessary cookies/local storage may still be used for core functionality; explain browser controls.";

    const thirdPartyNote = third
      ? "Include third-party cookies (e.g., analytics/ads), how they are set, links to their policies, and opt-out guidance."
      : "State that third-party cookies are not used; note that if this changes the policy will be updated.";

    return `
You are a compliance-savvy legal/technical writer. Produce a concise, human-readable **Cookie Policy** for **${responses.company_name}** in **Markdown**.

Context
- Jurisdictions to align with: ${juris}
- Uses cookies: ${responses.cookies_used}
- Shares data with third parties: ${responses.third_parties}
- Typical data retention preference: ${responses.data_retention}

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
    const aiUsedWhere = Array.isArray(responses.ai_used_where)
      ? responses.ai_used_where.join(", ")
      : responses.ai_used_where || "Not specified";

    return `
${SYSTEM_PROMPT_BASE}

Generate an **AI Usage Policy** for ${responses.company_name}.

Company Details:
- Name: ${responses.company_name}
- AI Used Where: ${aiUsedWhere}
- AI Model Provider: ${responses.ai_model_provider || "Not specified"}
- Data Sent to Models: ${responses.data_sent_to_models || "Not specified"}
- Human Oversight Level: ${responses.human_oversight_level || "Not specified"}
- AI Risk Rating: ${responses.ai_risk_rating || "Not specified"}
- AI Retraining Frequency: ${responses.ai_retraining_frequency || "Not specified"}
- Responsible Person: ${responses.responsible_person || "Not specified"}

Write a clear, professional AI Usage Policy in **Markdown** format with H1–H3 headings. Include:
- Scope and purpose of AI usage within the organization (map to AI Act Art. 3, ISO 42001 §6)
- AI use cases and applications (map to AI Act Art. 4, ISO 42001 §6.2)
- Data handling and privacy considerations (map to AI Act Art. 10, GDPR Art. 5, ISO 42001 §8.2)
- Human oversight procedures (map to AI Act Art. 14, ISO 42001 §7.3)
- Risk management and classification (map to AI Act Art. 8, 9, ISO 42001 §8.1)
- Model governance and retraining procedures (map to AI Act Art. 10, ISO 42001 §8.3)
- Responsibilities and accountability (map to AI Act Art. 6, ISO 42001 §5.3)
- Contact information for responsible person
- "Last updated: [current date in YYYY-MM-DD format]"

Include inline mapping notes in parentheses where relevant, e.g., "(AI Act Art. 9 – Risk Management)" or "(ISO 42001 §6.2 – AI System Life Cycle)".

Return only the policy content in Markdown format.
    `.trim();
  }

  if (
    policyType === "ai-governance-policy" ||
    policyType === "ai_governance_policy"
  ) {
    const principles = Array.isArray(responses.responsible_ai_principles)
      ? responses.responsible_ai_principles.join(", ")
      : responses.responsible_ai_principles || "Not specified";

    return `
${SYSTEM_PROMPT_BASE}

Generate an **AI Governance & Ethics Policy** for ${responses.company_name}.

Company Details:
- Name: ${responses.company_name}
- AI Governance Owner Role: ${responses.ai_governance_owner_role || "Not specified"}
- Documentation Frequency: ${responses.documentation_frequency || "Not specified"}
- Responsible AI Principles: ${principles}
- Training Provided: ${responses.training_provided || "No"}
- Incident Reporting Procedure: ${responses.incident_reporting_procedure || "No"}

Write a comprehensive, professional AI Governance & Ethics Policy in **Markdown** format with H1–H3 headings. Include:
- Governance framework and organizational structure (map to AI Act Art. 6, ISO 42001 §5)
- Responsible AI principles (Transparency, Fairness, Accountability) (map to AI Act Art. 10, ISO 42001 §4.2)
- Documentation and review procedures (map to AI Act Art. 11, ISO 42001 §8.4)
- Training and awareness programs (map to AI Act Art. 4, ISO 42001 §7.2)
- Incident reporting and response procedures (map to AI Act Art. 73, ISO 42001 §8.5)
- Monitoring and continuous improvement (map to AI Act Art. 12, ISO 42001 §10)
- Compliance and audit procedures (map to AI Act Art. 26, ISO 42001 §9)
- Contact information for governance owner
- "Last updated: [current date in YYYY-MM-DD format]"

Include inline mapping notes in parentheses where relevant, e.g., "(AI Act Art. 10 – Transparency)" or "(ISO 42001 §5.3 – Roles, Responsibilities and Authorities)".

Return only the policy content in Markdown format.
    `.trim();
  }

  return "Policy type not supported yet.";
}
