-- db schema for cursor understanding.
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.policy_mappings (
id uuid NOT NULL DEFAULT gen_random_uuid(),
policy_version_id uuid NOT NULL,
section_id text NOT NULL,
framework text NOT NULL CHECK (framework = ANY (ARRAY['GDPR'::text, 'AI_ACT'::text, 'ISO_42001'::text])),
article_ref text NOT NULL,
confidence numeric DEFAULT 1.00 CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT policy_mappings_pkey PRIMARY KEY (id),
CONSTRAINT policy_mappings_policy_version_id_fkey FOREIGN KEY (policy_version_id) REFERENCES public.user_policies(id)
);
CREATE TABLE public.policy_reviews (
id uuid NOT NULL DEFAULT gen_random_uuid(),
policy_version_id uuid NOT NULL,
reviewer text NOT NULL,
accuracy_score numeric CHECK (accuracy_score >= 0::numeric AND accuracy_score <= 1::numeric),
notes text,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT policy_reviews_pkey PRIMARY KEY (id),
CONSTRAINT policy_reviews_policy_version_id_fkey FOREIGN KEY (policy_version_id) REFERENCES public.user_policies(id)
);
CREATE TABLE public.user_policies (
id uuid NOT NULL DEFAULT uuid_generate_v4(),
user_id uuid,
policy_type text NOT NULL,
content text,
source_questionnaire_id uuid,
created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
version_number integer DEFAULT 1,
parent_version_id uuid,
framework_coverage jsonb,
CONSTRAINT user_policies_pkey PRIMARY KEY (id),
CONSTRAINT user_policies_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES public.user_policies(id),
CONSTRAINT user_policies_source_questionnaire_id_fkey FOREIGN KEY (source_questionnaire_id) REFERENCES public.user_questionnaires(id),
CONSTRAINT user_policies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_questionnaire (
id uuid NOT NULL DEFAULT uuid_generate_v4(),
user_id uuid,
policy_type text NOT NULL,
responses jsonb,
created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'final'::text])),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
company_name text,
CONSTRAINT user_questionnaire_pkey PRIMARY KEY (id),
CONSTRAINT user_questionnaire_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_questionnaires (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
policy_type text NOT NULL CHECK (policy_type = ANY (ARRAY['privacy_policy'::text, 'ai_usage_policy'::text, 'ai_governance_policy'::text])),
status text NOT NULL CHECK (status = ANY (ARRAY['draft'::text, 'final'::text])),
answers jsonb NOT NULL DEFAULT '{}'::jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT user_questionnaires_pkey PRIMARY KEY (id)
);
