"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  analyzePolicyCompliance,
  extractMappings,
  getPolicyThresholds,
  buildApplicabilityContext,
  type PolicyType,
} from "@/lib/policycop";
import {
  extractMappingsFromMetadata,
  validatePolicyStructure,
  validateLastUpdatedFooter,
  validateContactInformation,
  type DateValidationResult,
} from "@/lib/parser";
import ReactMarkdown from "react-markdown";
import ExportButton from "@/components/ExportButton";
import MandatoryClausesDisplay from "@/components/MandatoryClausesDisplay";

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
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [policyThresholds, setPolicyThresholds] = useState<{
    gdpr: number;
    ai_act: number;
    iso_42001: number;
  } | null>(null);

  useEffect(() => {
    const generatePolicy = async () => {
      setLoading(true);
      setError(null);
      setValidationWarnings([]);

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

        const res = await fetch("/api/generate-policy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionnaireData: qData.answers,
            policyType: policyType,
          }),
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

        // Build applicability context once so structure validation and
        // PolicyCop share the same view of what applies to this company.
        const applicabilityContext = buildApplicabilityContext(
          qData.answers,
          policyType as "privacy_policy" | "ai_usage_policy" | "ai_governance_policy"
        );

        // Validate policy structure (now applicability-aware via options)
        const validation = validatePolicyStructure(
          generatedContent,
          policyType as "privacy_policy" | "ai_usage_policy" | "ai_governance_policy",
          result.metadata,
          {
            applicabilityContext,
          }
        );

        // Validate last updated footer with enhanced validation
        const dateValidation = validateLastUpdatedFooter(generatedContent);
        
        // Validate contact information
        const contactValidation = validateContactInformation(
          generatedContent,
          policyType as "privacy_policy" | "ai_usage_policy" | "ai_governance_policy"
        );
        
        const allWarnings = [...validation.warnings];
        const allErrors = [...validation.errors];
        
        // Add date validation errors and warnings
        if (dateValidation.errors.length > 0) {
          allErrors.push(...dateValidation.errors);
        }
        if (dateValidation.warnings.length > 0) {
          allWarnings.push(...dateValidation.warnings);
        }
        
        // Add contact validation errors and warnings
        if (contactValidation.errors.length > 0) {
          allErrors.push(...contactValidation.errors);
        }
        if (contactValidation.warnings.length > 0) {
          allWarnings.push(...contactValidation.warnings);
        }
        
        // Legacy check for backwards compatibility
        if (!dateValidation.hasDate && !dateValidation.isPlaceholder) {
          allWarnings.push("Last updated footer not found or incorrectly formatted");
        }

        // Log validation results
        if (allErrors.length > 0) {
          console.warn("Policy validation errors:", allErrors);
        }
        if (allWarnings.length > 0) {
          console.warn("Policy validation warnings:", allWarnings);
          setValidationWarnings(allWarnings);
        }

        // If validation fails critically, log but continue (prompts should ensure structure)
        if (!validation.isValid) {
          console.error("Policy structure validation failed:", validation.errors);
        }

        setPolicyText(generatedContent);

        // Run PolicyCop analysis on the clean content
        // Pass frameworks_selected from METAJSON metadata and applicability context
        const complianceResult = analyzePolicyCompliance(
          generatedContent,
          policyType as "privacy_policy" | "ai_usage_policy" | "ai_governance_policy",
          {
            frameworks_selected: result.metadata?.frameworks_selected,
            applicabilityContext,
          }
        );
        setPolicyCopResult(complianceResult);
        
        // Get policy-specific thresholds for display (dynamic based on applicability)
        const thresholds = getPolicyThresholds(
          policyType as "privacy_policy" | "ai_usage_policy" | "ai_governance_policy",
          applicabilityContext
        );
        setPolicyThresholds(thresholds);

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

        // If mapping appendix validation failed but we have mappings, add warning
        if (validation.errors.some((e) => e.includes("Mapping Appendix"))) {
          if (mappings.length === 0) {
            const updatedWarnings = [
              ...allWarnings,
              "Mapping Appendix not found and no framework mappings extracted",
            ];
            setValidationWarnings(updatedWarnings);
          }
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

      {policyCopResult && policyThresholds && (() => {
        // Determine if AI Act should be shown (not applicable for privacy policies)
        const currentPolicyType = mapPolicyIdToType(policyId) as PolicyType;
        const showAiAct =
          currentPolicyType !== "privacy_policy" &&
          policyThresholds.ai_act > 0;
        
        return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold">PolicyCop Compliance Score</h2>
          <div className={`grid ${showAiAct ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  GDPR
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Target: {Math.round(policyThresholds.gdpr * 100)}%
                </div>
              </div>
              <div className="text-2xl font-bold">
                {Math.round(policyCopResult.gdpr_coverage * 100)}%
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1 relative">
                <div
                  className={`h-2 rounded-full ${
                    policyCopResult.gdpr_coverage >= policyThresholds.gdpr
                      ? "bg-green-600"
                      : policyCopResult.gdpr_coverage >= policyThresholds.gdpr * 0.8
                      ? "bg-yellow-600"
                      : "bg-red-600"
                  }`}
                  style={{ width: `${policyCopResult.gdpr_coverage * 100}%` }}
                />
                <div
                  className="absolute top-0 h-2 border-r-2 border-neutral-400 dark:border-neutral-500"
                  style={{
                    left: `${policyThresholds.gdpr * 100}%`,
                  }}
                  title={`Threshold: ${Math.round(policyThresholds.gdpr * 100)}%`}
                />
              </div>
            </div>
            {showAiAct && (
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    AI Act
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    Target: {Math.round(policyThresholds.ai_act * 100)}%
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  {Math.round(policyCopResult.ai_act_coverage * 100)}%
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1 relative">
                  <div
                    className={`h-2 rounded-full ${
                      policyCopResult.ai_act_coverage >= policyThresholds.ai_act
                        ? "bg-blue-600"
                        : policyCopResult.ai_act_coverage >= policyThresholds.ai_act * 0.8
                        ? "bg-yellow-600"
                        : "bg-red-600"
                    }`}
                    style={{ width: `${policyCopResult.ai_act_coverage * 100}%` }}
                  />
                  <div
                    className="absolute top-0 h-2 border-r-2 border-neutral-400 dark:border-neutral-500"
                    style={{
                      left: `${policyThresholds.ai_act * 100}%`,
                    }}
                    title={`Threshold: ${Math.round(policyThresholds.ai_act * 100)}%`}
                  />
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  ISO 42001
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Target: {Math.round(policyThresholds.iso_42001 * 100)}%
                </div>
              </div>
              <div className="text-2xl font-bold">
                {Math.round(policyCopResult.iso_42001_coverage * 100)}%
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1 relative">
                <div
                  className={`h-2 rounded-full ${
                    policyCopResult.iso_42001_coverage >= policyThresholds.iso_42001
                      ? "bg-purple-600"
                      : policyCopResult.iso_42001_coverage >= policyThresholds.iso_42001 * 0.8
                      ? "bg-yellow-600"
                      : "bg-red-600"
                  }`}
                  style={{
                    width: `${policyCopResult.iso_42001_coverage * 100}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-2 border-r-2 border-neutral-400 dark:border-neutral-500"
                  style={{
                    left: `${policyThresholds.iso_42001 * 100}%`,
                  }}
                  title={`Threshold: ${Math.round(policyThresholds.iso_42001 * 100)}%`}
                />
              </div>
            </div>
          </div>

          <MandatoryClausesDisplay
            result={policyCopResult}
            policyType={currentPolicyType}
            className="mt-4"
          />

          {policyCopResult.missing_clauses.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                Missing required clauses:
              </p>
              {(() => {
                // Filter out AI_ACT clauses for privacy policies
                const filteredClauses = showAiAct 
                  ? policyCopResult.missing_clauses 
                  : policyCopResult.missing_clauses.filter((c: any) => c.framework !== "AI_ACT");
                
                // Group missing clauses by framework
                const groupedClauses = filteredClauses.reduce(
                  (acc: Record<string, any[]>, clause: any) => {
                    if (!acc[clause.framework]) {
                      acc[clause.framework] = [];
                    }
                    acc[clause.framework].push(clause);
                    return acc;
                  },
                  {}
                );

                // Get section recommendations for each article
                const getSectionRecommendation = (
                  framework: string,
                  articleRef: string
                ): string => {
                  const articleNum = articleRef.match(/\d+/)?.[0];
                  if (framework === "GDPR") {
                    if (articleNum === "6" || articleNum === "7" || articleNum === "13")
                      return "Data Collection Categories & Purposes";
                    if (
                      ["15", "16", "17", "18", "20", "21"].includes(articleNum || "")
                    )
                      return "Data Rights & Transparency";
                    if (articleNum === "32") return "Security Measures";
                  } else if (framework === "AI_ACT") {
                    if (articleNum === "3") return "Scope and Purpose of AI Usage";
                    if (articleNum === "4")
                      return "AI Use Cases and Applications";
                    if (articleNum === "6" || articleNum === "8" || articleNum === "9")
                      return "Risk Management and Classification";
                    if (articleNum === "10")
                      return "Data Handling and Privacy Considerations";
                    if (articleNum === "11")
                      return "Documentation and Review Procedures";
                    if (articleNum === "12")
                      return "Monitoring and Continuous Improvement";
                    if (articleNum === "14")
                      return "Human Oversight Procedures";
                    if (articleNum === "26")
                      return "Compliance and Audit Procedures";
                    if (articleNum === "73")
                      return "Incident Reporting and Response Procedures";
                  }
                  return "Policy Content";
                };

                return Object.entries(groupedClauses).map(
                  ([framework, clauses]) => {
                    const clausesArray = clauses as any[];
                    return (
                      <div key={framework} className="mb-3">
                        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                          {framework}:
                        </p>
                        <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1 ml-2">
                          {clausesArray.slice(0, 10).map((clause: any, idx: number) => (
                            <li key={idx}>
                              <span className="font-medium">
                                {clause.article_ref}:
                              </span>{" "}
                              {clause.clause_text}
                              <span className="text-xs text-neutral-500 dark:text-neutral-500 ml-1">
                                (should be addressed in:{" "}
                                {getSectionRecommendation(
                                  clause.framework,
                                  clause.article_ref
                                )}
                                )
                              </span>
                            </li>
                          ))}
                          {clausesArray.length > 10 && (
                            <li className="text-xs text-neutral-500">
                              ... and {clausesArray.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    );
                  }
                );
              })()}
            </div>
          )} 
          
          {/* Coverage Improvement Suggestions */}
          {(() => {
            const suggestions: string[] = [];
            
            if (policyCopResult.gdpr_coverage < policyThresholds.gdpr) {
              const missingGdpr = policyCopResult.missing_clauses.filter(
                (c: any) => c.framework === "GDPR"
              );
              if (missingGdpr.length > 0) {
                suggestions.push(
                  `To improve GDPR coverage (currently ${Math.round(policyCopResult.gdpr_coverage * 100)}%, target: ${Math.round(policyThresholds.gdpr * 100)}%), ensure sections address: ${missingGdpr.slice(0, 3).map((c: any) => c.article_ref).join(", ")}${missingGdpr.length > 3 ? "..." : ""}`
                );
              }
            }
            
            // Only show AI Act suggestions for non-privacy policies
            if (showAiAct && policyCopResult.ai_act_coverage < policyThresholds.ai_act) {
              const missingAiAct = policyCopResult.missing_clauses.filter(
                (c: any) => c.framework === "AI_ACT"
              );
              if (missingAiAct.length > 0) {
                suggestions.push(
                  `To improve AI Act coverage (currently ${Math.round(policyCopResult.ai_act_coverage * 100)}%, target: ${Math.round(policyThresholds.ai_act * 100)}%), ensure sections address: ${missingAiAct.slice(0, 3).map((c: any) => c.article_ref).join(", ")}${missingAiAct.length > 3 ? "..." : ""}`
                );
              }
            }
            
            if (policyCopResult.iso_42001_coverage < policyThresholds.iso_42001) {
              const missingIso = policyCopResult.missing_clauses.filter(
                (c: any) => c.framework === "ISO_42001"
              );
              if (missingIso.length > 0) {
                suggestions.push(
                  `To improve ISO 42001 coverage (currently ${Math.round(policyCopResult.iso_42001_coverage * 100)}%, target: ${Math.round(policyThresholds.iso_42001 * 100)}%), ensure sections address: ${missingIso.slice(0, 3).map((c: any) => c.article_ref).join(", ")}${missingIso.length > 3 ? "..." : ""}`
                );
              }
            }
            
            if (suggestions.length === 0) return null;
            
            return (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Coverage Improvement Suggestions:
                </p>
                <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  {suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>
        );
      })()}

      {validationWarnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4 space-y-2">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
            Validation Warnings
          </h3>
          <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            {validationWarnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
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
