"use client";

import type { PolicyCopResult, PolicyType } from "@/lib/policycop";

interface MandatoryClausesDisplayProps {
  result: PolicyCopResult;
  policyType?: PolicyType;
  className?: string;
}

/**
 * Highlights missing mandatory and required clauses for the current policy,
 * so users immediately see what must be added to reach a defensible baseline.
 */
export default function MandatoryClausesDisplay({
  result,
  policyType,
  className = "",
}: MandatoryClausesDisplayProps) {
  const isPrivacyPolicy = policyType === "privacy_policy";

  const filterClausesByFramework = <T extends { framework: string }>(
    clauses: T[] | undefined | null
  ): T[] => {
    if (!clauses) return [];

    // For privacy policies, AI Act is out of scope – don't surface those here.
    if (isPrivacyPolicy) {
      return clauses.filter((clause) => clause.framework !== "AI_ACT");
    }

    return clauses;
  };

  const missingMandatory = filterClausesByFramework(
    result.missing_mandatory_clauses
  );
  const missingRequired = filterClausesByFramework(
    result.missing_required_clauses
  );

  if (missingMandatory.length === 0 && missingRequired.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Mandatory Clauses */}
      {missingMandatory.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
            Missing Mandatory Clauses (must be present):
          </p>
          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1 ml-2">
            {missingMandatory.slice(0, 10).map((clause, idx) => (
              <li key={idx}>
                <span className="font-medium">
                  {clause.framework} {clause.article_ref}:
                </span>{" "}
                {clause.clause_text}
              </li>
            ))}
            {missingMandatory.length > 10 && (
              <li className="text-xs text-red-600 dark:text-red-400">
                ... and {missingMandatory.length - 10} more mandatory clauses
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Required (soft mandatory) Clauses */}
      {missingRequired.length > 0 && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Missing Required Clauses (strongly recommended):
          </p>
          <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1 ml-2">
            {missingRequired.slice(0, 10).map((clause, idx) => (
              <li key={idx}>
                <span className="font-medium">
                  {clause.framework} {clause.article_ref}:
                </span>{" "}
                {clause.clause_text}
              </li>
            ))}
            {missingRequired.length > 10 && (
              <li className="text-xs text-yellow-600 dark:text-yellow-400">
                ... and {missingRequired.length - 10} more required clauses
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}


