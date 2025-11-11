export type ComplianceRule = {
  framework: "GDPR" | "AI_ACT" | "ISO_42001";
  article_ref: string;
  clause_text: string;
  required: boolean;
  keywords: string[]; // Keywords to search for in policy content
};

export const GDPR_RULES: ComplianceRule[] = [
  {
    framework: "GDPR",
    article_ref: "Art. 6",
    clause_text: "Lawful basis for processing",
    required: true,
    keywords: ["lawful basis", "legal basis", "processing basis", "art. 6"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 7",
    clause_text: "Conditions for consent",
    required: true,
    keywords: ["consent", "opt-in", "opt-out", "art. 7"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 13",
    clause_text: "Information to be provided when collecting data",
    required: true,
    keywords: ["information provided", "data collection notice", "art. 13"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 14",
    clause_text: "Information to be provided when data not obtained from data subject",
    required: false,
    keywords: ["indirect collection", "third party data", "art. 14"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 15",
    clause_text: "Right of access",
    required: true,
    keywords: ["right of access", "data access", "art. 15"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 16",
    clause_text: "Right to rectification",
    required: true,
    keywords: ["right to rectification", "correct data", "art. 16"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 17",
    clause_text: "Right to erasure ('right to be forgotten')",
    required: true,
    keywords: ["right to erasure", "right to be forgotten", "delete data", "art. 17"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 18",
    clause_text: "Right to restriction of processing",
    required: true,
    keywords: ["restriction of processing", "art. 18"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 20",
    clause_text: "Right to data portability",
    required: true,
    keywords: ["data portability", "export data", "art. 20"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 21",
    clause_text: "Right to object",
    required: true,
    keywords: ["right to object", "object to processing", "art. 21"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 32",
    clause_text: "Security of processing",
    required: true,
    keywords: ["security", "data security", "technical measures", "art. 32"],
  },
  {
    framework: "GDPR",
    article_ref: "Art. 5",
    clause_text: "Principles relating to processing of personal data",
    required: true,
    keywords: ["data minimization", "purpose limitation", "storage limitation", "art. 5"],
  },
];

export const AI_ACT_RULES: ComplianceRule[] = [
  {
    framework: "AI_ACT",
    article_ref: "Art. 3",
    clause_text: "Scope and definitions",
    required: true,
    keywords: ["ai system", "artificial intelligence", "scope", "art. 3"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 4",
    clause_text: "Prohibited AI practices",
    required: true,
    keywords: ["prohibited practices", "banned ai", "art. 4"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 6",
    clause_text: "Classification rules for high-risk AI systems",
    required: true,
    keywords: ["high-risk", "risk classification", "art. 6"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 8",
    clause_text: "Compliance procedures for high-risk AI systems",
    required: false,
    keywords: ["compliance procedures", "conformity assessment", "art. 8"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 9",
    clause_text: "Risk management system",
    required: true,
    keywords: ["risk management", "risk assessment", "art. 9"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 10",
    clause_text: "Data and data governance",
    required: true,
    keywords: ["data governance", "training data", "data quality", "art. 10"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 11",
    clause_text: "Technical documentation",
    required: true,
    keywords: ["technical documentation", "documentation", "art. 11"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 12",
    clause_text: "Record keeping",
    required: true,
    keywords: ["record keeping", "logs", "audit trail", "art. 12"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 14",
    clause_text: "Human oversight",
    required: true,
    keywords: ["human oversight", "human in the loop", "art. 14"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 26",
    clause_text: "Obligations of providers of high-risk AI systems",
    required: false,
    keywords: ["provider obligations", "art. 26"],
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 73",
    clause_text: "Reporting of serious incidents",
    required: true,
    keywords: ["incident reporting", "serious incident", "art. 73"],
  },
];

export const ISO_42001_RULES: ComplianceRule[] = [
  {
    framework: "ISO_42001",
    article_ref: "§4.2",
    clause_text: "Understanding the needs and expectations of interested parties",
    required: true,
    keywords: ["interested parties", "stakeholders", "iso 42001", "4.2"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§5.3",
    clause_text: "Roles, responsibilities and authorities",
    required: true,
    keywords: ["roles", "responsibilities", "authorities", "iso 42001", "5.3"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§6.2",
    clause_text: "AI system life cycle",
    required: true,
    keywords: ["life cycle", "lifecycle", "ai system", "iso 42001", "6.2"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§7.2",
    clause_text: "Competence",
    required: true,
    keywords: ["competence", "training", "skills", "iso 42001", "7.2"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§7.3",
    clause_text: "Awareness",
    required: true,
    keywords: ["awareness", "understanding", "iso 42001", "7.3"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.1",
    clause_text: "Operational planning and control",
    required: true,
    keywords: ["operational planning", "control", "iso 42001", "8.1"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.2",
    clause_text: "Privacy",
    required: true,
    keywords: ["privacy", "data protection", "iso 42001", "8.2"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.3",
    clause_text: "AI system development",
    required: true,
    keywords: ["development", "ai system development", "iso 42001", "8.3"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.4",
    clause_text: "Documentation",
    required: true,
    keywords: ["documentation", "documented information", "iso 42001", "8.4"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.5",
    clause_text: "Incident management",
    required: true,
    keywords: ["incident management", "incident response", "iso 42001", "8.5"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§9",
    clause_text: "Performance evaluation",
    required: true,
    keywords: ["performance evaluation", "monitoring", "measurement", "iso 42001", "9"],
  },
  {
    framework: "ISO_42001",
    article_ref: "§10",
    clause_text: "Improvement",
    required: true,
    keywords: ["improvement", "continuous improvement", "iso 42001", "10"],
  },
];

export const ALL_RULES: ComplianceRule[] = [
  ...GDPR_RULES,
  ...AI_ACT_RULES,
  ...ISO_42001_RULES,
];

