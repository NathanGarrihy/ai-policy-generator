"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import type { PolicyVersion } from "@/lib/types";

export default function PolicyVersionsPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = params.policyId as string;

  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, [policyId]);

  async function loadVersions() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      // Get all policies for this user and policy type
      const { data, error } = await supabase
        .from("user_policies")
        .select("*")
        .eq("user_id", user.id)
        .eq("policy_type", policyId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersions((data as PolicyVersion[]) || []);
    } catch (e) {
      console.error("Error loading versions:", e);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getCoverageDisplay(coverage: any) {
    if (!coverage) return "N/A";
    const parts = [];
    if (coverage.gdpr_coverage)
      parts.push(`GDPR: ${Math.round(coverage.gdpr_coverage * 100)}%`);
    if (coverage.ai_act_coverage)
      parts.push(`AI Act: ${Math.round(coverage.ai_act_coverage * 100)}%`);
    if (coverage.iso_42001_coverage)
      parts.push(`ISO: ${Math.round(coverage.iso_42001_coverage * 100)}%`);
    return parts.join(", ") || "N/A";
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>Loading versions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Policy Versions</h1>
        <Link
          href={`/generate/${policyId}`}
          className="text-blue-600 hover:underline"
        >
          Generate New Version
        </Link>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          No versions found. Generate your first policy to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {versions.map((version) => (
            <div
              key={version.id}
              className="border border-neutral-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-neutral-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      Version {version.version_number}
                    </h3>
                    <span className="text-xs text-neutral-500">
                      {formatDate(version.created_at)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Coverage: {getCoverageDisplay(version.framework_coverage)}
                  </div>
                  {version.parent_version_id && (
                    <div className="mt-1 text-xs text-neutral-500">
                      Based on version{" "}
                      {
                        versions.find((v) => v.id === version.parent_version_id)
                          ?.version_number
                      }
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (selectedVersion === version.id) {
                        setSelectedVersion(null);
                      } else {
                        setSelectedVersion(version.id);
                        setCompareWith(null);
                      }
                    }}
                    className="text-sm px-3 py-1 border rounded hover:bg-neutral-100 dark:hover:bg-zinc-800"
                  >
                    {selectedVersion === version.id ? "Hide" : "View"}
                  </button>
                  {selectedVersion && selectedVersion !== version.id && (
                    <button
                      onClick={() => setCompareWith(version.id)}
                      className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Compare
                    </button>
                  )}
                </div>
              </div>

              {selectedVersion === version.id && (
                <div className="mt-4 p-4 bg-neutral-50 dark:bg-zinc-900 rounded border">
                  <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-96">
                    {version.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {compareWith && selectedVersion && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
          <p className="text-sm">
            Comparing version {versions.find((v) => v.id === selectedVersion)?.version_number}{" "}
            with version {versions.find((v) => v.id === compareWith)?.version_number}
          </p>
          <Link
            href={`/api/policy-versions?version_id=${selectedVersion}&compare_with=${compareWith}`}
            className="text-blue-600 hover:underline text-sm mt-2 inline-block"
          >
            View detailed diff
          </Link>
        </div>
      )}
    </div>
  );
}

