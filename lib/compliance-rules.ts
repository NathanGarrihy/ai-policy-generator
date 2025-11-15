export type ComplianceRule = {
  framework: "GDPR" | "AI_ACT" | "ISO_42001";
  article_ref: string;
  clause_text: string;
  required: boolean;
  keywords: string[]; // Keywords to search for in policy content
  description?: string; // Optional description for better documentation
};

export const GDPR_RULES: ComplianceRule[] = [
  {
    framework: "GDPR",
    article_ref: "Art. 6",
    clause_text: "Lawful basis for processing",
    required: true,
    keywords: [
      "lawful basis",
      "legal basis",
      "processing basis",
      "legitimate interest",
      "contract",
      "legal obligation",
      "vital interests",
      "public task",
      "art. 6",
    ],
    description:
      "Processing must have a lawful basis: consent, contract, legal obligation, vital interests, public task, or legitimate interests",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 7",
    clause_text: "Conditions for consent",
    required: true,
    keywords: [
      "consent",
      "opt-in",
      "opt-out",
      "freely given",
      "specific",
      "informed",
      "unambiguous",
      "withdraw consent",
      "art. 7",
    ],
    description:
      "Consent must be freely given, specific, informed, and unambiguous, with easy withdrawal mechanism",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 13",
    clause_text: "Information to be provided when collecting data",
    required: true,
    keywords: [
      "information provided",
      "data collection notice",
      "privacy notice",
      "identity of controller",
      "purpose of processing",
      "legal basis",
      "retention period",
      "data subject rights",
      "art. 13",
    ],
    description:
      "When collecting data directly from data subjects, controllers must provide specific information about processing",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 14",
    clause_text: "Information to be provided when data not obtained from data subject",
    required: false,
    keywords: [
      "indirect collection",
      "third party data",
      "data not from subject",
      "source of data",
      "art. 14",
    ],
    description:
      "When data is not obtained directly from the data subject, additional information about the source must be provided",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 15",
    clause_text: "Right of access",
    required: true,
    keywords: [
      "right of access",
      "data access",
      "access request",
      "copy of data",
      "data subject access",
      "art. 15",
    ],
    description:
      "Data subjects have the right to obtain confirmation of processing and access to their personal data",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 16",
    clause_text: "Right to rectification",
    required: true,
    keywords: [
      "right to rectification",
      "correct data",
      "rectify data",
      "update data",
      "amend data",
      "art. 16",
    ],
    description:
      "Data subjects have the right to have inaccurate personal data rectified without undue delay",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 17",
    clause_text: "Right to erasure ('right to be forgotten')",
    required: true,
    keywords: [
      "right to erasure",
      "right to be forgotten",
      "delete data",
      "erase data",
      "remove data",
      "art. 17",
    ],
    description:
      "Data subjects have the right to have personal data erased under certain conditions",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 18",
    clause_text: "Right to restriction of processing",
    required: true,
    keywords: [
      "restriction of processing",
      "restrict processing",
      "suspend processing",
      "art. 18",
    ],
    description:
      "Data subjects have the right to restrict processing in certain circumstances",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 20",
    clause_text: "Right to data portability",
    required: true,
    keywords: [
      "data portability",
      "export data",
      "receive data",
      "machine readable",
      "structured format",
      "art. 20",
    ],
    description:
      "Data subjects have the right to receive their data in a structured, commonly used format and transmit it to another controller",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 21",
    clause_text: "Right to object",
    required: true,
    keywords: [
      "right to object",
      "object to processing",
      "objection",
      "direct marketing",
      "profiling",
      "art. 21",
    ],
    description:
      "Data subjects have the right to object to processing based on legitimate interests or for direct marketing",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 32",
    clause_text: "Security of processing",
    required: true,
    keywords: [
      "security",
      "data security",
      "technical measures",
      "organizational measures",
      "encryption",
      "pseudonymization",
      "confidentiality",
      "integrity",
      "availability",
      "art. 32",
    ],
    description:
      "Controllers and processors must implement appropriate technical and organizational measures to ensure security of processing",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 5",
    clause_text: "Principles relating to processing of personal data",
    required: true,
    keywords: [
      "data minimization",
      "purpose limitation",
      "storage limitation",
      "accuracy",
      "integrity",
      "confidentiality",
      "accountability",
      "lawfulness",
      "fairness",
      "transparency",
      "art. 5",
    ],
    description:
      "Core principles: lawfulness, fairness, transparency, purpose limitation, data minimization, accuracy, storage limitation, integrity, and confidentiality",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 25",
    clause_text: "Data protection by design and by default",
    required: true,
    keywords: [
      "data protection by design",
      "privacy by design",
      "data protection by default",
      "privacy by default",
      "technical measures",
      "organizational measures",
      "default settings",
      "art. 25",
    ],
    description:
      "Controllers must implement appropriate technical and organizational measures to implement data protection principles and integrate safeguards into processing",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 30",
    clause_text: "Records of processing activities",
    required: true,
    keywords: [
      "records of processing",
      "processing records",
      "processing activities",
      "record keeping",
      "documentation",
      "processing register",
      "art. 30",
    ],
    description:
      "Controllers and processors must maintain records of processing activities under their responsibility",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 33",
    clause_text: "Notification of a personal data breach to the supervisory authority",
    required: true,
    keywords: [
      "data breach notification",
      "breach notification",
      "personal data breach",
      "supervisory authority",
      "72 hours",
      "breach report",
      "art. 33",
    ],
    description:
      "Controllers must notify the supervisory authority of a personal data breach within 72 hours of becoming aware of it",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 34",
    clause_text: "Communication of a personal data breach to the data subject",
    required: true,
    keywords: [
      "breach communication",
      "notify data subject",
      "inform data subject",
      "breach notification to individual",
      "high risk",
      "art. 34",
    ],
    description:
      "When a breach is likely to result in a high risk to rights and freedoms, controllers must communicate the breach to data subjects without undue delay",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 35",
    clause_text: "Data protection impact assessment",
    required: false,
    keywords: [
      "data protection impact assessment",
      "dpia",
      "privacy impact assessment",
      "pia",
      "impact assessment",
      "high risk processing",
      "art. 35",
    ],
    description:
      "Controllers must carry out a DPIA where processing is likely to result in a high risk to rights and freedoms",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 37",
    clause_text: "Designation of the data protection officer",
    required: false,
    keywords: [
      "data protection officer",
      "dpo",
      "privacy officer",
      "designate dpo",
      "appoint dpo",
      "art. 37",
    ],
    description:
      "Controllers and processors must designate a DPO in certain circumstances (public authority, large-scale processing, special categories)",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 38",
    clause_text: "Position of the data protection officer",
    required: false,
    keywords: [
      "dpo position",
      "dpo role",
      "dpo responsibilities",
      "dpo independence",
      "dpo resources",
      "art. 38",
    ],
    description:
      "The DPO must be involved in all issues relating to data protection and must have adequate resources and independence",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 39",
    clause_text: "Tasks of the data protection officer",
    required: false,
    keywords: [
      "dpo tasks",
      "dpo duties",
      "dpo functions",
      "monitoring compliance",
      "training staff",
      "cooperation with authority",
      "art. 39",
    ],
    description:
      "DPO tasks include informing and advising, monitoring compliance, providing training, and cooperating with supervisory authorities",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 44",
    clause_text: "General principle for transfers",
    required: true,
    keywords: [
      "data transfer",
      "transfer of personal data",
      "cross-border transfer",
      "international transfer",
      "third country",
      "transfer safeguards",
      "art. 44",
    ],
    description:
      "Any transfer of personal data to a third country or international organization must comply with GDPR transfer requirements",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 45",
    clause_text: "Transfers on the basis of an adequacy decision",
    required: false,
    keywords: [
      "adequacy decision",
      "adequate level of protection",
      "adequacy",
      "art. 45",
    ],
    description:
      "Transfers to third countries with an adequacy decision from the Commission are permitted without additional safeguards",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 46",
    clause_text: "Transfers subject to appropriate safeguards",
    required: false,
    keywords: [
      "appropriate safeguards",
      "standard contractual clauses",
      "scc",
      "binding corporate rules",
      "bcr",
      "transfer safeguards",
      "art. 46",
    ],
    description:
      "In absence of adequacy decision, transfers must be subject to appropriate safeguards such as SCCs or BCRs",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 47",
    clause_text: "Binding corporate rules",
    required: false,
    keywords: [
      "binding corporate rules",
      "bcr",
      "group transfers",
      "corporate rules",
      "art. 47",
    ],
    description:
      "Binding corporate rules may be used as a transfer mechanism for transfers within a group of undertakings",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 48",
    clause_text: "Transfers or disclosures not authorized by Union law",
    required: true,
    keywords: [
      "unauthorized transfer",
      "court order",
      "third country court",
      "judicial request",
      "art. 48",
    ],
    description:
      "Any judgment or decision requiring transfer or disclosure not based on Union law is not recognized or enforceable",
  },
  {
    framework: "GDPR",
    article_ref: "Art. 49",
    clause_text: "Derogations for specific situations",
    required: false,
    keywords: [
      "derogations",
      "explicit consent",
      "contract performance",
      "important public interest",
      "legitimate interests",
      "art. 49",
    ],
    description:
      "In absence of adequacy decision or safeguards, transfers may be permitted under specific derogations",
  },
];

export const AI_ACT_RULES: ComplianceRule[] = [
  {
    framework: "AI_ACT",
    article_ref: "Art. 3",
    clause_text: "Scope and definitions",
    required: true,
    keywords: [
      "ai system",
      "artificial intelligence",
      "scope",
      "definition",
      "machine learning",
      "art. 3",
    ],
    description:
      "Defines the scope of the regulation and key terms including AI system, provider, user, and high-risk AI system",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 4",
    clause_text: "Prohibited AI practices",
    required: true,
    keywords: [
      "prohibited practices",
      "banned ai",
      "prohibited ai",
      "subliminal techniques",
      "exploitation of vulnerabilities",
      "social scoring",
      "real-time remote biometric identification",
      "art. 4",
    ],
    description:
      "Lists AI practices that are prohibited, including manipulative techniques, exploitation of vulnerabilities, and social scoring",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 6",
    clause_text: "Classification rules for high-risk AI systems",
    required: true,
    keywords: [
      "high-risk",
      "risk classification",
      "high-risk ai system",
      "classification",
      "art. 6",
    ],
    description:
      "Defines criteria for classifying AI systems as high-risk based on their intended purpose and potential impact",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 8",
    clause_text: "Compliance procedures for high-risk AI systems",
    required: false,
    keywords: [
      "compliance procedures",
      "conformity assessment",
      "conformity procedure",
      "ce marking",
      "art. 8",
    ],
    description:
      "High-risk AI systems must undergo conformity assessment procedures before being placed on the market",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 9",
    clause_text: "Risk management system",
    required: true,
    keywords: [
      "risk management",
      "risk assessment",
      "risk management system",
      "residual risk",
      "risk mitigation",
      "art. 9",
    ],
    description:
      "Providers must establish, document, and maintain a risk management system for high-risk AI systems",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 10",
    clause_text: "Data and data governance",
    required: true,
    keywords: [
      "data governance",
      "training data",
      "data quality",
      "training data governance",
      "data management",
      "data selection",
      "art. 10",
    ],
    description:
      "Providers must ensure training, validation, and testing data sets are relevant, representative, and of sufficient quality",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 11",
    clause_text: "Technical documentation",
    required: true,
    keywords: [
      "technical documentation",
      "documentation",
      "technical file",
      "system documentation",
      "art. 11",
    ],
    description:
      "Providers must draw up technical documentation demonstrating compliance with the AI Act requirements",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 12",
    clause_text: "Record keeping",
    required: true,
    keywords: [
      "record keeping",
      "logs",
      "audit trail",
      "automatically generated logs",
      "art. 12",
    ],
    description:
      "Providers must ensure high-risk AI systems are designed and developed with logging capabilities",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 13",
    clause_text: "Transparency obligations",
    required: true,
    keywords: [
      "transparency",
      "transparency obligations",
      "inform users",
      "ai-generated content",
      "deepfake",
      "emotion recognition",
      "biometric categorization",
      "art. 13",
    ],
    description:
      "Users must inform individuals when they are interacting with an AI system, with specific requirements for emotion recognition and biometric categorization",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 14",
    clause_text: "Human oversight",
    required: true,
    keywords: [
      "human oversight",
      "human in the loop",
      "human review",
      "human monitoring",
      "art. 14",
    ],
    description:
      "High-risk AI systems must be designed to allow for effective human oversight during the period in which the system is in use",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 15",
    clause_text: "Authorized representatives",
    required: false,
    keywords: [
      "authorized representative",
      "eu representative",
      "representative",
      "art. 15",
    ],
    description:
      "Providers not established in the EU must designate an authorized representative in the Union",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 16",
    clause_text: "Obligations of importers",
    required: false,
    keywords: [
      "importer obligations",
      "importer",
      "import high-risk ai",
      "art. 16",
    ],
    description:
      "Importers must verify that high-risk AI systems comply with requirements and bear the CE marking",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 17",
    clause_text: "Obligations of distributors",
    required: false,
    keywords: [
      "distributor obligations",
      "distributor",
      "distribute ai system",
      "art. 17",
    ],
    description:
      "Distributors must verify that AI systems bear the CE marking and are accompanied by required documentation",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 18",
    clause_text: "Obligations of users of high-risk AI systems",
    required: false,
    keywords: [
      "user obligations",
      "ai system user",
      "user of high-risk ai",
      "use ai system",
      "art. 18",
    ],
    description:
      "Users of high-risk AI systems must use the systems in accordance with instructions, monitor operation, and report incidents",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 19",
    clause_text: "Obligations of other parties",
    required: false,
    keywords: [
      "other parties",
      "third party",
      "supplier",
      "art. 19",
    ],
    description:
      "Other parties in the supply chain must comply with relevant obligations when placing AI systems on the market",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 20",
    clause_text: "Obligations of notified bodies",
    required: false,
    keywords: [
      "notified body",
      "notified bodies",
      "conformity assessment body",
      "art. 20",
    ],
    description:
      "Notified bodies must carry out conformity assessments in accordance with the procedures and requirements",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 26",
    clause_text: "Obligations of providers of high-risk AI systems",
    required: false,
    keywords: [
      "provider obligations",
      "provider of high-risk ai",
      "art. 26",
    ],
    description:
      "Providers must ensure high-risk AI systems comply with requirements, establish quality management system, and maintain documentation",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 50",
    clause_text: "Codes of conduct",
    required: false,
    keywords: [
      "codes of conduct",
      "code of conduct",
      "voluntary code",
      "art. 50",
    ],
    description:
      "Providers of non-high-risk AI systems may voluntarily draw up codes of conduct to promote best practices",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 68",
    clause_text: "Penalties",
    required: true,
    keywords: [
      "penalties",
      "administrative fines",
      "non-compliance",
      "violation",
      "fine",
      "art. 68",
    ],
    description:
      "Member States must lay down rules on penalties for infringements, with fines up to specified amounts",
  },
  {
    framework: "AI_ACT",
    article_ref: "Art. 73",
    clause_text: "Reporting of serious incidents",
    required: true,
    keywords: [
      "incident reporting",
      "serious incident",
      "report incident",
      "incident notification",
      "art. 73",
    ],
    description:
      "Providers must report any serious incident to the market surveillance authority immediately and in any event no later than 15 days",
  },
];

export const ISO_42001_RULES: ComplianceRule[] = [
  {
    framework: "ISO_42001",
    article_ref: "§4.1",
    clause_text: "Understanding the organization and its context",
    required: true,
    keywords: [
      "understanding organization",
      "organizational context",
      "internal context",
      "external context",
      "iso 42001",
      "4.1",
    ],
    description:
      "The organization must determine external and internal issues relevant to its purpose and affecting its ability to achieve intended results",
  },
  {
    framework: "ISO_42001",
    article_ref: "§4.2",
    clause_text: "Understanding the needs and expectations of interested parties",
    required: true,
    keywords: [
      "interested parties",
      "stakeholders",
      "stakeholder needs",
      "stakeholder expectations",
      "iso 42001",
      "4.2",
    ],
    description:
      "The organization must determine interested parties relevant to the AI management system and their requirements",
  },
  {
    framework: "ISO_42001",
    article_ref: "§4.3",
    clause_text: "Determining the scope of the AI management system",
    required: true,
    keywords: [
      "scope",
      "scope of ai management system",
      "determining scope",
      "system scope",
      "iso 42001",
      "4.3",
    ],
    description:
      "The organization must determine the boundaries and applicability of the AI management system",
  },
  {
    framework: "ISO_42001",
    article_ref: "§4.4",
    clause_text: "AI management system",
    required: true,
    keywords: [
      "ai management system",
      "management system",
      "establish ai management system",
      "maintain ai management system",
      "iso 42001",
      "4.4",
    ],
    description:
      "The organization must establish, implement, maintain, and continually improve an AI management system",
  },
  {
    framework: "ISO_42001",
    article_ref: "§5.3",
    clause_text: "Roles, responsibilities and authorities",
    required: true,
    keywords: [
      "roles",
      "responsibilities",
      "authorities",
      "organizational roles",
      "accountability",
      "iso 42001",
      "5.3",
    ],
    description:
      "Top management must ensure that responsibilities and authorities for relevant roles are assigned and communicated",
  },
  {
    framework: "ISO_42001",
    article_ref: "§6.1",
    clause_text: "Actions to address risks and opportunities",
    required: true,
    keywords: [
      "risks and opportunities",
      "address risks",
      "address opportunities",
      "risk management",
      "opportunity management",
      "iso 42001",
      "6.1",
    ],
    description:
      "The organization must determine risks and opportunities that need to be addressed to ensure the AI management system can achieve its intended results",
  },
  {
    framework: "ISO_42001",
    article_ref: "§6.2",
    clause_text: "AI system life cycle",
    required: true,
    keywords: [
      "life cycle",
      "lifecycle",
      "ai system",
      "system life cycle",
      "life cycle stages",
      "iso 42001",
      "6.2",
    ],
    description:
      "The organization must plan, implement, and control the processes needed to meet AI management system requirements throughout the AI system life cycle",
  },
  {
    framework: "ISO_42001",
    article_ref: "§7.2",
    clause_text: "Competence",
    required: true,
    keywords: [
      "competence",
      "training",
      "skills",
      "competent personnel",
      "education",
      "experience",
      "iso 42001",
      "7.2",
    ],
    description:
      "The organization must determine necessary competence of persons doing work under its control and ensure they are competent",
  },
  {
    framework: "ISO_42001",
    article_ref: "§7.3",
    clause_text: "Awareness",
    required: true,
    keywords: [
      "awareness",
      "understanding",
      "personnel awareness",
      "staff awareness",
      "iso 42001",
      "7.3",
    ],
    description:
      "Persons doing work under the organization's control must be aware of the AI policy, their contribution, and implications of nonconformity",
  },
  {
    framework: "ISO_42001",
    article_ref: "§7.4",
    clause_text: "Communication",
    required: true,
    keywords: [
      "communication",
      "internal communication",
      "external communication",
      "communicate",
      "information exchange",
      "iso 42001",
      "7.4",
    ],
    description:
      "The organization must determine the need for internal and external communications relevant to the AI management system",
  },
  {
    framework: "ISO_42001",
    article_ref: "§7.5",
    clause_text: "Documented information",
    required: true,
    keywords: [
      "documented information",
      "documentation",
      "documents",
      "records",
      "control of documents",
      "iso 42001",
      "7.5",
    ],
    description:
      "The organization must maintain documented information to the extent necessary to support the operation of processes and retain it as evidence",
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.1",
    clause_text: "Operational planning and control",
    required: true,
    keywords: [
      "operational planning",
      "control",
      "operational control",
      "planning",
      "operational processes",
      "iso 42001",
      "8.1",
    ],
    description:
      "The organization must plan, implement, and control processes needed to meet requirements and implement actions to address risks and opportunities",
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.2",
    clause_text: "Privacy",
    required: true,
    keywords: [
      "privacy",
      "data protection",
      "privacy protection",
      "personal data",
      "privacy by design",
      "iso 42001",
      "8.2",
    ],
    description:
      "The organization must plan and implement processes to address privacy and data protection throughout the AI system life cycle",
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.3",
    clause_text: "AI system development",
    required: true,
    keywords: [
      "development",
      "ai system development",
      "system development",
      "development process",
      "iso 42001",
      "8.3",
    ],
    description:
      "The organization must plan, implement, and control processes for AI system development including design, training, and validation",
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.4",
    clause_text: "Documentation",
    required: true,
    keywords: [
      "documentation",
      "documented information",
      "system documentation",
      "technical documentation",
      "iso 42001",
      "8.4",
    ],
    description:
      "The organization must maintain documented information on AI systems including design, training data, and performance characteristics",
  },
  {
    framework: "ISO_42001",
    article_ref: "§8.5",
    clause_text: "Incident management",
    required: true,
    keywords: [
      "incident management",
      "incident response",
      "incident handling",
      "incident reporting",
      "iso 42001",
      "8.5",
    ],
    description:
      "The organization must establish, implement, and maintain processes for incident identification, response, and management",
  },
  {
    framework: "ISO_42001",
    article_ref: "§9.2",
    clause_text: "Internal audit",
    required: true,
    keywords: [
      "internal audit",
      "audit",
      "audit program",
      "audit process",
      "iso 42001",
      "9.2",
    ],
    description:
      "The organization must conduct internal audits at planned intervals to provide information on whether the AI management system conforms to requirements",
  },
  {
    framework: "ISO_42001",
    article_ref: "§9.3",
    clause_text: "Management review",
    required: true,
    keywords: [
      "management review",
      "review",
      "top management review",
      "management review meeting",
      "iso 42001",
      "9.3",
    ],
    description:
      "Top management must review the AI management system at planned intervals to ensure its continuing suitability, adequacy, and effectiveness",
  },
  {
    framework: "ISO_42001",
    article_ref: "§9",
    clause_text: "Performance evaluation",
    required: true,
    keywords: [
      "performance evaluation",
      "monitoring",
      "measurement",
      "evaluation",
      "performance monitoring",
      "iso 42001",
      "9",
    ],
    description:
      "The organization must determine what needs to be monitored and measured, and the methods for evaluation to ensure valid results",
  },
  {
    framework: "ISO_42001",
    article_ref: "§10",
    clause_text: "Improvement",
    required: true,
    keywords: [
      "improvement",
      "continuous improvement",
      "corrective action",
      "preventive action",
      "nonconformity",
      "iso 42001",
      "10",
    ],
    description:
      "The organization must determine opportunities for improvement and implement necessary actions to achieve intended results",
  },
];

export const ALL_RULES: ComplianceRule[] = [
  ...GDPR_RULES,
  ...AI_ACT_RULES,
  ...ISO_42001_RULES,
];

