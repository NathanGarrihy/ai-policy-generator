export type PrivacyQuestionnaire = {
  company_name: string;
  jurisdictions: Array<
    "GDPR (EU)" | "CCPA (California)" | "UK GDPR" | "PIPEDA (Canada)"
  >;
  data_collected: Array<
    "Email" | "Name" | "IP address" | "Device data" | "Payment info"
  >;
  third_parties: "Yes" | "No";
  cookies_used: "Yes" | "No";
  data_retention:
    | "30 days"
    | "6 months"
    | "1 year"
    | "Indefinitely"
    | "Until request for deletion";
  // Maybe in future:
  // service_description?: string; // used in ToS later
};

export type QuestionnaireRow = {
  id: string;
  user_id: string;
  policy_type: "privacy_policy";
  status: "draft" | "final";
  answers: PrivacyQuestionnaire;
  created_at: string;
  updated_at: string;
};
