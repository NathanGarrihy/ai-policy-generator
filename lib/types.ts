export type PrivacyQuestionnaire = {
  company_name: string;
  jurisdictions: Array<
    "GDPR (EU)" | "CCPA (California)" | "UK GDPR" | "PIPEDA (Canada)"
  >;
  data_collected: Array<
    "Email" | "Name" | "IP address" | "Device data" | "Payment info"
  >;
  purpose_of_processing: string;
  third_parties: "Yes" | "No";
  cookies_used: "Yes" | "No";
  data_retention:
    | "30 days"
    | "6 months"
    | "1 year"
    | "Indefinitely"
    | "Until request for deletion";
  dpo_contact: string;
  // Maybe in future:
  // service_description?: string; // used in ToS later
};

export type AIUsageQuestionnaire = {
  company_name: string;
  ai_used_where: Array<"support" | "content" | "analytics" | "coding">;
  ai_model_provider: "OpenAI" | "Anthropic" | "open-source" | "other";
  data_sent_to_models: string;
  human_oversight_level: "low" | "medium" | "high";
  ai_risk_rating: "low" | "medium" | "high";
  ai_retraining_frequency: "never" | "quarterly" | "annually" | "as-needed";
  responsible_person: string;
};

export type AIGovernanceQuestionnaire = {
  company_name: string;
  ai_governance_owner_role: string;
  documentation_frequency: "quarterly" | "annually";
  responsible_ai_principles: Array<
    "Transparency" | "Fairness" | "Accountability"
  >;
  training_provided: "Yes" | "No";
  incident_reporting_procedure: "Yes" | "No";
};

export type PolicyMapping = {
  id: string;
  policy_version_id: string;
  section_id: string;
  framework: "GDPR" | "AI_ACT" | "ISO_42001";
  article_ref: string;
  confidence: number;
  created_at: string;
};

export type PolicyReview = {
  id: string;
  policy_version_id: string;
  reviewer: string;
  accuracy_score: number;
  notes: string | null;
  created_at: string;
};

export type PolicyVersion = {
  id: string;
  user_id: string;
  policy_type: "privacy_policy" | "ai_usage_policy" | "ai_governance_policy";
  content: string;
  version_number: number;
  parent_version_id: string | null;
  framework_coverage: {
    gdpr_coverage?: number;
    ai_act_coverage?: number;
    iso_42001_coverage?: number;
  } | null;
  source_questionnaire_id: string;
  created_at: string;
  updated_at: string;
};

export type QuestionnaireRow = {
  id: string;
  user_id: string;
  policy_type: "privacy_policy" | "ai_usage_policy" | "ai_governance_policy";
  status: "draft" | "final";
  answers:
    | PrivacyQuestionnaire
    | AIUsageQuestionnaire
    | AIGovernanceQuestionnaire;
  created_at: string;
  updated_at: string;
};
