# 🧭 North Star

“Generate, monitor, and prove EU-grade privacy & AI governance — turning AI Act + ISO 42001 duties into live policies, evidence, and buyer-ready compliance reports for startups.”

---

## 🌍 Target Niche

| Attribute               | Description                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **Who**                 | EU/UK B2B SaaS startups and tech SMEs (2–50 FTE) using or shipping AI features.                         |
| **Why they care**       | They must show compliance with GDPR, AI Act, and ISO 42001 to close enterprise deals or secure funding. |
| **Pain**                | No compliance headcount, blocked by buyer questionnaires, can’t afford lawyers or enterprise GRC tools. |
| **Current substitutes** | Free templates (generic, outdated), or expensive consultants (slow).                                    |
| **Budget**              | €49–€199/month for credible, auto-maintained governance documentation.                                  |
| **Trigger events**      | Enterprise deal, investor due diligence, AI feature launch, ISO audit.                                  |

---

## ⚖️ Positioning Statement

“Continuously updated, AI-Act & ISO-42001-mapped policies with buyer-ready evidence—built for EU/UK startups using or shipping AI.”

---

## 💡 Job-To-Be-Done

“Get customers buyer-ready in days (policies + proofs) so they can pass procurement now, and stay compliant automatically as laws evolve.”

---

## 🧠 Core Features (v1)

**Smart Policy Generator**

- Collects answers (company size, AI usage, frameworks).
- Generates GDPR, AI Act, and ISO 42001–aligned policies.
- Produces policy text plus mapping table (e.g. “Clause 5.3 → AI Act Art. 9”).
- Professional tone, procurement-ready formatting.

**PolicyCop Lite (Built-In Compliance Scorer)**

- Section-by-section “compliance coverage” bar (e.g. GDPR 80%, AI Act 70%).
- Flags missing clauses (“No risk classification procedure found”).
- Works via static rule list (no external monitoring yet).

**Evidence Pack Export (MVP differentiator)**

- 1-click download:
  - Policy (PDF/DOCX)
  - Mapping Table
  - “Change Log” (timestamped versions)
- Gives startups instant proof for buyers or investors.

**Version History**

- Every change is saved as a version.
- Basic diff view with date and framework coverage change.

---

## 🚫 Out of Scope for MVP

- Continuous scraping/auto-updates (stub only).
- Cookie Policy, BYOD, DEI, ESG docs.
- Agency dashboards / integrations / multi-language.

---

## 📄 MVP Policy Types

| Policy                        | Description                                           | Frameworks Mapped       |
| ----------------------------- | ----------------------------------------------------- | ----------------------- |
| Privacy Policy                | Covers GDPR & UK GDPR, maps clauses to Articles 6–15. | GDPR, ISO 42001 §8.2    |
| AI Usage Policy               | Defines internal AI use boundaries and oversight.     | AI Act, ISO 42001 §§6–8 |
| AI Governance & Ethics Policy | Demonstrates responsible AI management for buyers.    | AI Act, ISO 42001 full  |

---

## 🧩 Questionnaires (v1)

### Privacy Policy (7 Qs)

1. Company name
2. Jurisdictions (GDPR / UK GDPR)
3. Data collected (email, IP, device, etc.)
4. Purpose of processing
5. Third-party sharing
6. Retention period
7. DPO / privacy contact

### AI Usage Policy (7 Qs)

1. AI used where (support / content / analytics / coding)
2. AI model provider (OpenAI, Anthropic, open-source)
3. Data sent to models
4. Human oversight level
5. AI risk rating (low/medium/high)
6. AI retraining frequency
7. Responsible person

### AI Governance & Ethics Policy (6 Qs)

1. Company name
2. AI governance owner role
3. Documentation frequency (quarterly / annually)
4. Responsible AI principles followed (Transparency, Fairness, Accountability)
5. Training provided to employees?
6. Incident reporting procedure?

---

## 🧾 Prompt Design

**System Prompt:**
“You are a compliance officer writing AI Act + ISO 42001–aligned documentation for an EU B2B SaaS. Generate clear, defensible policies referencing relevant articles. Include mapping notes like ‘(AI Act Art. 9 – Risk Management)’ inline where applicable.”

**Output Structure:**

- Heading structure (H1–H3)
- Plain-language clause + citation
- Optional compliance note (hidden metadata)
- “Last updated” footer

---

## 🧱 Acceptance Criteria

| Module         | Acceptance Criteria                                                                          |
| -------------- | -------------------------------------------------------------------------------------------- |
| Generator      | Generates 3 policies ≤ 25s; includes mapping notes; passes internal PolicyCop coverage ≥70%. |
| PolicyCop Lite | Detects ≥10 key AI Act/ISO clauses; provides section-level score.                            |
| Export         | PDF/DOCX identical structure; includes mapping appendix; ≥98% export success.                |
| Versioning     | Diff engine shows changes + coverage delta.                                                  |
| UI             | “Buyer-ready” look — professional formatting, not GPT text wall.                             |

---

## 🗄️ Data Model Adjustments

Add new tables:

- `policy_mappings(policy_version_id, section_id, framework, article_ref, confidence, created_at)`  
  Used for both display (PolicyCop) and future updates.
- `policy_reviews(id, policy_version_id, reviewer, accuracy_score, notes, created_at)`  
  Used for human-in-the-loop review pipeline.

---

## 💰 Pricing (Aligned with Niche Budget)

| Tier       | Description                                                               | Price (€)    |
| ---------- | ------------------------------------------------------------------------- | ------------ |
| Free       | 1 limited policy preview, PolicyCop Lite score shown, 0 evidence exports. | 0            |
| Launch/Pro | All 3 policies + PolicyCop score + Evidence Pack.                         | €49 / month  |
| Business   | Adds AI Act + ISO mapping citations + auto-updates (later).               | €199 / month |
| Lifetime   | Locked lifetime plan, all updates. (limited for early users)              | €299 once    |

**Guardrails (code-enforced):**

- Generations: 20 / month (Launch)
- Regenerations: 5 / doc / day
- Export cap: 5 / month
- Doc size: 25 pages per policy
- Overages: prompt upgrade suggestion, no add-on sales yet.

---

## 📈 Success Metrics

| Metric                         | Target  |
| ------------------------------ | ------- |
| TTFG (time to first generated) | < 7 min |
| PolicyCop coverage             | ≥ 70%   |
| Export success                 | ≥ 98%   |
| Conversion (Free → Paid)       | ≥ 25%   |
| User NPS                       | +30     |

---

## 🧭 Outcome

By focusing on AI Act + ISO 42001 mapping and buyer-ready evidence, this MVP becomes:

- Painkiller, not “nice-to-have.”
- A credible bridge between templates and enterprise GRC platforms.
- A foundation for auto-updating, explainable compliance.

---

## ✅ Final Summary (for presentation)

“PolicyPilot helps EU/UK AI-using startups close enterprise deals faster.  
It generates, scores, and packages GDPR + AI Act + ISO 42001–mapped policies, rapidly producing buyer-ready evidence packs.”

---

## 📍 Codebase

https://github.com/NathanGarrihy/ai-policy-generator

---

## Appendix

### Advisory & Governance Note

To strengthen credibility and ensure regulatory accuracy, we will implement an internal human-in-the-loop review process instead of relying on external advisors.

This process includes:

- Scheduled internal reviews of AI-generated outputs (monthly during MVP; quarterly post-launch).
- Two-person validation workflow where one founder reviews all generated policies for accuracy, clause mapping, and tone.
- Documentation of review results in shared Notion/Sheet log.
- Continuous improvement tracking.

Ensures:

- Each output traceable and verified by a human.
- Reviewers see quality-assurance mechanism.
- Users trust credibility of documentation.

---

## Internal between Nathan and Timmy

Now that the MVP definition is complete, focus shifts to preparing the business-side foundation supporting implementation and funding.

---

### Current Standing

| Evaluation Area                   | Status | Notes                                              |
| --------------------------------- | ------ | -------------------------------------------------- |
| Monetization model                | ✅     | Pricing tiers defined (€49–€199/mo).               |
| Regulatory tailwind               | ✅     | EU AI Act + ISO 42001 create strong market timing. |
| Execution feasibility             | ✅     | Realistic stack and internal capability confirmed. |
| Early customer validation pathway | ⚠️     | Planned post-prototype.                            |

---

### Why This Matters

Investors and grant assessors want:

- Feasibility — we can build it.
- Market validation — real users confirm the need.
- Scalability — room to grow.

We satisfy (1) and (3); next: define traction capture once MVP is testable.

---

### Planned Business-Side Actions (Post-MVP)

**Design Early-Customer Validation Pathway**

- Outline pilot program.
- Identify 5–10 candidate startups.
- Prepare outreach templates.

**Prepare Pilot-Metrics Framework**

- Track onboarded pilots, TTFG, satisfaction, willingness to pay.

**Establish Internal Human Review Process**

- Monthly founder reviews of AI outputs for tone and accuracy.
- Log results for transparency.

**Plan Validation Summary Report**

- 1-page summary post-pilot with metrics and quotes.

---

### Outcome

Once live:

- Onboard early users for feedback.
- Collect measurable traction data.
- Submit strong, evidence-backed grant applications.

**End of “MVP” section — PolicyPilot, October 2025**
