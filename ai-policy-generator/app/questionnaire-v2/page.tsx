"use client";

import { useEffect, useState, useMemo } from "react";
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

type Step = {
  id: string;
  label: string;
};

// Base step definitions. Individual steps may be conditionally removed
// based on user answers (see computeSteps below).
export const BASE_STEPS: Step[] = [
  { id: "company", label: "Company Info" },
  { id: "data", label: "Data Collected" },
  { id: "cookies", label: "Cookies & Analytics" },
  { id: "retention", label: "Retention" },
  { id: "compliance", label: "Compliance" },
  { id: "review", label: "Review & Save" },
];

/**
 * Generate a basic policy preview given questionnaire answers.
 *
 * This is a naive implementation intended as a placeholder for the V2 MVP.
 * In a production system this function would call an OpenAI API or other
 * template engine to produce a more comprehensive document.
 */
export function generatePolicyPreview(answers: Record<string, any>): string {
  const parts: string[] = [];
  if (answers.companyName) {
    parts.push(
      `Our company, ${answers.companyName}, operates in the ${
        answers.industry ?? "N/A"
      } sector.`
    );
  }
  if (answers.dataTypes?.length) {
    parts.push(
      `We collect the following personal data: ${answers.dataTypes.join(
        ", "
      )}.`
    );
  }
  if (answers.useCookies) {
    parts.push(
      answers.useCookies === "yes"
        ? `We use cookies and tracking technologies${
            answers.cookieBanner
              ? ` and display a cookie consent banner`
              : ""
          }${
            answers.trackingTools
              ? ` with tools such as ${answers.trackingTools}`
              : ""
          }.`
        : `We do not use cookies or tracking technologies.`
    );
  }
  if (answers.retentionPeriod) {
    parts.push(
      `We retain personal data for ${answers.retentionPeriod}.`
    );
  }
  if (answers.supportRights) {
    const rightsMap: Record<string, string> = {
      gdpr: "GDPR",
      ccpa: "CCPA",
      both: "GDPR and CCPA",
      none: "no specific",
    };
    parts.push(
      `We support ${
        rightsMap[answers.supportRights] || answers.supportRights
      } data subject rights${
        answers.dpo ? ` and our Data Protection Officer is ${answers.dpo}` : ""
      }.`
    );
  }
  if (!parts.length) {
    return "No answers provided.";
  }
  return parts.join(" ");
}

export default function QuestionnaireV2() {
  const router = useRouter();
  // Current index into `steps`. This is recalculated whenever the list
  // of steps changes based on answers.
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [bootstrapping, setBootstrapping] = useState<boolean>(true);

  // Dynamically derive the list of steps based on current answers.
  const steps: Step[] = useMemo(() => {
    const derived = [...BASE_STEPS];
    // Skip the cookies step entirely when the user specifies they do not
    // use cookies. This is our simplest example of dynamic branching.
    if (answers.useCookies === "no") {
      return derived.filter((step) => step.id !== "cookies");
    }
    return derived;
  }, [answers.useCookies]);

  // When the steps change (due to answers), ensure currentStep remains valid.
  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(steps.length - 1);
    }
  }, [steps, currentStep]);

  // On mount, load the user's draft if authenticated.
  useEffect(() => {
    const bootstrap = async () => {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authErr || !user) {
        toast.error("Please sign in to continue.");
        router.push("/");
        return;
      }

      // Attempt to load existing draft responses.
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

  const handleAnswerChange = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Persist the current answers as a draft for the authenticated user.
   *
   * Returns true on success, false on failure. Errors are displayed toasts.
   */
  const saveDraft = async (): Promise<boolean> => {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user || authErr) {
      toast.error("User not authenticated. Please log in.");
      return false;
    }
    // Does a draft already exist?
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
    // Update or insert accordingly.
    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("user_questionnaire")
        .update({ responses: answers })
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
      });
    if (insertErr) {
      console.error("Insert draft error:", insertErr);
      toast.error(insertErr.message || "Failed to save draft.");
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    setLoading(true);
    const t = toast.loading("Saving responses...");
    const ok = await saveDraft();
    toast.dismiss(t);
    if (ok) {
      // compute next step index skipping removed steps
      const nextIndex = currentStep + 1;
      if (nextIndex < steps.length) {
        setCurrentStep(nextIndex);
        toast.success("Saved.");
      }
    }
    setLoading(false);
  };

  const handleBack = async () => {
    setLoading(true);
    await saveDraft(); // best-effort save on back
    setCurrentStep((idx) => Math.max(idx - 1, 0));
    setLoading(false);
  };

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
    // always persist latest responses first
    const ok = await saveDraft();
    if (!ok) {
      toast.dismiss(t);
      setLoading(false);
      return;
    }
    // Promote draft to final
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
    // Create a fresh empty draft (non-blocking)
    await supabase.from("user_questionnaire").insert({
      user_id: user.id,
      policy_type: POLICY_TYPE,
      status: "draft",
      responses: {},
    });
    toast.dismiss(t);
    toast.success("Saved as final. Ready for policy generation.");
    setLoading(false);
    // Optionally redirect to a policy generation page.
  };

  const renderStep = () => {
    const id = steps[currentStep].id;
    switch (id) {
      case "company":
        return (
          <CompanyInfoStep
            answers={answers}
            onChange={handleAnswerChange}
          />
        );
      case "data":
        return (
          <DataCollectedStep
            answers={answers}
            onChange={handleAnswerChange}
          />
        );
      case "cookies":
        return (
          <CookiesStep
            answers={answers}
            onChange={handleAnswerChange}
          />
        );
      case "retention":
        return (
          <RetentionStep
            answers={answers}
            onChange={handleAnswerChange}
          />
        );
      case "compliance":
        return (
          <ComplianceStep
            answers={answers}
            onChange={handleAnswerChange}
          />
        );
      case "review":
        return <ReviewStep answers={answers} />;
      default:
        return null;
    }
  };

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl p-4">
      {/* Step progress */}
      <nav className="flex items-center justify-center mb-8 gap-2 text-sm">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-1">
            <div
              className={`h-8 w-8 flex items-center justify-center rounded-full text-white ${
                index === currentStep
                  ? "bg-blue-600"
                  : index < currentStep
                  ? "bg-green-600"
                  : "bg-gray-400"
              }`}
            >
              {index + 1}
            </div>
            <span>{step.label}</span>
            {index < steps.length - 1 && (
              <span className="text-gray-400">→</span>
            )}
          </div>
        ))}
      </nav>

      {/* Step form */}
      <div className="mb-8">{renderStep()}</div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          disabled={currentStep === 0 || loading}
          className={`px-4 py-2 rounded ${
            currentStep === 0 || loading
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-gray-600 hover:bg-gray-700 text-white"
          }`}
          onClick={handleBack}
        >
          {loading ? "Saving..." : "Back"}
        </button>
        <button
          className={`px-4 py-2 rounded ${
            loading
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
          onClick={
            steps[currentStep].id === "review" ? handleFinalSave : handleNext
          }
        >
          {loading
            ? "Saving..."
            : steps[currentStep].id === "review"
            ? "Save"
            : "Next"}
        </button>
      </div>
    </main>
  );
}
