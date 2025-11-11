"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { QuestionnaireRow, PolicyVersion } from "@/lib/types";
import Link from "next/link";

type PolicyStatus = {
  type: string;
  name: string;
  questionnaireCompleted: boolean;
  policyGenerated: boolean;
  latestPolicy?: PolicyVersion;
  questionnaireLink: string;
  generateLink: string;
};

export default function RecommendationsPage() {
  const [policies, setPolicies] = useState<PolicyStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  async function loadRecommendations() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const policyTypes = [
      {
        type: "privacy_policy",
        name: "Privacy Policy",
        questionnaireLink: "/questionnaire",
        generateLink: "/generate/privacy-policy",
      },
      {
        type: "ai_usage_policy",
        name: "AI Usage Policy",
        questionnaireLink: "/questionnaire/ai-usage",
        generateLink: "/generate/ai-usage-policy",
      },
      {
        type: "ai_governance_policy",
        name: "AI Governance & Ethics Policy",
        questionnaireLink: "/questionnaire/ai-governance",
        generateLink: "/generate/ai-governance-policy",
      },
    ];

    const statuses: PolicyStatus[] = await Promise.all(
      policyTypes.map(async (pt) => {
        // Check for questionnaire
        const { data: questionnaire } = await supabase
          .from("user_questionnaires")
          .select("*")
          .eq("user_id", user.id)
          .eq("policy_type", pt.type)
          .eq("status", "final")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Check for generated policy
        const { data: policy } = await supabase
          .from("user_policies")
          .select("*")
          .eq("user_id", user.id)
          .eq("policy_type", pt.type)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          type: pt.type,
          name: pt.name,
          questionnaireCompleted: !!questionnaire,
          policyGenerated: !!policy,
          latestPolicy: policy as PolicyVersion | undefined,
          questionnaireLink: pt.questionnaireLink,
          generateLink: pt.generateLink,
        };
      })
    );

    setPolicies(statuses);
    setLoading(false);
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Policy Recommendations</h1>
      <p className="text-sm text-neutral-500">
        Complete questionnaires and generate your compliance policies
      </p>

      <div className="space-y-4">
        {policies.map((policy) => (
          <div
            key={policy.type}
            className="border border-neutral-200 dark:border-zinc-800 rounded-lg p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{policy.name}</h2>
                <div className="mt-2 flex gap-4 text-sm">
                  <span
                    className={
                      policy.questionnaireCompleted
                        ? "text-green-600 dark:text-green-400"
                        : "text-neutral-500"
                    }
                  >
                    {policy.questionnaireCompleted ? "✓" : "○"} Questionnaire
                  </span>
                  <span
                    className={
                      policy.policyGenerated
                        ? "text-green-600 dark:text-green-400"
                        : "text-neutral-500"
                    }
                  >
                    {policy.policyGenerated ? "✓" : "○"} Policy Generated
                  </span>
                </div>
                {policy.latestPolicy?.framework_coverage && (
                  <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Coverage:{" "}
                    {policy.latestPolicy.framework_coverage.gdpr_coverage
                      ? `GDPR ${Math.round(
                          policy.latestPolicy.framework_coverage.gdpr_coverage *
                            100
                        )}%`
                      : ""}
                    {policy.latestPolicy.framework_coverage.ai_act_coverage
                      ? `, AI Act ${Math.round(
                          policy.latestPolicy.framework_coverage
                            .ai_act_coverage * 100
                        )}%`
                      : ""}
                    {policy.latestPolicy.framework_coverage.iso_42001_coverage
                      ? `, ISO 42001 ${Math.round(
                          policy.latestPolicy.framework_coverage
                            .iso_42001_coverage * 100
                        )}%`
                      : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {!policy.questionnaireCompleted ? (
                <Link
                  href={policy.questionnaireLink}
                  className="rounded bg-black text-white px-4 py-2 inline-block hover:bg-neutral-800"
                >
                  Start Questionnaire
                </Link>
              ) : !policy.policyGenerated ? (
                <Link
                  href={policy.generateLink}
                  className="rounded bg-emerald-600 text-white px-4 py-2 inline-block hover:bg-emerald-700"
                >
                  Generate Policy
                </Link>
              ) : (
                <>
                  <Link
                    href={policy.generateLink}
                    className="rounded bg-blue-600 text-white px-4 py-2 inline-block hover:bg-blue-700"
                  >
                    View/Regenerate
                  </Link>
                  <Link
                    href={`/policies/${policy.type}/versions`}
                    className="rounded border border-neutral-300 dark:border-zinc-700 px-4 py-2 inline-block hover:bg-neutral-50 dark:hover:bg-zinc-900"
                  >
                    View Versions
                  </Link>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
