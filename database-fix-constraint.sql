-- Fix user_questionnaires policy_type constraint to include ai_governance_policy
-- Run this in your Supabase SQL editor

-- First, drop the existing constraint (if it exists)
ALTER TABLE user_questionnaires 
DROP CONSTRAINT IF EXISTS user_questionnaires_policy_type_check;

ALTER TABLE user_questionnaires 
DROP CONSTRAINT IF EXISTS check_policy_type;

-- Add the updated constraint with all three policy types
ALTER TABLE user_questionnaires
ADD CONSTRAINT user_questionnaires_policy_type_check 
CHECK (policy_type IN ('privacy_policy', 'ai_usage_policy', 'ai_governance_policy'));

