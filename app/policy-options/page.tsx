"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type PolicyRecommendation = {
  id: string;
  title: string;
  reason: string;
  suggested: boolean;
};

export default function PolicyOptionsPage() {
  const [recommendations, setRecommendations] = useState<
    PolicyRecommendation[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchPolicyRecommendations = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in to view this page.");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("user_questionnaire")
        .select("*")
        .eq("user_id", user.id)
        .eq("policy_type", "privacy_policy")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !data) {
        setError("Could not retrieve your questionnaire responses.");
        setLoading(false);
        return;
      }

      const responses = data.responses;

      // 🔍 Analyze responses to generate tailored suggestions
      const recs: PolicyRecommendation[] = [];

      if (
        responses.jurisdiction?.includes("GDPR (EU)") ||
        responses.jurisdiction?.includes("UK GDPR")
      ) {
        recs.push({
          id: "privacy-policy",
          title: "Privacy Policy (GDPR-compliant)",
          reason:
            "You operate in the EU or UK, which requires a clear data privacy policy.",
          suggested: true,
        });
      }

      if (responses.cookies_used === "Yes") {
        recs.push({
          id: "cookie-policy",
          title: "Cookie Policy",
          reason: "You use cookies or tracking technologies on your site.",
          suggested: true,
        });
      }

      if (responses.third_parties === "Yes") {
        recs.push({
          id: "data-sharing-disclosure",
          title: "Data Sharing Disclosure",
          reason: "You share personal data with third parties.",
          suggested: true,
        });
      }

      if (responses.data_retention) {
        recs.push({
          id: "data-retention-policy",
          title: "Data Retention Policy",
          reason: `You specified a data retention period of "${responses.data_retention}".`,
          suggested: true,
        });
      }

      // Always include general suggestion
      recs.push({
        id: "terms-of-service",
        title: "Terms of Service",
        reason:
          "Most websites and SaaS platforms require this for legal protection.",
        suggested: false,
      });

      setRecommendations(recs);
      setLoading(false);
    };

    fetchPolicyRecommendations();
  }, []);

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 space-y-8 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 rounded-lg shadow">
      <h1 className="text-3xl font-bold">Recommended Policies</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Based on your answers, here’s what we suggest setting up next:
      </p>

      {loading && <p>Loading recommendations...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <ul className="space-y-6">
          {recommendations.map((rec) => (
            <li
              key={rec.id}
              className="border-l-4 pl-4 rounded border-blue-500 bg-zinc-50 dark:bg-zinc-800 p-4"
            >
              <h2 className="text-xl font-semibold">{rec.title}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {rec.reason}
              </p>
              <div className="mt-3 flex gap-4">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
                  onClick={() => router.push(`/generate/${rec.id}`)}
                >
                  Generate
                </button>
                <button
                  className="border border-zinc-300 dark:border-zinc-600 text-sm px-4 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  onClick={() => alert("Preview not yet implemented")}
                >
                  Preview Example
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
