"use client";

import { useState } from "react";
import CompanyInfoStep from "@/components/questionnaire-v2/CompanyInfoStep";
import DataCollectedStep from "@/components/questionnaire-v2/DataCollectedStep";
import CookiesStep from "@/components/questionnaire-v2/CookiesStep";
import RetentionStep from "@/components/questionnaire-v2/RetentionStep";
import ComplianceStep from "@/components/questionnaire-v2/ComplianceStep";
import { supabase } from "@/lib/supabase";
import ReviewStep from "@/components/questionnaire-v2/ReviewStep";
import { toast } from "sonner";

const steps = [
  { id: "company", label: "Company Info" },
  { id: "data", label: "Data Collected" },
  { id: "cookies", label: "Cookies & Analytics" },
  { id: "retention", label: "Retention" },
  { id: "compliance", label: "Compliance" },
  { id: "review", label: "Review & Save" },
];

export default function QuestionnaireV2() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setSaving(true);
      try {
        await saveToSupabase();
        setCurrentStep((prev) => prev + 1);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleBack = async () => {
    if (currentStep > 0) {
      setSaving(true);
      try {
        await saveToSupabase();
        setCurrentStep((prev) => prev - 1);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleAnswerChange = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const saveToSupabase = async () => {
    toast.loading("Saving responses...");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user || authError) {
      toast.error("User not authenticated. Please log in.");
      return;
    }

    const { error } = await supabase
      .from("user_questionnaire")
      .upsert([
        { user_id: user.id, policy_type: "privacy_policy", responses: answers },
      ]);

    if (error) {
      console.error("Supabase error:", error);
      toast.error("❌ Failed to save. Try again.");
    } else {
      toast.success("✅ Saved successfully!");
    }
  };

  const stepComponent = () => {
    switch (steps[currentStep].id) {
      case "company":
        return (
          <CompanyInfoStep answers={answers} onChange={handleAnswerChange} />
        );
      case "data":
        return (
          <DataCollectedStep answers={answers} onChange={handleAnswerChange} />
        );
      case "cookies":
        return <CookiesStep answers={answers} onChange={handleAnswerChange} />;
      case "retention":
        return (
          <RetentionStep answers={answers} onChange={handleAnswerChange} />
        );
      case "compliance":
        return (
          <ComplianceStep answers={answers} onChange={handleAnswerChange} />
        );
      case "review":
        return <ReviewStep answers={answers} />;
      default:
        return null;
    }
  };
  {
    steps[currentStep].id === "review" && (
      <div className="text-right">
        <button
          onClick={async () => {
            await saveToSupabase();
            alert("✅ Saved successfully! Ready for policy generation.");
          }}
          className="bg-green-600 text-white px-4 py-2 rounded text-sm mt-4"
        >
          Save & Finish
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto overflow-x-auto px-4 pb-4">
      <div className="flex items-center justify-center gap-4 flex-wrap text-sm text-zinc-400">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-1">
            <div
              className={`w-6 h-6 rounded-full text-center text-sm font-bold ${
                index === currentStep
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-700 text-zinc-300"
              }`}
            >
              {index + 1}
            </div>
            <span>{step.label}</span>
            {index < steps.length - 1 && (
              <span className="text-zinc-500">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Step Form */}
      <div>{stepComponent()}</div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6">
        <button
          onClick={handleBack}
          disabled={currentStep === 0 || saving}
          className={`px-4 py-2 rounded text-sm border ${
            saving ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {saving ? "Saving..." : "Back"}
        </button>

        <button
          onClick={handleNext}
          disabled={saving}
          className={`px-4 py-2 rounded text-sm bg-blue-600 text-white ${
            saving ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
          }`}
        >
          {saving
            ? "Saving..."
            : currentStep === steps.length - 2
            ? "Review"
            : "Next"}
        </button>
      </div>
    </div>
  );
}
