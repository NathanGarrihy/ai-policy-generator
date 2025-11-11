export const aiGovernancePolicyQuestions = [
  {
    id: "company_name",
    label: "What is the name of your company?",
    type: "text",
    required: true,
  },
  {
    id: "ai_governance_owner_role",
    label: "What is the role of the AI governance owner?",
    type: "text",
    required: true,
    placeholder: "e.g., Chief Technology Officer, AI Ethics Lead",
  },
  {
    id: "documentation_frequency",
    label: "How often is AI governance documentation updated?",
    type: "dropdown",
    options: ["quarterly", "annually"],
    required: true,
  },
  {
    id: "responsible_ai_principles",
    label: "Which responsible AI principles do you follow?",
    type: "multi-select",
    options: ["Transparency", "Fairness", "Accountability"],
    required: true,
  },
  {
    id: "training_provided",
    label: "Is training provided to employees on AI governance?",
    type: "yes-no",
    required: true,
  },
  {
    id: "incident_reporting_procedure",
    label: "Do you have an incident reporting procedure for AI issues?",
    type: "yes-no",
    required: true,
  },
];

