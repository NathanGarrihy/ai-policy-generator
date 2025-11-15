"use client";

import { useState } from "react";
import type { PolicyCopResult } from "@/lib/policycop";

interface PolicyCopProps {
  result: PolicyCopResult;
  className?: string;
}

// Helper function to get framework documentation links
function getFrameworkDocLink(
  framework: string,
  articleRef: string
): string | null {
  const baseUrls: Record<string, string> = {
    GDPR: "https://gdpr-info.eu/art-",
    AI_ACT:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32021R0106",
    ISO_42001: "https://www.iso.org/standard/81230.html",
  };

  if (framework === "GDPR") {
    const articleNum = articleRef.match(/\d+/)?.[0];
    return articleNum ? `${baseUrls.GDPR}${articleNum}-gdpr/` : null;
  }

  return baseUrls[framework] || null;
}

// Helper function to generate actionable recommendations
function getRecommendation(
  framework: string,
  articleRef: string,
  clauseText: string
): string {
  const recommendations: Record<string, Record<string, string>> = {
    GDPR: {
      "Art. 6":
        "Add a section explaining the lawful basis for processing personal data (consent, contract, legal obligation, vital interests, public task, or legitimate interests).",
      "Art. 7":
        "Include information about how consent is obtained, that it can be withdrawn at any time, and how to withdraw it.",
      "Art. 13":
        "Provide clear information about data collection including: identity of controller, purposes of processing, legal basis, retention period, and data subject rights.",
      "Art. 15":
        "Document the right of access - users should be able to request confirmation of processing and access to their personal data.",
      "Art. 16":
        "Explain the right to rectification - users can request correction of inaccurate data.",
      "Art. 17":
        "Describe the right to erasure (right to be forgotten) and the conditions under which it applies.",
      "Art. 18":
        "Include information about the right to restrict processing in certain circumstances.",
      "Art. 20":
        "Document the right to data portability - users can receive their data in a structured format.",
      "Art. 21":
        "Explain the right to object to processing, especially for direct marketing purposes.",
      "Art. 32":
        "Describe security measures implemented to protect personal data (encryption, access controls, etc.).",
      "Art. 33":
        "Include procedures for data breach notification to supervisory authorities within 72 hours.",
      "Art. 35":
        "If applicable, document Data Protection Impact Assessments (DPIA) for high-risk processing.",
    },
    AI_ACT: {
      "Art. 9":
        "Add information about AI system risk classification (minimal, limited, high-risk) and corresponding obligations.",
      "Art. 10":
        "Document transparency requirements - users should be informed when interacting with AI systems.",
      "Art. 13":
        "Include details about high-risk AI systems, their purpose, and risk management measures.",
      "Art. 14":
        "Describe data governance practices for training, validation, and testing data used in AI systems.",
      "Art. 15":
        "Document technical documentation requirements for high-risk AI systems.",
      "Art. 16": "Explain record-keeping obligations for high-risk AI systems.",
      "Art. 17":
        "Include transparency and provision of information to users of high-risk AI systems.",
      "Art. 20": "Document human oversight measures for high-risk AI systems.",
      "Art. 21":
        "Describe accuracy, robustness, and cybersecurity requirements for AI systems.",
    },
    ISO_42001: {
      "§4": "Document the context of the organization, including internal and external factors affecting AI management.",
      "§5": "Include leadership and commitment statements for AI governance.",
      "§6": "Describe planning processes including risk assessment and objectives for AI systems.",
      "§7": "Document support processes including resources, competence, awareness, and communication.",
      "§8": "Include operational planning and control measures for AI system development and deployment.",
      "§9": "Document performance evaluation including monitoring, measurement, and internal audit procedures.",
      "§10":
        "Describe continuous improvement processes and non-conformity handling.",
    },
  };

  const frameworkRecs = recommendations[framework];
  if (frameworkRecs && frameworkRecs[articleRef]) {
    return frameworkRecs[articleRef];
  }

  // Generic recommendation based on clause text
  const clauseLower = clauseText.toLowerCase();
  if (clauseLower.includes("consent")) {
    return "Add clear information about how consent is obtained and how users can withdraw it.";
  }
  if (clauseLower.includes("right") || clauseLower.includes("access")) {
    return "Document the relevant data subject rights and explain how users can exercise them.";
  }
  if (clauseLower.includes("security") || clauseLower.includes("protection")) {
    return "Describe the security measures implemented to protect data and systems.";
  }
  if (clauseLower.includes("risk") || clauseLower.includes("assessment")) {
    return "Include risk assessment and management procedures for AI systems.";
  }
  if (
    clauseLower.includes("transparency") ||
    clauseLower.includes("information")
  ) {
    return "Provide clear information about AI system usage and decision-making processes.";
  }

  return `Add content addressing ${clauseText.toLowerCase()} to ensure compliance with ${framework} ${articleRef}.`;
}

// Helper function to calculate overall section score
function getSectionOverallScore(
  section: PolicyCopResult["section_scores"][0]
): number {
  const scores = [
    section.gdpr_coverage,
    section.ai_act_coverage,
    section.iso_42001_coverage,
  ].filter((score) => !isNaN(score));
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Helper function to determine if section needs improvement
function needsImprovement(
  section: PolicyCopResult["section_scores"][0]
): boolean {
  const overallScore = getSectionOverallScore(section);
  return overallScore < 0.7 || section.missing_clauses.length > 0;
}

export default function PolicyCop({ result, className = "" }: PolicyCopProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [showAllMissing, setShowAllMissing] = useState(false);

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  // Group missing clauses by section
  const missingClausesBySection = new Map<
    string,
    PolicyCopResult["missing_clauses"]
  >();

  result.section_scores.forEach((section) => {
    if (section.missing_clauses.length > 0) {
      missingClausesBySection.set(
        section.section_name,
        section.missing_clauses
      );
    }
  });

  // Also include overall missing clauses
  if (result.missing_clauses.length > 0) {
    missingClausesBySection.set("Overall Policy", result.missing_clauses);
  }

  // Sort sections by score (lowest first) to show sections needing improvement at the top
  const sortedSections = [...result.section_scores].sort((a, b) => {
    const scoreA = getSectionOverallScore(a);
    const scoreB = getSectionOverallScore(b);
    return scoreA - scoreB;
  });

  return (
    <div
      className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4 space-y-4 ${className}`}
    >
      <h2 className="text-lg font-semibold">PolicyCop Compliance Score</h2>

      {/* Overall Scores */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            GDPR
          </div>
          <div className="text-2xl font-bold">
            {Math.round(result.gdpr_coverage * 100)}%
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
            <div
              className={`h-2 rounded-full ${
                result.gdpr_coverage >= 0.7
                  ? "bg-green-600"
                  : result.gdpr_coverage >= 0.5
                  ? "bg-yellow-600"
                  : "bg-red-600"
              }`}
              style={{ width: `${result.gdpr_coverage * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            AI Act
          </div>
          <div className="text-2xl font-bold">
            {Math.round(result.ai_act_coverage * 100)}%
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
            <div
              className={`h-2 rounded-full ${
                result.ai_act_coverage >= 0.7
                  ? "bg-green-600"
                  : result.ai_act_coverage >= 0.5
                  ? "bg-yellow-600"
                  : "bg-red-600"
              }`}
              style={{ width: `${result.ai_act_coverage * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            ISO 42001
          </div>
          <div className="text-2xl font-bold">
            {Math.round(result.iso_42001_coverage * 100)}%
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
            <div
              className={`h-2 rounded-full ${
                result.iso_42001_coverage >= 0.7
                  ? "bg-green-600"
                  : result.iso_42001_coverage >= 0.5
                  ? "bg-yellow-600"
                  : "bg-red-600"
              }`}
              style={{ width: `${result.iso_42001_coverage * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Section-Level Display */}
      {result.section_scores.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md font-semibold mb-3">
            Section-by-Section Analysis
          </h3>
          <div className="space-y-2">
            {sortedSections.map((section) => {
              const isExpanded = expandedSections.has(section.section_name);
              const overallScore = getSectionOverallScore(section);
              const needsWork = needsImprovement(section);
              const hasMissing = section.missing_clauses.length > 0;

              return (
                <div
                  key={section.section_name}
                  className={`border rounded-lg overflow-hidden ${
                    needsWork
                      ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10"
                      : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  }`}
                >
                  <button
                    onClick={() => toggleSection(section.section_name)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-sm font-medium text-left">
                        {section.section_name}
                      </span>
                      {needsWork && (
                        <span className="text-xs px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded">
                          Needs Improvement
                        </span>
                      )}
                      {hasMissing && (
                        <span className="text-xs px-2 py-0.5 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded">
                          {section.missing_clauses.length} missing
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                          Overall: {Math.round(overallScore * 100)}%
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-neutral-500 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                      {/* Section Coverage Scores */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                            GDPR
                          </div>
                          <div className="text-lg font-semibold">
                            {Math.round(section.gdpr_coverage * 100)}%
                          </div>
                          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                section.gdpr_coverage >= 0.7
                                  ? "bg-green-600"
                                  : section.gdpr_coverage >= 0.5
                                  ? "bg-yellow-600"
                                  : "bg-red-600"
                              }`}
                              style={{
                                width: `${section.gdpr_coverage * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                            AI Act
                          </div>
                          <div className="text-lg font-semibold">
                            {Math.round(section.ai_act_coverage * 100)}%
                          </div>
                          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                section.ai_act_coverage >= 0.7
                                  ? "bg-green-600"
                                  : section.ai_act_coverage >= 0.5
                                  ? "bg-yellow-600"
                                  : "bg-red-600"
                              }`}
                              style={{
                                width: `${section.ai_act_coverage * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                            ISO 42001
                          </div>
                          <div className="text-lg font-semibold">
                            {Math.round(section.iso_42001_coverage * 100)}%
                          </div>
                          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                section.iso_42001_coverage >= 0.7
                                  ? "bg-green-600"
                                  : section.iso_42001_coverage >= 0.5
                                  ? "bg-yellow-600"
                                  : "bg-red-600"
                              }`}
                              style={{
                                width: `${section.iso_42001_coverage * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Missing Clauses for this Section */}
                      {hasMissing && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                            Missing Clauses in this Section:
                          </h4>
                          <div className="space-y-3">
                            {section.missing_clauses.map((clause, idx) => {
                              const docLink = getFrameworkDocLink(
                                clause.framework,
                                clause.article_ref
                              );
                              const recommendation = getRecommendation(
                                clause.framework,
                                clause.article_ref,
                                clause.clause_text
                              );

                              return (
                                <div
                                  key={idx}
                                  className="bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-800 rounded p-3 space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                          {clause.framework}{" "}
                                          {clause.article_ref}
                                        </span>
                                        {clause.required && (
                                          <span className="text-xs px-1.5 py-0.5 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded">
                                            Required
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                                        {clause.clause_text}
                                      </p>
                                    </div>
                                    {docLink && (
                                      <a
                                        href={docLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0 transition-colors"
                                        title="View framework documentation"
                                      >
                                        <svg
                                          className="w-4 h-4 transition-colors"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                          />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                  <div className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 dark:border-blue-600 pl-2 py-1">
                                    <p className="text-xs text-blue-800 dark:text-blue-300">
                                      <span className="font-medium">
                                        Recommendation:
                                      </span>{" "}
                                      {recommendation}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Enhanced Missing Clauses Display - Grouped by Section */}
      {missingClausesBySection.size > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold">Missing Clauses Summary</h3>
            {result.missing_clauses.length > 5 && (
              <button
                onClick={() => setShowAllMissing(!showAllMissing)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
              >
                {showAllMissing ? "Show Less" : "Show All"}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {Array.from(missingClausesBySection.entries()).map(
              ([sectionName, clauses]) => {
                const displayClauses = showAllMissing
                  ? clauses
                  : clauses.slice(0, 5);

                return (
                  <div
                    key={sectionName}
                    className="bg-white dark:bg-neutral-800 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
                  >
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">
                      {sectionName} ({clauses.length} missing)
                    </h4>
                    <div className="space-y-3">
                      {displayClauses.map((clause, idx) => {
                        const docLink = getFrameworkDocLink(
                          clause.framework,
                          clause.article_ref
                        );
                        const recommendation = getRecommendation(
                          clause.framework,
                          clause.article_ref,
                          clause.clause_text
                        );

                        return (
                          <div
                            key={idx}
                            className="border-l-2 border-amber-400 dark:border-amber-600 pl-3 space-y-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {clause.framework} {clause.article_ref}
                                  </span>
                                  {clause.required && (
                                    <span className="text-xs px-1.5 py-0.5 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded">
                                      Required
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                  {clause.clause_text}
                                </p>
                              </div>
                              {docLink && (
                                <a
                                  href={docLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0 transition-colors"
                                  title="View framework documentation"
                                >
                                  <svg
                                    className="w-4 h-4 transition-colors"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                  </svg>
                                </a>
                              )}
                            </div>
                            <div className="text-xs text-blue-700 dark:text-blue-300 italic">
                              💡 {recommendation}
                            </div>
                          </div>
                        );
                      })}
                      {!showAllMissing && clauses.length > 5 && (
                        <p className="text-xs text-neutral-500 italic">
                          ... and {clauses.length - 5} more missing clauses
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
}
