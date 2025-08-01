export function buildPrompt(
  policyType: string,
  responses: Record<string, any>
) {
  if (policyType === "privacy-policy") {
    return `
You are a legal AI assistant generating a privacy policy for a company.

Company Details:
- Name: ${responses.company_name}
- Jurisdiction: ${responses.jurisdiction?.join(", ")}
- Data Collected: ${responses.data_collected?.join(", ")}
- Shares with Third Parties: ${responses.third_parties}
- Uses Cookies: ${responses.cookies_used}
- Data Retention: ${responses.data_retention}

Write a clear, professional, GDPR-compliant privacy policy with headings. Include sections for data collection, user rights, cookies, third-party sharing, and security practices.
    `.trim();
  }

  return "Policy type not supported yet.";
}
