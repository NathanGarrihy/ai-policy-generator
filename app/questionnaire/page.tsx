"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { privacyPolicyQuestions } from "@/lib/questions";
import { QuestionRenderer } from "@/components/QuestionRenderer";
import { supabase } from "@/lib/supabase";

export default function QuestionnairePage() {
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (id: string, value: any) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    if (loading) return;

    // Validate all questions are answered
    const unanswered = privacyPolicyQuestions.some(
      (q) => responses[q.id] === undefined || responses[q.id] === ""
    );
    if (unanswered) {
      alert("Please answer all questions before submitting.");
      return;
    }

    setLoading(true);
    const { data, error: userError } = await supabase.auth.getUser();
    const user = data?.user;

    if (userError || !user) {
      console.error("User not authenticated");
      setLoading(false);
      alert("You must be logged in to submit the questionnaire.");
      return;
    }

    const { error } = await supabase.from("user_questionnaire").insert([
      {
        user_id: user.id,
        policy_type: "privacy_policy",
        responses,
      },
    ]);

    if (error) {
      console.error("❌ Supabase insert failed:", error);
      setLoading(false);
      alert("Failed to save your responses. Please try again.");
    } else {
      setSubmitted(true);
      setTimeout(() => router.push("/policy-options"), 1000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-8 space-y-8 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 shadow rounded-lg">
      <h1 className="text-3xl font-bold">Privacy Policy Setup</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Tell us a bit about your business so we can tailor the right compliance
        policies for you.
      </p>

      {privacyPolicyQuestions.map((q) => (
        <div key={q.id} className="space-y-2">
          <label className="block font-semibold">{q.label}</label>
          <QuestionRenderer
            question={q}
            value={responses[q.id]}
            onChange={(val) => handleChange(q.id, val)}
          />
        </div>
      ))}

      <div className="pt-6">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded shadow font-medium ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Saving..." : "Save and Continue"}
        </button>
      </div>

      {submitted && (
        <div className="mt-6 p-4 bg-green-100 border-l-4 border-green-500 text-green-800 font-medium dark:bg-green-900 dark:text-green-200 dark:border-green-400">
          🚀 Preferences saved! We'll tailor your next steps based on this info.
        </div>
      )}
    </div>
  );
}
