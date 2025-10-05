"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { PrivacyQuestionnaire } from "@/lib/types";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const JURIS = [
  "GDPR (EU)",
  "CCPA (California)",
  "UK GDPR",
  "PIPEDA (Canada)",
] as const;
const DATA = [
  "Email",
  "Name",
  "IP address",
  "Device data",
  "Payment info",
] as const;
const RET = [
  "30 days",
  "6 months",
  "1 year",
  "Indefinitely",
  "Until request for deletion",
] as const;

export default function QuestionnairePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);

  const [answers, setAnswers] = useState<PrivacyQuestionnaire>({
    company_name: "",
    jurisdictions: [],
    data_collected: [],
    third_parties: "No",
    cookies_used: "No",
    data_retention: "1 year",
  });

  // Load session user id
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
        return answers.jurisdictions.length > 0;
      case 2:
        return answers.data_collected.length > 0;
      case 3:
        return ["Yes", "No"].includes(answers.third_parties);
      case 4:
        return ["Yes", "No"].includes(answers.cookies_used);
      case 5:
        return RET.includes(answers.data_retention);
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
          policy_type: "privacy_policy",
          status: "draft",
          answers,
        }),
      });
      if (!res.ok) {
        const text = await res.text(); // show real error (like 404 HTML)
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
          policy_type: "privacy_policy",
          status: "final",
          answers,
        }),
      });
      if (!res.ok) {
        const text = await res.text(); // show real error (like 404 HTML)
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
        Privacy Policy Questionnaire
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
        <div>
          <div className="text-sm font-medium mb-2">
            Jurisdictions to comply with
          </div>
          <div className="grid grid-cols-1 gap-2">
            {JURIS.map((j) => (
              <label key={j} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={answers.jurisdictions.includes(j)}
                  onChange={(e) => {
                    setAnswers((a) => ({
                      ...a,
                      jurisdictions: e.target.checked
                        ? [...a.jurisdictions, j]
                        : a.jurisdictions.filter((x) => x !== j),
                    }));
                  }}
                />
                <span>{j}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="text-sm font-medium mb-2">Data collected</div>
          <div className="grid grid-cols-1 gap-2">
            {DATA.map((d) => (
              <label key={d} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={answers.data_collected.includes(d)}
                  onChange={(e) => {
                    setAnswers((a) => ({
                      ...a,
                      data_collected: e.target.checked
                        ? [...a.data_collected, d]
                        : a.data_collected.filter((x) => x !== d),
                    }));
                  }}
                />
                <span>{d}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Do you share data with third parties?
          </div>
          <div className="flex gap-4">
            {(["Yes", "No"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={answers.third_parties === v}
                  onChange={() =>
                    setAnswers((a) => ({ ...a, third_parties: v }))
                  }
                />
                <span>{v}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Do you use cookies or tracking technologies?
          </div>
          <div className="flex gap-4">
            {(["Yes", "No"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={answers.cookies_used === v}
                  onChange={() =>
                    setAnswers((a) => ({ ...a, cookies_used: v }))
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
            How long do you retain personal data?
          </div>
          <select
            className="rounded border p-2"
            value={answers.data_retention}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                data_retention: e.target.value as any,
              }))
            }
          >
            {RET.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
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
