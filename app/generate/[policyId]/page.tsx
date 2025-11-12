"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildPrompt } from "@/lib/prompts";
import { analyzePolicyCompliance, extractMappings } from "@/lib/policycop";
import { extractMappingsFromMetadata } from "@/lib/parser";
import ReactMarkdown from "react-markdown";
import ExportButton from "@/components/ExportButton";

// Map URL policy IDs to database policy types
function mapPolicyIdToType(policyId: string): string {
  const mapping: Record<string, string> = {
    "privacy-policy": "privacy_policy",
    "ai-usage-policy": "ai_usage_policy",
    "ai-governance-policy": "ai_governance_policy",
  };
  return mapping[policyId] || policyId;
}

export default function GeneratePolicyPage() {
  const params = useParams() as Record<string, string | string[]>;
  const policyId = params?.policyId as string;

  const [policyText, setPolicyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policyCopResult, setPolicyCopResult] = useState<any>(null);
  const [savedPolicyId, setSavedPolicyId] = useState<string | null>(null);
  const [versionNumber, setVersionNumber] = useState<number>(1);

  useEffect(() => {
    const generatePolicy = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!policyId || Array.isArray(policyId)) {
          setError("No policy ID provided.");
          setLoading(false);
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setError("You must be logged in.");
          setLoading(false);
          return;
        }

        const policyType = mapPolicyIdToType(policyId);

        // Get most recent questionnaire for this policy type
        const { data: qData, error: qError } = await supabase
          .from("user_questionnaires")
          .select("id, answers, policy_type, status")
          .eq("user_id", user.id)
          .eq("policy_type", policyType)
          .eq("status", "final")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (qError) {
          console.error("Error fetching questionnaire:", qError);
          setError(
            `Error fetching questionnaire: ${qError.message || "Unknown error"}`
          );
          setLoading(false);
          return;
        }

        if (!qData || !qData.id) {
          setError(
            `No ${policyType} questionnaire data found. Please complete the questionnaire first.`
          );
          setLoading(false);
          return;
        }

        // Verify the questionnaire ID exists before using it
        console.log(
          "Using questionnaire ID:",
          qData.id,
          "for policy type:",
          policyType
        );

        const prompt = buildPrompt(policyId, qData.answers);

        const res = await fetch("/api/generate-policy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok) {
          const errorData = await res
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error ||
              `Generate API ${res.status}: Failed to generate policy`
          );
        }
        const result = await res.json();

        if (!result || !result.content) {
          const errorMsg =
            result?.error ||
            "Failed to generate policy. No content was returned.";
          setError(errorMsg);
          setLoading(false);
          return;
        }

        // Content is already parsed by the API (POLICY-MARKDOWN block extracted)
        const generatedContent = result.content;
        setPolicyText(generatedContent);

        // Run PolicyCop analysis on the clean content
        const complianceResult = analyzePolicyCompliance(generatedContent);
        setPolicyCopResult(complianceResult);

        // Extract mappings - prefer METAJSON if available, fallback to regex extraction
        let mappings: Array<{
          section_id: string;
          framework: "GDPR" | "AI_ACT" | "ISO_42001";
          article_ref: string;
        }> = [];

        if (result.metadata) {
          // Use mappings from METAJSON if available
          mappings = extractMappingsFromMetadata(result.metadata);
        }

        // Fallback to regex extraction if no metadata or no mappings found
        if (mappings.length === 0) {
          mappings = extractMappings(generatedContent);
        }

        // Get latest version number for this policy type
        const { data: latestPolicy } = await supabase
          .from("user_policies")
          .select("id, version_number")
          .eq("user_id", user.id)
          .eq("policy_type", policyType)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersion = latestPolicy ? latestPolicy.version_number + 1 : 1;
        const parentVersionId = latestPolicy?.id || null;
        setVersionNumber(nextVersion);

        // Verify questionnaire still exists and is accessible before saving policy
        const { data: verifyQ, error: verifyError } = await supabase
          .from("user_questionnaires")
          .select("id")
          .eq("id", qData.id)
          .eq("user_id", user.id)
          .maybeSingle();

        let questionnaireIdToUse: string | null = null;

        if (verifyError || !verifyQ) {
          console.warn(
            "Questionnaire verification failed or not accessible:",
            verifyError
          );
          console.warn("Attempted to use questionnaire ID:", qData.id);
          // If questionnaire is not accessible, try to set source_questionnaire_id to null
          // This requires the column to be nullable, otherwise we'll get a constraint error
          // For now, we'll still try to use the ID but log the warning
          questionnaireIdToUse = qData.id; // Try anyway, will fail with better error message
        } else {
          questionnaireIdToUse = qData.id;
        }

        // Save policy with versioning
        const { data: savedPolicy, error: saveError } = await supabase
          .from("user_policies")
          .insert({
            user_id: user.id,
            policy_type: policyType,
            content: generatedContent,
            version_number: nextVersion,
            parent_version_id: parentVersionId,
            framework_coverage: {
              gdpr_coverage: complianceResult.gdpr_coverage,
              ai_act_coverage: complianceResult.ai_act_coverage,
              iso_42001_coverage: complianceResult.iso_42001_coverage,
            },
            source_questionnaire_id: questionnaireIdToUse,
          })
          .select("id")
          .single();

        if (saveError) {
          console.error("Error saving policy:", saveError);
          // Provide detailed error message
          let errorMsg = "Policy generated but failed to save.";
          if (saveError.message) {
            errorMsg += ` Error: ${saveError.message}`;
          } else if (saveError.code) {
            errorMsg += ` Database error (${saveError.code})`;
          }
          if (saveError.details) {
            errorMsg += ` Details: ${saveError.details}`;
          }
          setError(errorMsg);
          setLoading(false);
          return;
        }

        setSavedPolicyId(savedPolicy.id);

        // Save mappings
        if (mappings.length > 0 && savedPolicy) {
          const mappingInserts = mappings.map((mapping) => ({
            policy_version_id: savedPolicy.id,
            section_id: mapping.section_id,
            framework: mapping.framework,
            article_ref: mapping.article_ref,
            confidence: 1.0,
          }));

          await supabase.from("policy_mappings").insert(mappingInserts);
        }

        setLoading(false);
      } catch (e: any) {
        console.error("Error generating policy:", e);
        setError(
          e.message ||
            "An unexpected error occurred while generating the policy."
        );
        setLoading(false);
      }
    };

    generatePolicy();
  }, [policyId]);

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 space-y-6">
      <h1 className="text-3xl font-bold">Generated Policy</h1>

      {loading && (
        <div className="text-center py-8">
          <p className="text-lg">Generating with AI...</p>
          <p className="text-sm text-neutral-500 mt-2">
            This may take up to 25 seconds
          </p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {policyCopResult && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold">PolicyCop Compliance Score</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                GDPR
              </div>
              <div className="text-2xl font-bold">
                {Math.round(policyCopResult.gdpr_coverage * 100)}%
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${policyCopResult.gdpr_coverage * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                AI Act
              </div>
              <div className="text-2xl font-bold">
                {Math.round(policyCopResult.ai_act_coverage * 100)}%
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${policyCopResult.ai_act_coverage * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                ISO 42001
              </div>
              <div className="text-2xl font-bold">
                {Math.round(policyCopResult.iso_42001_coverage * 100)}%
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: `${policyCopResult.iso_42001_coverage * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
          {policyCopResult.missing_clauses.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Missing required clauses:
              </p>
              <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                {policyCopResult.missing_clauses
                  .slice(0, 5)
                  .map((clause: any, idx: number) => (
                    <li key={idx}>
                      {clause.framework} {clause.article_ref}:{" "}
                      {clause.clause_text}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && policyText && savedPolicyId && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Policy Content</h2>
            <ExportButton
              policyId={savedPolicyId}
              policyType={policyId}
              versionNumber={versionNumber}
            />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-lg p-8 shadow-sm">
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{policyText}</ReactMarkdown>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
