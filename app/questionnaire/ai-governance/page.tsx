"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AIGovernanceQuestionnaire } from "@/lib/types";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const DOC_FREQ = ["quarterly", "annually"] as const;
const PRINCIPLES = ["Transparency", "Fairness", "Accountability"] as const;

export default function AIGovernanceQuestionnairePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);

  const [answers, setAnswers] = useState<AIGovernanceQuestionnaire>({
    company_name: "",
    ai_governance_owner_role: "",
    documentation_frequency: "quarterly",
    responsible_ai_principles: [],
    training_provided: "No",
    incident_reporting_procedure: "No",
  });

  useEffect(() => {
    supabase.auth
      .getUser()
      .then((res: { data: { user: { id: string } | null } }) => {
        const uid = res.data.user?.id ?? null;
        setUserId(uid);
      });
  }, []);

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return answers.company_name.trim().length > 1;
      case 1:
        return answers.ai_governance_owner_role.trim().length > 1;
      case 2:
        return DOC_FREQ.includes(answers.documentation_frequency);
      case 3:
        return answers.responsible_ai_principles.length > 0;
      case 4:
        return ["Yes", "No"].includes(answers.training_provided);
      case 5:
        return ["Yes", "No"].includes(answers.incident_reporting_procedure);
      default:
        return false;
    }
  }, [answers, step]);

  async function saveDraft() {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          policy_type: "ai_governance_policy",
          status: "draft",
          answers,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Questionnaire API ${res.status}: ${text}`);
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Draft save failed");
    } finally {
      setSaving(false);
    }
  }

  async function finalizeAndGo() {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          policy_type: "ai_governance_policy",
          status: "final",
          answers,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Questionnaire API ${res.status}: ${text}`);
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Finalize failed");
      router.push("/recommendations");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (!canNext) return;
    saveDraft().then(() => setStep((s) => Math.min(5, s + 1) as Step));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1) as Step);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-4">
        AI Governance & Ethics Policy Questionnaire
      </h1>
      <p className="text-sm text-neutral-500 mb-6">Step {step + 1} of 6</p>

      {step === 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Company Name</label>
          <input
            className="w-full rounded border p-2"
            value={answers.company_name}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, company_name: e.target.value }))
            }
            placeholder="Acme Ltd."
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            What is the role of the AI governance owner?
          </label>
          <input
            className="w-full rounded border p-2"
            value={answers.ai_governance_owner_role}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                ai_governance_owner_role: e.target.value,
              }))
            }
            placeholder="e.g., Chief Technology Officer, AI Ethics Lead"
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            How often is AI governance documentation updated?
          </div>
          <select
            className="rounded border p-2 w-full"
            value={answers.documentation_frequency}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                documentation_frequency: e.target.value as any,
              }))
            }
          >
            {DOC_FREQ.map((f) => (
              <option key={f} value={f}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="text-sm font-medium mb-2">
            Which responsible AI principles do you follow?
          </div>
          <div className="grid grid-cols-1 gap-2">
            {PRINCIPLES.map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={answers.responsible_ai_principles.includes(p)}
                  onChange={(e) => {
                    setAnswers((a) => ({
                      ...a,
                      responsible_ai_principles: e.target.checked
                        ? [...a.responsible_ai_principles, p]
                        : a.responsible_ai_principles.filter((x) => x !== p),
                    }));
                  }}
                />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Is training provided to employees on AI governance?
          </div>
          <div className="flex gap-4">
            {(["Yes", "No"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={answers.training_provided === v}
                  onChange={() =>
                    setAnswers((a) => ({ ...a, training_provided: v }))
                  }
                />
                <span>{v}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Do you have an incident reporting procedure for AI issues?
          </div>
          <div className="flex gap-4">
            {(["Yes", "No"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={answers.incident_reporting_procedure === v}
                  onChange={() =>
                    setAnswers((a) => ({
                      ...a,
                      incident_reporting_procedure: v,
                    }))
                  }
                />
                <span>{v}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          className="rounded px-4 py-2 border"
          onClick={back}
          disabled={step === 0 || saving}
        >
          Back
        </button>

        {step < 5 ? (
          <button
            className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
            disabled={!canNext || saving}
            onClick={next}
          >
            {saving ? "Saving…" : "Next"}
          </button>
        ) : (
          <button
            className="rounded bg-emerald-600 text-white px-4 py-2 disabled:opacity-50"
            disabled={!canNext || saving}
            onClick={finalizeAndGo}
          >
            {saving ? "Finishing…" : "Finish & See Recommendations"}
          </button>
        )}
      </div>
    </div>
  );
}

