// lib/prompts.ts
import type { PrivacyQuestionnaire } from "@/lib/types";

type Answers = Partial<PrivacyQuestionnaire> & Record<string, any>;

function getJurisdictions(a: Answers) {
  // Support both keys used across the codebase: "jurisdictions" (current) and "jurisdiction" (legacy)
  const list = (a.jurisdictions ?? a.jurisdiction ?? []) as string[];
  return Array.isArray(list) && list.length
    ? list.join(", ")
    : "None specified";
}

export function buildPrompt(policyType: string, responses: Answers) {
  if (policyType === "privacy-policy") {
    return `
You are a legal AI assistant generating a GDPR/CCPA-aware **Privacy Policy**.

Company Details:
- Name: ${responses.company_name}
- Jurisdictions: ${getJurisdictions(responses)}
- Data Collected: ${(responses.data_collected ?? []).join(", ")}
- Shares with Third Parties: ${responses.third_parties}
- Uses Cookies: ${responses.cookies_used}
- Data Retention: ${responses.data_retention}

Write a clear, professional Privacy Policy in **Markdown** with headings and short paragraphs. Include:
- Data collection categories & purposes
- Cookies and similar technologies (reference Cookie Policy)
- Third-party sharing/disclosure (if any)
- Rights/transparency (GDPR) and notices (CCPA), in plain English
- Data retention & deletion
- Security (high-level)
- Contact info
- "Last updated: YYYY-MM-DD"
Return only the policy content.
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

  return "Policy type not supported yet.";
}
