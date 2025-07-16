export const privacyPolicyQuestions = [
  {
    id: "company_name",
    label: "What is the name of your company?",
    type: "text",
    required: true,
  },
  {
    id: "jurisdiction",
    label: "Which regions/laws do you want to comply with?",
    type: "multi-select",
    options: ["GDPR (EU)", "CCPA (California)", "UK GDPR", "PIPEDA (Canada)"],
    required: true,
  },
  {
    id: "data_collected",
    label: "What types of personal data do you collect?",
    type: "multi-select",
    options: ["Email", "Name", "IP address", "Device data", "Payment info"],
    required: true,
  },
  {
    id: "third_parties",
    label: "Do you share data with third parties?",
    type: "yes-no",
    required: true,
  },
  {
    id: "cookies_used",
    label: "Do you use cookies or tracking technologies?",
    type: "yes-no",
    required: true,
  },
  {
    id: "data_retention",
    label: "How long do you retain personal data?",
    type: "dropdown",
    options: [
      "30 days",
      "6 months",
      "1 year",
      "Indefinitely",
      "Until request for deletion",
    ],
    required: false,
  },
];
