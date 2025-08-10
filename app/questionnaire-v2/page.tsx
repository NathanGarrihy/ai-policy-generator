"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import CompanyInfoStep from "@/components/questionnaire-v2/CompanyInfoStep";
import DataCollectedStep from "@/components/questionnaire-v2/DataCollectedStep";
import CookiesStep from "@/components/questionnaire-v2/CookiesStep";
import RetentionStep from "@/components/questionnaire-v2/RetentionStep";
import ComplianceStep from "@/components/questionnaire-v2/ComplianceStep";
import ReviewStep from "@/components/questionnaire-v2/ReviewStep";

const POLICY_TYPE = "privacy_policy_v2";

const steps = [
  { id: "company", label: "Company Info" },
  { id: "data", label: "Data Collected" },
  { id: "cookies", label: "Cookies & Analytics" },
  { id: "retention", label: "Retention" },
  { id: "compliance", label: "Compliance" },
  { id: "review", label: "Review & Save" },
];

export default function QuestionnaireV2() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const isLastStep = currentStep === steps.length - 1;

  // ---------- Prefill from existing DRAFT on mount ----------
  useEffect(() => {
    const bootstrap = async () => {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authErr || !user) {
        toast.error("Please sign in to continue.");
        router.push("/");
        return;
      }

      const { data: draft, error: draftErr } = await supabase
        .from("user_questionnaire")
        .select("id, responses")
        .eq("user_id", user.id)
        .eq("policy_type", POLICY_TYPE)
        .eq("status", "draft")
        .maybeSingle();

      if (draftErr) {
        console.error("Load draft error:", draftErr);
        toast.error("Could not load your draft.");
      } else if (draft?.responses) {
        setAnswers(draft.responses || {});
      }

      setBootstrapping(false);
    };

    bootstrap();
  }, [router]);

  // ---------- Helpers ----------
  const handleAnswerChange = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const saveDraft = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user || authError) {
      toast.error("User not authenticated. Please log in.");
      return false;
    }

    // Try to find current draft
    const { data: existing, error: selectErr } = await supabase
      .from("user_questionnaire")
      .select("id")
      .eq("user_id", user.id)
      .eq("policy_type", POLICY_TYPE)
      .eq("status", "draft")
      .maybeSingle();

    if (selectErr) {
      console.error("Select draft error:", selectErr);
      toast.error(selectErr.message || "Failed to load draft.");
      return false;
    }

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("user_questionnaire")
        .update({
          responses: answers,
          // company_name: answers.companyName ?? null, // add back after cache refreshed
        })
        .eq("id", existing.id);

      if (updateErr) {
        console.error("Update draft error:", updateErr);
        toast.error(updateErr.message || "Failed to save draft.");
        return false;
      }
      return true;
    }

    const { error: insertErr } = await supabase
      .from("user_questionnaire")
      .insert({
        user_id: user.id,
        policy_type: POLICY_TYPE,
        status: "draft",
        responses: answers,
        // company_name: answers.companyName ?? null, // add back after cache refreshed
      });

    if (insertErr) {
      console.error("Insert draft error:", insertErr);
      toast.error(insertErr.message || "Failed to save draft.");
      return false;
    }

    return true;
  };

  // ---------- Navigation ----------
  const handleNext = async () => {
    setLoading(true);
    const t = toast.loading("Saving responses...");
    const ok = await saveDraft();
    toast.dismiss(t);

    if (ok && currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
      toast.success("Saved.");
    }
    setLoading(false);
  };

  const handleBack = async () => {
    setLoading(true);
    await saveDraft(); // best-effort save on back too
    setCurrentStep((s) => Math.max(s - 1, 0));
    setLoading(false);
  };

  // ---------- Finalize: draft -> final, then create fresh draft ----------
  const handleFinalSave = async () => {
    setLoading(true);
    const t = toast.loading("Finalizing...");

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      toast.dismiss(t);
      toast.error("Please sign in.");
      setLoading(false);
      return;
    }

    // Always save latest edits first
    const ok = await saveDraft();
    if (!ok) {
      toast.dismiss(t);
      setLoading(false);
      return;
    }

    // Promote draft -> final
    const { error: promoteErr } = await supabase
      .from("user_questionnaire")
      .update({ status: "final" })
      .eq("user_id", user.id)
      .eq("policy_type", POLICY_TYPE)
      .eq("status", "draft");

    if (promoteErr) {
      console.error("Promote error:", promoteErr);
      toast.dismiss(t);
      toast.error(promoteErr.message || "Failed to finalize.");
      setLoading(false);
      return;
    }

    // Seed a fresh empty draft (non-blocking)
    await supabase.from("user_questionnaire").insert({
      user_id: user.id,
      policy_type: POLICY_TYPE,
      status: "draft",
      responses: {},
    });

    toast.dismiss(t);
    toast.success("Saved as final. Ready for policy generation.");
    setLoading(false);

    // Optional next step:
    // router.push("/policy-options");
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

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading…
      </div>
    );
  }

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
