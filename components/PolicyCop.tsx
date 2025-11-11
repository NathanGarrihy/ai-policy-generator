"use client";

import type { PolicyCopResult } from "@/lib/policycop";

interface PolicyCopProps {
  result: PolicyCopResult;
  className?: string;
}

export default function PolicyCop({ result, className = "" }: PolicyCopProps) {
  return (
    <div
      className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4 space-y-3 ${className}`}
    >
      <h2 className="text-lg font-semibold">PolicyCop Compliance Score</h2>
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
      {result.missing_clauses.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Missing required clauses:
          </p>
          <ul className="list-disc list-inside text-sm mt-1 space-y-1">
            {result.missing_clauses.slice(0, 5).map((clause, idx) => (
              <li key={idx}>
                {clause.framework} {clause.article_ref}: {clause.clause_text}
              </li>
            ))}
            {result.missing_clauses.length > 5 && (
              <li className="text-neutral-500">
                ... and {result.missing_clauses.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
