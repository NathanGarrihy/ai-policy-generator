"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AIUsageQuestionnaire } from "@/lib/types";

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

const AI_USED_WHERE = ["support", "content", "analytics", "coding"] as const;
const AI_PROVIDERS = ["OpenAI", "Anthropic", "open-source", "other"] as const;
const OVERSIGHT_LEVELS = ["low", "medium", "high"] as const;
const RISK_RATINGS = ["low", "medium", "high"] as const;
const RETRAINING_FREQ = [
  "never",
  "quarterly",
  "annually",
  "as-needed",
] as const;

export default function AIUsageQuestionnairePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);

  const [answers, setAnswers] = useState<AIUsageQuestionnaire>({
    company_name: "",
    ai_used_where: [],
    ai_model_provider: "OpenAI",
    data_sent_to_models: "",
    human_oversight_level: "medium",
    ai_risk_rating: "medium",
    ai_retraining_frequency: "as-needed",
    responsible_person: "",
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
        return answers.ai_used_where.length > 0;
      case 2:
        return AI_PROVIDERS.includes(answers.ai_model_provider);
      case 3:
        return answers.data_sent_to_models.trim().length > 10;
      case 4:
        return OVERSIGHT_LEVELS.includes(answers.human_oversight_level);
      case 5:
        return RISK_RATINGS.includes(answers.ai_risk_rating);
      case 6:
        return RETRAINING_FREQ.includes(answers.ai_retraining_frequency);
      case 7:
        return answers.responsible_person.trim().length > 1;
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
          policy_type: "ai_usage_policy",
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
          policy_type: "ai_usage_policy",
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
    saveDraft().then(() => setStep((s) => Math.min(7, s + 1) as Step));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1) as Step);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-4">
        AI Usage Policy Questionnaire
      </h1>
      <p className="text-sm text-neutral-500 mb-6">Step {step + 1} of 8</p>

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
        <div>
          <div className="text-sm font-medium mb-2">
            Where is AI used in your organization?
          </div>
          <div className="grid grid-cols-1 gap-2">
            {AI_USED_WHERE.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={answers.ai_used_where.includes(option)}
                  onChange={(e) => {
                    setAnswers((a) => ({
                      ...a,
                      ai_used_where: e.target.checked
                        ? [...a.ai_used_where, option]
                        : a.ai_used_where.filter((x) => x !== option),
                    }));
                  }}
                />
                <span className="capitalize">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Which AI model provider do you use?
          </div>
          <select
            className="rounded border p-2 w-full"
            value={answers.ai_model_provider}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                ai_model_provider: e.target.value as any,
              }))
            }
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p === "open-source" ? "Open Source" : p}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            What data is sent to AI models?
          </label>
          <textarea
            className="w-full rounded border p-2 min-h-[100px]"
            value={answers.data_sent_to_models}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                data_sent_to_models: e.target.value,
              }))
            }
            placeholder="Describe the types of data sent to AI models (e.g., customer queries, user content, analytics data)"
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            What is the level of human oversight?
          </div>
          <select
            className="rounded border p-2 w-full"
            value={answers.human_oversight_level}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                human_oversight_level: e.target.value as any,
              }))
            }
          >
            {OVERSIGHT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            What is your AI risk rating?
          </div>
          <select
            className="rounded border p-2 w-full"
            value={answers.ai_risk_rating}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                ai_risk_rating: e.target.value as any,
              }))
            }
          >
            {RISK_RATINGS.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            How often do you retrain or update AI models?
          </div>
          <select
            className="rounded border p-2 w-full"
            value={answers.ai_retraining_frequency}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                ai_retraining_frequency: e.target.value as any,
              }))
            }
          >
            {RETRAINING_FREQ.map((f) => (
              <option key={f} value={f}>
                {f === "as-needed"
                  ? "As Needed"
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 7 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Who is the responsible person for AI usage?
          </label>
          <input
            className="w-full rounded border p-2"
            value={answers.responsible_person}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, responsible_person: e.target.value }))
            }
            placeholder="Name or role of the person responsible"
          />
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

        {step < 7 ? (
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
