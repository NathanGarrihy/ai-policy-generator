"use client";

import { useState } from "react";

interface ExportButtonProps {
  policyId: string;
  policyType: string;
  versionNumber: number;
}

export default function ExportButton({
  policyId,
  policyType,
  versionNumber,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: "pdf" | "docx") {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/export-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_id: policyId,
          format,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${policyType}_v${versionNumber}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <button
          onClick={() => handleExport("pdf")}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Exporting...
            </>
          ) : (
            <>
              <span>📄</span>
              Export PDF
            </>
          )}
        </button>
        <button
          onClick={() => handleExport("docx")}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Exporting...
            </>
          ) : (
            <>
              <span>📝</span>
              Export DOCX
            </>
          )}
        </button>
      </div>
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

