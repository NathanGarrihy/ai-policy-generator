# Compliance Applicability System

## Overview

PolicyCop's compliance evaluation is now questionnaire-driven, meaning each company's policy is evaluated against only the rules that apply to their specific situation based on their questionnaire answers.

## Applicability Context

The `RuleApplicability` type defines boolean flags that determine which compliance rules apply:

- `usesAIForPersonalData`: AI systems process personal data
- `deploysHighRiskAI`: Company deploys high-risk AI systems
- `offersAIAsProductInEU`: Company offers AI as a product/service in the EU
- `usesAutomatedDecisionMaking`: AI systems make automated decisions
- `processesSpecialCategoryData`: Company processes special category data (e.g., payment info, health data)
- `hasInternationalTransfers`: Company transfers data internationally
- `usesThirdPartyProcessors`: Company uses third-party processors
- `hasHighRiskProcessing`: Company engages in high-risk data processing activities

## How Applicability is Derived

### Privacy Policy
- `hasInternationalTransfers`: Derived when `third_parties === "Yes"` **and** jurisdictions include non‑EU/UK frameworks (e.g. CCPA, PIPEDA)
- `usesThirdPartyProcessors`: Derived from `third_parties === "Yes"`
- `processesSpecialCategoryData`: Not inferred from generic categories (e.g. payment info); remains `false` until explicit special‑category fields are added
- `hasHighRiskProcessing`: Derived from truly indefinite retention (`data_retention === "Indefinitely"`)

### AI Usage Policy
- `usesAIForPersonalData`: Derived from `data_sent_to_models` containing PII/personal data keywords
- `deploysHighRiskAI`: Derived from `ai_risk_rating === "high"`
- `usesAutomatedDecisionMaking`: Derived from `human_oversight_level === "low"` or `ai_risk_rating === "high"`

### AI Governance Policy
- `deploysHighRiskAI`: **Not** inferred from the existence of a governance policy alone; remains `false` until explicit high‑risk system information is captured
- `offersAIAsProductInEU`: Derived from `ai_governance_owner_role` containing "product" or "CTO"

## Rule Categories

### Hard Mandatory Rules
Rules with `hard_mandatory: true` must be present if applicable. Missing hard mandatory rules cause validation to fail regardless of coverage percentage.

Examples:
- GDPR Art. 6 (Lawful basis for processing)
- GDPR Art. 13 (Information to be provided)
- GDPR Art. 15-17 (Data subject rights)
- AI Act Art. 6 (High-risk classification) - if `deploysHighRiskAI === true`
- AI Act Art. 9 (Risk management) - if `deploysHighRiskAI === true`
- AI Act Art. 10 (Data governance) - if `usesAIForPersonalData === true` or `deploysHighRiskAI === true`
- AI Act Art. 11 (Technical documentation) - if `deploysHighRiskAI === true`

### Soft Required Rules
Rules with `required: true` but `hard_mandatory !== true` are strongly recommended. Missing soft required rules reduce coverage percentage but don't cause validation failure if coverage thresholds are met.

### Optional Rules
Rules with `required: false` are optional. They contribute to coverage percentage but missing them doesn't cause validation issues.

## Dynamic Thresholds

Coverage thresholds are calculated dynamically based on applicable rules:

- **AI Act threshold = 0** if no AI Act rules are applicable
- **AI Act threshold = 0.7** (or base threshold) if AI Act rules are applicable
- **Privacy policies with AI Act rules**: AI Act threshold = 0.4 (lower threshold)

GDPR and ISO 42001 thresholds remain static as these frameworks are always applicable.

## Validation Logic

Policy validation fails (`isValid = false`) if:
1. Any applicable hard mandatory rules are missing
2. Quality score < 0.6
3. Coverage below thresholds (with 10% margin)
4. Critical structural issues (missing POLICY-MARKDOWN block, invalid METAJSON)

Policy validation passes if:
- All applicable hard mandatory rules are present
- Quality score >= 0.6
- Coverage meets thresholds (with margin)
- No critical structural issues

## Backward Compatibility

- All new parameters are optional
- Existing code without applicability context continues to work
- Static thresholds remain as fallback when context not provided
- Existing `missing_clauses` array preserved for UI compatibility

