import { z } from "zod";

// Zod schemas for runtime validation
export const PrivacyQuestionnaireSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  jurisdictions: z.array(
    z.enum(["GDPR (EU)", "CCPA (California)", "UK GDPR", "PIPEDA (Canada)"])
  ).min(1, "At least one jurisdiction is required"),
  data_collected: z.array(
    z.enum(["Email", "Name", "IP address", "Device data", "Payment info"])
  ).min(1, "At least one data type is required"),
  purpose_of_processing: z.string().min(1, "Purpose of processing is required"),
  third_parties: z.enum(["Yes", "No"]),
  cookies_used: z.enum(["Yes", "No"]),
  data_retention: z.enum([
    "30 days",
    "6 months",
    "1 year",
    "Indefinitely",
    "Until request for deletion",
  ]),
  dpo_contact: z.string().email("Valid email address is required for DPO contact"),
});

export const AIUsageQuestionnaireSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  ai_used_where: z.array(
    z.enum(["support", "content", "analytics", "coding"])
  ).min(1, "At least one AI usage location is required"),
  ai_model_provider: z.enum(["OpenAI", "Anthropic", "open-source", "other"]),
  data_sent_to_models: z.string().min(1, "Data sent to models description is required"),
  human_oversight_level: z.enum(["low", "medium", "high"]),
  ai_risk_rating: z.enum(["low", "medium", "high"]),
  ai_retraining_frequency: z.enum(["never", "quarterly", "annually", "as-needed"]),
  responsible_person: z.string().min(1, "Responsible person is required"),
});

export const AIGovernanceQuestionnaireSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  ai_governance_owner_role: z.string().min(1, "AI governance owner role is required"),
  documentation_frequency: z.enum(["quarterly", "annually"]),
  responsible_ai_principles: z.array(
    z.enum(["Transparency", "Fairness", "Accountability"])
  ).min(1, "At least one responsible AI principle is required"),
  training_provided: z.enum(["Yes", "No"]),
  incident_reporting_procedure: z.enum(["Yes", "No"]),
});

// TypeScript types inferred from Zod schemas
export type PrivacyQuestionnaire = z.infer<typeof PrivacyQuestionnaireSchema>;
export type AIUsageQuestionnaire = z.infer<typeof AIUsageQuestionnaireSchema>;
export type AIGovernanceQuestionnaire = z.infer<typeof AIGovernanceQuestionnaireSchema>;

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

/**
 * RuleApplicability context derived from questionnaire answers
 * Determines which compliance rules apply to a specific company/policy
 */
export type RuleApplicability = {
  usesAIForPersonalData?: boolean;
  deploysHighRiskAI?: boolean;
  offersAIAsProductInEU?: boolean;
  usesAutomatedDecisionMaking?: boolean;
  processesSpecialCategoryData?: boolean;
  hasInternationalTransfers?: boolean;
  usesThirdPartyProcessors?: boolean;
  hasHighRiskProcessing?: boolean;
};

/**
 * Function type for rule-level applicability checks
 * Returns true if the rule applies given the context
 */
export type ApplicabilityFunction = (context: RuleApplicability) => boolean;