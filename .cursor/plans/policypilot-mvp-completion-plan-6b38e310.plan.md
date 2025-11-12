<!-- 6b38e310-b686-4e5b-8d64-d91cfd454297 c22a2272-54d4-4caf-a257-2c4a3a24bdb8 -->
# PolicyPilot MVP Completion Plan

## Current State Assessment

### What's Implemented

- All 3 questionnaires (Privacy, AI Usage, AI Governance) with multi-step forms
- Basic policy generation using OpenAI API
- PolicyCop scoring logic with GDPR, AI Act, ISO 42001 rules
- Version tracking in database with parent_version_id
- Export functionality (PDF/DOCX) with basic formatting
- Mappings extraction and database storage
- Version diff functionality
- Recommendations dashboard
- Version viewing page

### What Needs Implementation/Enhancement

1. **Prompt Format**: Current prompts don't follow `mvp_prompt_flow.md` specification (missing METAJSON block, structured delimiters)
2. **Structured Output Parsing**: Need to parse POLICY-MARKDOWN and METAJSON blocks
3. **Mapping Appendix**: Policies should include mapping appendix in generated content
4. **Placeholder Handling**: Implement `[Action Required: ...]` placeholders for missing data
5. **Testing**: No test suite exists - need comprehensive tests per `mvp_test_strategy.md`
6. **Database Schema**: Verify schema changes from `database-schema.md` are applied
7. **PolicyCop Enhancement**: Add section-level scoring and improve rule detection
8. **Export Enhancement**: Improve mapping table formatting in PDF/DOCX exports
9. **Performance**: Add TTFG monitoring to ensure < 25s target
10. **Error Handling**: Better validation and error messages

---

## Implementation Plan

### Phase 1: Prompt & Output Format Alignment (Critical)

**1.1 Update Prompt Templates** ([lib/prompts.ts](lib/prompts.ts))

- Refactor prompts to match `mvp_prompt_flow.md` specification
- Add structured output format instructions (POLICY-MARKDOWN and METAJSON blocks)
- Include mapping appendix requirements in prompts
- Add placeholder handling instructions (`[Action Required: ...]`)
- Ensure system prompt matches exact wording from specification

**1.2 Implement Output Parser** ([lib/policycop.ts](lib/policycop.ts) or new `lib/parser.ts`)

- Parse POLICY-MARKDOWN block (content between delimiters)
- Parse METAJSON block and validate schema
- Extract section-level framework references from METAJSON
- Handle malformed outputs gracefully with fallback to current extraction logic
- Store parsed metadata in database

**1.3 Update Policy Generation Flow** ([app/generate/[policyId]/page.tsx](app/generate/[policyId]/page.tsx))

- Integrate new parser after OpenAI response
- Use METAJSON for mappings instead of regex extraction (keep regex as fallback)
- Validate policy structure (all required sections present)
- Add mapping appendix to generated policy content before saving

### Phase 2: PolicyCop Enhancement

**2.1 Section-Level Scoring** ([lib/policycop.ts](lib/policycop.ts))

- Implement section-by-section compliance scoring
- Calculate coverage per section (not just overall)
- Display section-level scores in UI component
- Add section-level missing clause detection

**2.2 Enhanced Rule Detection** ([lib/compliance-rules.ts](lib/compliance-rules.ts))

- Expand rule keywords based on actual policy outputs
- Add context-aware rule matching (not just keyword presence)
- Improve article reference pattern matching
- Add validation for framework reference format

**2.3 PolicyCop UI Enhancement** ([components/PolicyCop.tsx](components/PolicyCop.tsx))

- Add section-level score display
- Show missing clauses with actionable recommendations
- Add visual indicators for coverage thresholds (70% target)
- Display framework coverage delta between versions

### Phase 3: Database Schema Verification & Enhancement

**3.1 Verify Schema** ([documentation/database-schema.md](documentation/database-schema.md))

- Check if `policy_mappings` table exists with correct structure
- Check if `policy_reviews` table exists
- Verify `user_policies` has version_number, parent_version_id, framework_coverage columns
- Verify indexes are created
- Create migration script if schema is missing

**3.2 Schema Migration** (new `migrations/` directory)

- Create SQL migration script for schema changes
- Add migration verification script
- Document schema state in README

### Phase 4: Export Enhancement

**4.1 Mapping Table Formatting** ([lib/export.ts](lib/export.ts))

- Improve mapping table layout in PDF/DOCX
- Add proper table formatting with headers
- Include section ID mapping to framework references
- Add version history table with coverage deltas
- Ensure professional "buyer-ready" formatting

**4.2 Export Content Structure**

- Include mapping appendix in exported documents
- Add version history section
- Include PolicyCop scores in export
- Add company branding placeholders
- Ensure consistent formatting across PDF and DOCX

### Phase 5: Testing Implementation

**5.1 Unit Tests** (new `__tests__/` directory)

- Test PolicyCop scoring logic ([lib/policycop.ts](lib/policycop.ts))
- Test prompt building ([lib/prompts.ts](lib/prompts.ts))
- Test output parser (new parser)
- Test mapping extraction
- Test diff functionality ([lib/diff.ts](lib/diff.ts))
- Test export generation ([lib/export.ts](lib/export.ts))

**5.2 Integration Tests**

- Test questionnaire submission flow
- Test policy generation API ([app/api/generate-policy/route.ts](app/api/generate-policy/route.ts))
- Test export API ([app/api/export-policy/route.ts](app/api/export-policy/route.ts))
- Test versioning API ([app/api/policy-versions/route.ts](app/api/policy-versions/route.ts))

**5.3 Mocked LLM Tests**

- Create mock OpenAI responses ([**mocks**/openaiResponse.json](**mocks**/openaiResponse.json))
- Test with deterministic mock responses
- Verify output parsing with various response formats
- Test error handling for malformed outputs

**5.4 E2E Tests** (Playwright)

- Test full user journey: questionnaire → generation → export
- Measure TTFG (time-to-first-generation)
- Test version comparison
- Test PolicyCop score display

**5.5 Test Data** (new `testdata/` directory)

- Create canonical test cases (ai_saas.json, fintech.json, agency.json)
- Mock OpenAI responses for each test case
- Expected coverage scores for each test case

### Phase 6: Performance & Monitoring

**6.1 TTFG Monitoring**

- Add timing instrumentation in policy generation
- Log generation time to database or analytics
- Alert if generation exceeds 25s threshold
- Add progress indicators in UI

**6.2 Performance Optimization**

- Optimize database queries (add missing indexes)
- Cache PolicyCop rule checks if needed
- Optimize export generation
- Add request timeout handling

### Phase 7: Error Handling & Validation

**7.1 Input Validation**

- Validate questionnaire answers before submission
- Validate policy type and user permissions
- Validate export requests
- Add comprehensive error messages

**7.2 Error Handling**

- Handle OpenAI API errors gracefully
- Handle database errors with user-friendly messages
- Handle malformed policy outputs
- Add retry logic for transient failures

**7.3 User Feedback**

- Improve error messages in UI
- Add loading states with progress indicators
- Add success notifications
- Add validation feedback in forms

### Phase 8: Questionnaire Alignment

**8.1 Verify Questionnaire Questions**

- Compare current questions with MVP specification
- Update AI Governance questionnaire if needed (currently 6 questions, should match spec)
- Ensure all required fields are collected
- Add validation for required fields

**8.2 Questionnaire UI Improvements**

- Add help text for complex questions
- Add progress indicators
- Improve mobile responsiveness
- Add draft saving indicators

### Phase 9: Documentation & Readme

**9.1 Update README** ([README.md](README.md))

- Add project overview and MVP goals
- Add setup instructions
- Add database schema setup instructions
- Add testing instructions
- Add deployment instructions

**9.2 Code Documentation**

- Add JSDoc comments to key functions
- Document API endpoints
- Document database schema
- Document prompt structure

### Phase 10: UI/UX Polish

**10.1 Professional Formatting**

- Ensure generated policies have "buyer-ready" look
- Improve markdown rendering in policy display
- Add proper typography and spacing
- Ensure consistent styling across pages

**10.2 User Experience**

- Improve navigation between pages
- Add breadcrumbs
- Add policy preview before generation
- Add regeneration confirmation
- Improve version comparison UI

---

## Priority Order

1. **Phase 1** (Prompt & Output Format) - Critical for MVP acceptance criteria
2. **Phase 5** (Testing) - Critical for credibility and grant applications
3. **Phase 2** (PolicyCop Enhancement) - Critical for MVP success metric (≥70% coverage)
4. **Phase 3** (Database Schema) - Required for data persistence
5. **Phase 4** (Export Enhancement) - Critical for "buyer-ready" deliverable
6. **Phase 6** (Performance) - Required for TTFG < 25s target
7. **Phase 7** (Error Handling) - Important for user experience
8. **Phase 8** (Questionnaire Alignment) - Important for data quality
9. **Phase 9** (Documentation) - Important for maintenance
10. **Phase 10** (UI/UX Polish) - Nice to have for launch

---

## Success Criteria

- Policy generation includes METAJSON block with structured mappings
- Policies include mapping appendix in generated content
- PolicyCop coverage ≥70% for all frameworks
- Export success rate ≥98%
- TTFG < 25s (measured and logged)
- Test coverage ≥80% for critical paths
- All database schema changes applied
- Export documents have professional "buyer-ready" formatting
- All MVP acceptance criteria met

---

## Estimated Effort

- Phase 1: 2-3 days
- Phase 2: 2-3 days
- Phase 3: 1 day
- Phase 4: 2 days
- Phase 5: 3-4 days
- Phase 6: 1-2 days
- Phase 7: 1-2 days
- Phase 8: 1 day
- Phase 9: 1 day
- Phase 10: 2-3 days

**Total: 16-22 days** (assuming full-time development)

---

## Next Immediate Steps

1. Verify database schema matches `database-schema.md`
2. Update prompt templates to match `mvp_prompt_flow.md` specification
3. Implement output parser for METAJSON block
4. Create basic test suite structure
5. Add TTFG monitoring to policy generation
6. Enhance PolicyCop section-level scoring
7. Improve export formatting with mapping tables

---

## Files to Modify/Create

### Modify Existing Files

- [lib/prompts.ts](lib/prompts.ts) - Update prompt templates
- [lib/policycop.ts](lib/policycop.ts) - Enhance scoring, add parser
- [lib/export.ts](lib/export.ts) - Improve export formatting
- [app/generate/[policyId]/page.tsx](app/generate/[policyId]/page.tsx) - Integrate parser
- [components/PolicyCop.tsx](components/PolicyCop.tsx) - Enhance UI
- [lib/compliance-rules.ts](lib/compliance-rules.ts) - Expand rules
- [README.md](README.md) - Add documentation

### Create New Files

- [lib/parser.ts](lib/parser.ts) - Output parser for METAJSON
- [**tests**/policycop.test.ts](**tests**/policycop.test.ts) - Unit tests
- [**tests**/parser.test.ts](**tests**/parser.test.ts) - Parser tests
- [**tests**/export.test.ts](**tests**/export.test.ts) - Export tests
- [**mocks**/openaiResponse.json](**mocks**/openaiResponse.json) - Mock responses
- [testdata/ai_saas.json](testdata/ai_saas.json) - Test data
- [migrations/001_schema.sql](migrations/001_schema.sql) - Schema migration
- [e2e/policy-generation.spec.ts](e2e/policy-generation.spec.ts) - E2E tests

### To-dos

- [x] Verify database schema matches documentation/database-schema.md - check if policy_mappings and policy_reviews tables exist, verify user_policies columns
- [ ] Update prompt templates in lib/prompts.ts to match mvp_prompt_flow.md specification - add structured output format (POLICY-MARKDOWN and METAJSON blocks), include mapping appendix requirements, add placeholder handling instructions
- [ ] Create lib/parser.ts to parse POLICY-MARKDOWN and METAJSON blocks from OpenAI responses - validate schema, extract section-level mappings, handle malformed outputs gracefully
- [ ] Integrate new parser in app/generate/[policyId]/page.tsx - use METAJSON for mappings, add mapping appendix to policy content, validate policy structure
- [ ] Enhance PolicyCop in lib/policycop.ts - add section-level scoring, improve rule detection, expand compliance rules, add context-aware matching
- [ ] Improve export formatting in lib/export.ts - add proper mapping table layout in PDF/DOCX, include version history with coverage deltas, ensure professional buyer-ready formatting
- [ ] Create unit tests for PolicyCop, parser, prompts, export, and diff functionality - aim for ≥80% coverage on critical paths
- [ ] Create integration tests for questionnaire submission, policy generation API, export API, and versioning API
- [ ] Create E2E tests with Playwright for full user journey - test questionnaire → generation → export, measure TTFG, test version comparison
- [ ] Add TTFG monitoring to policy generation - log generation time, alert if exceeds 25s, add progress indicators in UI
- [ ] Improve error handling and validation - validate questionnaire answers, handle OpenAI API errors gracefully, add user-friendly error messages
- [ ] Update README.md with setup instructions, database schema setup, testing instructions, and deployment instructions