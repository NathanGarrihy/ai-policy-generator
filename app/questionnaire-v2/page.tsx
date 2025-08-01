"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import CompanyInfoStep from "@/components/questionnaire-v2/CompanyInfoStep";
import DataCollectedStep from "@/components/questionnaire-v2/DataCollectedStep";
import CookiesStep from "@/components/questionnaire-v2/CookiesStep";
import RetentionStep from "@/components/questionnaire-v2/RetentionStep";
import ComplianceStep from "@/components/questionnaire-v2/ComplianceStep";
import ReviewStep from "@/components/questionnaire-v2/ReviewStep";

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
  const [loading, setLoading] = useState(false);

  const isLastStep = currentStep === steps.length - 1;

  const handleAnswerChange = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const saveToSupabase = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user || authError) {
      toast.error("User not authenticated. Please log in.");
      return false;
    }

    const { error } = await supabase.from("user_questionnaire").upsert([
      {
        user_id: user.id,
        policy_type: "privacy_policy_v2",
        responses: answers,
      },
    ]);

    if (error) {
      console.error("❌ Supabase error:", error);
      toast.error("Failed to save. Try again.");
      return false;
    }

    return true;
  };

  const handleNext = async () => {
    setLoading(true);
    toast.loading("Saving responses...");
    const success = await saveToSupabase();
    toast.dismiss();

    if (success && currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }

    setLoading(false);
  };

  const handleBack = async () => {
    setLoading(true);
    await saveToSupabase();
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setLoading(false);
  };

  const handleFinalSave = async () => {
    setLoading(true);
    toast.loading("Saving final responses...");
    const success = await saveToSupabase();
    toast.dismiss();

    if (success) {
      toast.success("🎉 Saved successfully! Ready for policy generation.");
      // Optional redirect here
      // router.push("/policy-options");
    }

    setLoading(false);
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

  return (
    <div className="max-w-4xl mx-auto overflow-x-auto px-4 pb-4">
      {/* Step progress */}
      <div className="flex items-center justify-center gap-4 flex-wrap text-sm text-zinc-400 mb-8">
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

      {/* Step form */}
      <div>{stepComponent()}</div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          onClick={handleBack}
          disabled={currentStep === 0 || loading}
          className={`px-4 py-2 rounded text-sm border ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Saving..." : "Back"}
        </button>

        <button
          onClick={isLastStep ? handleFinalSave : handleNext}
          disabled={loading}
          className={`bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded shadow font-medium ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Saving..." : isLastStep ? "Save" : "Next"}
        </button>
      </div>
    </div>
  );
}
