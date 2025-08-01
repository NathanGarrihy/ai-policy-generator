"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildPrompt } from "@/lib/prompts";

export default function GeneratePolicyPage() {
  const { policyId } = useParams();
  const [policyText, setPolicyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generatePolicy = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      // Get most recent questionnaire
      const { data: qData, error: qError } = await supabase
        .from("user_questionnaire")
        .select("*")
        .eq("user_id", user.id)
        .eq("policy_type", "privacy_policy")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (qError || !qData) {
        setError("No questionnaire data found.");
        setLoading(false);
        return;
      }

      const prompt = buildPrompt(policyId as string, qData.responses);

      const res = await fetch("/api/generate-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const result = await res.json();

      if (!result || !result.content) {
        setError("Failed to generate policy.");
        setLoading(false);
        return;
      }

      setPolicyText(result.content);

      // Save to Supabase
      await supabase.from("user_policies").insert({
        user_id: user.id,
        policy_type: policyId,
        content: result.content,
        source_questionnaire_id: qData.id,
      });

      setLoading(false);
    };

    generatePolicy();
  }, [policyId]);

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 space-y-6 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 rounded shadow">
      <h1 className="text-3xl font-bold">Generated Policy</h1>

      {loading && <p>Generating with AI...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && policyText && (
        <pre className="whitespace-pre-wrap text-sm bg-zinc-100 dark:bg-zinc-800 p-4 rounded overflow-auto">
          {policyText}
        </pre>
      )}
    </div>
  );
}
