# 🧩 Questionnaire & Prompt Design (v1.1)

## Purpose

This section defines the structured input and output flow behind PolicyPilot’s AI-driven policy generation.  
It ensures every policy is:

- **Legally grounded** — mapped to GDPR, AI Act, and ISO 42001 clauses.
- **Reproducible** — identical inputs yield identical structure and coverage.
- **Auditable** — each clause is traceable through inline citations and a Mapping Appendix.

---

## 1. Design Principles

### Short, structured inputs

Avoid open-ended fields; use dropdowns and toggles to maintain clean, consistent data collection.

### Compliance-first data model

Each question corresponds to specific legal frameworks, enabling automatic clause-level mapping.

### Human-review traceability

Generated policies always include inline citations and a Mapping Appendix, so users and founders can validate outputs.

### Placeholder transparency

If information is missing, insert visible placeholders — for example:  
`[Action Required: Provide DPO Email]`  
This keeps the output legally defensible and review-friendly.

---

## 2. Questionnaire Overview

PolicyPilot’s MVP supports three policy types, each collecting structured inputs through a guided, multi-step form.

| Policy Type                       | Purpose                                                          | Frameworks                    |
| --------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| **Privacy Policy**                | Defines how data is collected, processed, and stored.            | GDPR / UK GDPR / ISO 42001 §8 |
| **AI Usage Policy**               | Documents where and how AI models are used and controlled.       | AI Act / ISO 42001 §§6–8      |
| **AI Governance & Ethics Policy** | Outlines oversight, risk management, and responsible AI conduct. | AI Act / ISO 42001 full       |

Each answer feeds directly into structured metadata used by **PolicyCop** and **Evidence Pack**.

---

### A. Privacy Policy – Key Questions

- Company legal name — identifies the controller entity.
- Registered country (choose EU/UK list)
- Jurisdictions → GDPR (EU), UK GDPR, Both
- Data subjects → Customers / Visitors / Employees / Contractors
- Data categories → Identifiers / Analytics / Payment / Device
- Processing purposes → Service / Analytics / Marketing / Support
- Lawful bases → Contract / Consent / Legitimate Interest / Legal Obligation
- Processors / sub-processors → Name · Service · Region · DPA link
- Public vendor list link (optional)
- International transfers → SCC / UK IDTA / Adequacy / None
- Retention period → 30 d / 6 m / 1 y / Life of account + 90 d
- Rights request channel (email or URL)
- Response SLA → 30 / 60 days
- DPO contact email (placeholder if missing)

---

### B. AI Usage Policy – Key Questions

- Where AI is used → Support / Content / Coding / Analytics / Internal
- AI providers & models → Provider · Model · Region · Controls
- Data sent to models → PII / Anonymized / Telemetry only
- Prompt retention → None / 30 d / 6 m / 12 m
- Human oversight → Review All / High Risk Only / Spot Check
- AI use classification → Minimal / Limited / High-Risk Candidate
- Training / fine-tuning → Internal / Third-Party / None (+ PII included? Y/N)
- Transparency method → Banner / Inline Label / Docs Only / N/A (Internal)
- Incident handling → Contact email + Notify window (24 / 48 / 72 h)
- Responsible owner role → CTO / COO / Compliance Lead
- Owner contact email
- Audit frequency → Quarterly / Bi-annual / Annual

---

### C. AI Governance & Ethics Policy – Key Questions

- Governance owner — assign role (CTO, COO, Head of Eng, AI Lead).
- AI inventory status — confirm register exists (Y/N) and set review cadence.
- Inventory location (URL / Drive path)
- Policy review cadence → Quarterly / Bi-annual / Annual
- Risk management process → Identify · Assess · Mitigate · Monitor
- Testing frequency → Monthly / Quarterly / Release-based
- Data governance controls → Sensitive data flag (Y/N)
- Oversight model → Pre-release / Continuous / None
- Third-party model review → Bias / Security / Performance
- Employee training → Onboarding / Annual
- Ethics & escalation channel → Email or Whistleblowing URL

---

## 3. Prompt Design

### System Instruction

You are a compliance drafter generating EU-grade policies aligned with the GDPR, EU AI Act, and ISO/IEC 42001.  
Write in clear, professional English suitable for procurement review. Use short, factual sentences and a neutral legal tone.  
Each section should be 1–2 concise paragraphs followed by inline legal citations in this exact format:  
`(GDPR Art. 6), (AI Act Art. 9), (ISO 42001 §8.2)`

#### Rules:

- Follow the section order provided by the template. Include every section even if empty or placeholder-only.
- Do not output reasoning, notes, disclaimers, or commentary. Only produce the final policy content.
- Insert `[Action Required: ...]` placeholders where user data is missing — never infer or invent.
- Include a Mapping Appendix at the end listing each section and its referenced frameworks.
- Finish the policy with this exact footer line:  
  `Last updated: {{iso_date}}`

After the policy text, output a machine-readable JSON block called **METAJSON** following the schema below.  
Maintain deterministic structure; do not add or remove fields or headings.

---

### Output Format (two exact blocks)

-----BEGIN POLICY-MARKDOWN-----
... complete human-readable policy text ...
-----END POLICY-MARKDOWN-----
-----BEGIN POLICY-METAJSON-----
... structured JSON following schema ...
-----END POLICY-METAJSON-----

#### METAJSON Schema (example)

```json
{
  "policy_type": "privacy|ai_usage|ai_governance",
  "placeholders_present": true,
  "jurisdictions": ["GDPR_EU", "UK_GDPR"],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": [
    {
      "id": "sec_intro",
      "title": "Introduction & Scope",
      "framework_refs": ["GDPR Art. 13"]
    },
    {
      "id": "sec_lawful",
      "title": "Purposes & Lawful Bases",
      "framework_refs": ["GDPR Art. 6", "ISO 42001 §8.2"]
    }
  ]
}
```
