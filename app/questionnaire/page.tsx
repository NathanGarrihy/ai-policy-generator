"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { privacyPolicyQuestions } from "@/lib/questions";
import { QuestionRenderer } from "@/components/QuestionRenderer";

export default function QuestionnairePage() {
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const handleChange = (id: string, value: any) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = () => {
    console.log("🧠 User responses:", responses);

    // Optional: store in localStorage or Supabase later
    localStorage.setItem("policyResponses", JSON.stringify(responses));

    setSubmitted(true);
    setTimeout(() => {
      router.push("/policy-options"); // 👈 Update this route when the next step is built
    }, 1000);
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
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded shadow font-medium"
        >
          Continue
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
