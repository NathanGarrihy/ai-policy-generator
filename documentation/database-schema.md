# Database Schema Changes

## New Tables

### policy_mappings
Stores framework mappings for policy sections.

```sql
CREATE TABLE policy_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id UUID NOT NULL REFERENCES user_policies(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  framework TEXT NOT NULL CHECK (framework IN ('GDPR', 'AI_ACT', 'ISO_42001')),
  article_ref TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_mappings_version ON policy_mappings(policy_version_id);
CREATE INDEX idx_policy_mappings_framework ON policy_mappings(framework);
```

### policy_reviews
Stores human review records for policy versions.

```sql
CREATE TABLE policy_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id UUID NOT NULL REFERENCES user_policies(id) ON DELETE CASCADE,
  reviewer TEXT NOT NULL,
  accuracy_score DECIMAL(3,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_reviews_version ON policy_reviews(policy_version_id);
```

## Updated Tables

### user_policies
Add versioning and framework coverage fields.

```sql
ALTER TABLE user_policies
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES user_policies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS framework_coverage JSONB;

CREATE INDEX idx_user_policies_version ON user_policies(parent_version_id);
CREATE INDEX idx_user_policies_user_type ON user_policies(user_id, policy_type);
```

### user_questionnaires
Update to support new policy types (already supports via JSONB answers column, but may want to add constraint).

```sql
-- If needed, add constraint for policy_type
ALTER TABLE user_questionnaires
ADD CONSTRAINT check_policy_type 
CHECK (policy_type IN ('privacy_policy', 'ai_usage_policy', 'ai_governance_policy'));
```

