# 🧪 PolicyPilot MVP — Testing Strategy Overview

## 🎯 Testing Goals

**Reliability:** Each generation flow (form → policy → export) works end-to-end without human intervention.  
**Accuracy:** Policy outputs include correct clause mappings and no hallucinated references.  
**Consistency:** The same input data always produces structurally valid, repeatable output.  
**Evidence:** You can demonstrate to a fund reviewer or pilot user that outputs are tested, logged, and traceable.

---

## 🧩 Testing Layers

| Layer                                | Purpose                                                      | Tools / Method                                  | Key Focus Areas                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Unit Tests**                    | Verify core logic and transformations.                       | Jest / Vitest                                   | - PolicyCop scoring function.<br>- JSON-to-prompt builder.<br>- Diff & versioning functions.<br>- Export format generator (docx/pdf).                 |
| **2. Integration Tests**             | Validate component interactions (API + DB + frontend forms). | Playwright (headed) or Cypress (component mode) | - Questionnaire submission saves correct JSON.<br>- Policy generation API stores & retrieves version.<br>- PolicyCop score saved to DB and displayed. |
| **3. Mocked LLM Tests**              | Ensure deterministic tests without real OpenAI calls.        | Local `__mocks__/openaiResponse.json`           | - Feed canned GPT responses through backend.<br>- Verify output parser & mapping table logic.<br>- Confirm fail-safe behaviour on malformed output.   |
| **4. End-to-End (E2E)**              | Validate full user journey in one run.                       | Playwright E2E                                  | - Form input → API call → result render → export.<br>- Measure time-to-first-policy (TTFG).                                                           |
| **5. Visual / UI Snapshot**          | Catch formatting drift or regression in exports.             | Storybook + Chromatic / Jest snapshots          | - PDF/HTML layout.<br>- Headings, font hierarchy, logo consistency.                                                                                   |
| **6. Manual QA (Human Review Loop)** | Validate credibility & clause accuracy.                      | Internal review checklist (Notion / Sheet)      | - Random sample (5–10%) of policies monthly.<br>- Score mapping accuracy, tone, completeness.<br>- Feed corrections into prompts.                     |

---

## 🧱 Priority Test Targets (High ROI for MVP)

### 1. Prompt Pipeline & Output Parsing

- Ensure every required section (Intro, Data Rights, Risk Controls, etc.) appears.
- Mapping table must contain valid framework references (AI Act Art. x, ISO 42001 § y).
- Output must serialize to JSON or markdown correctly before export.  
  _(→ critical for credibility & compliance proof)_

### 2. PolicyCop Scoring Logic

- Verify that clause-coverage scores update correctly when sections change.
- Test edge cases: missing sections, null framework IDs, bad input.
- Unit test rule weights (e.g. GDPR section = 0.2 of score).  
  _(→ critical for trust and measurable success metric)_

### 3. Export Integrity

- Test PDF/DOCX generation with dummy content — ensure layout, headings, and mapping appendix render correctly.
- Compare hash or checksum of exported file to ensure repeatability.
- Fail gracefully on malformed markup.  
  _(→ critical for buyer-ready deliverable reliability)_

### 4. Versioning & Diff Engine

- Validate previous version retention in Supabase.
- Verify diff-match-patch shows changes correctly and updates PolicyCop delta.  
  _(→ important for Evidence Pack transparency)_

### 5. Performance & UX Flow

- Record average generation time (TTFG).
- Detect and log any API call over 25 s.
- Ensure progress animation never freezes or misleads users.  
  _(→ critical for user trust and your success KPI)_

---

## 🧾 Test Data & Mocking

- Store 3–4 canonical test cases (`/testdata/ai_saas.json`, `/testdata/fintech.json`, `/testdata/agency.json`).
- Mock OpenAI API in dev tests with deterministic responses.
- Tag each mock with expected coverage score and output length.
- Use these mocks for regression checks when prompt templates change.

---

## 📊 Reporting & Visibility

- Integrate GitHub Actions to run unit + integration tests on push.
- Auto-generate a small test summary in each PR (pass/fail %, average TTFG).
- Maintain a QA Dashboard (Notion table) tracking:
  - Build number
  - Test coverage %
  - Accuracy % from manual reviews
  - Known issues / prompt updates

_This satisfies the “quality control and traceability” criterion grant assessors often ask about._

---

## 🔒 Post-MVP Enhancement Plan

After launch or grant milestone 1:

- Add automated regression suite triggered weekly.
- Introduce fuzz testing on prompt inputs (e.g., missing fields).
- Start gathering telemetry for anonymized coverage stats (real user data).

---

## ✅ Summary

**Testing focus hierarchy:**

1. Prompt → Output correctness
2. PolicyCop logic accuracy
3. Export & version reliability
4. E2E stability (form → export)
5. Manual credibility review

Lean, testable, and provable. Enough to show reviewers that PolicyPilot isn’t just functioning — it’s verified and trustworthy.

**End of “Test Strategy” section — PolicyPilot, October 2025**
