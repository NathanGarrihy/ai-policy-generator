export const aiUsagePolicyQuestions = [
  {
    id: "company_name",
    label: "What is the name of your company?",
    type: "text",
    required: true,
  },
  {
    id: "ai_used_where",
    label: "Where is AI used in your organization?",
    type: "multi-select",
    options: ["support", "content", "analytics", "coding"],
    required: true,
  },
  {
    id: "ai_model_provider",
    label: "Which AI model provider do you use?",
    type: "dropdown",
    options: ["OpenAI", "Anthropic", "open-source", "other"],
    required: true,
  },
  {
    id: "data_sent_to_models",
    label: "What data is sent to AI models?",
    type: "textarea",
    required: true,
    placeholder: "Describe the types of data sent to AI models (e.g., customer queries, user content, analytics data)",
  },
  {
    id: "human_oversight_level",
    label: "What is the level of human oversight?",
    type: "dropdown",
    options: ["low", "medium", "high"],
    required: true,
  },
  {
    id: "ai_risk_rating",
    label: "What is your AI risk rating?",
    type: "dropdown",
    options: ["low", "medium", "high"],
    required: true,
  },
  {
    id: "ai_retraining_frequency",
    label: "How often do you retrain or update AI models?",
    type: "dropdown",
    options: ["never", "quarterly", "annually", "as-needed"],
    required: true,
  },
  {
    id: "responsible_person",
    label: "Who is the responsible person for AI usage?",
    type: "text",
    required: true,
    placeholder: "Name or role of the person responsible",
  },
];

