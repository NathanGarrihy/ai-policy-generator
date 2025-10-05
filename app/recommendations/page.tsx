"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { QuestionnaireRow } from "@/lib/types";
import Link from "next/link";

export default function RecommendationsPage() {
  const [row, setRow] = useState<QuestionnaireRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_questionnaires")
        .select("*")
        .eq("user_id", user.id)
        .eq("policy_type", "privacy_policy")
        .eq("status", "final")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) setRow(data as any);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!row)
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">No final questionnaire found</h1>
        <Link className="underline" href="/questionnaire">
          Start the questionnaire
        </Link>
      </div>
    );

  const cookiesYes = row.answers.cookies_used === "Yes";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Recommended next steps</h1>
      <p className="text-sm text-neutral-500">
        Based on your answers for <strong>{row.policy_type}</strong>.
      </p>

      <ul className="list-disc pl-5 space-y-2">
        <li>
          Generate your <strong>Privacy Policy</strong> now.
        </li>
        {row.answers.cookies_used === "Yes" && (
          <li>
            Also generate a <strong>Cookie Policy</strong>.
          </li>
        )}
        {row.answers.third_parties === "Yes" && (
          <li>
            Add a <strong>Data Sharing Disclosure</strong>.
          </li>
        )}
        <li>
          Consider a <strong>Terms of Service</strong> to cover product usage.
        </li>
      </ul>

      <div className="pt-4">
        <Link
          href="/generate/privacy-policy"
          className="rounded bg-black text-white px-4 py-2 inline-block"
        >
          Generate Privacy Policy
        </Link>
        {cookiesYes && (
          <div className="border-l-4 pl-4 rounded border-blue-500 bg-zinc-50 dark:bg-zinc-800 p-4">
            <h2 className="text-xl font-semibold">Cookie Policy</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You indicated that you use cookies — generate a Cookie Policy now.
            </p>
            <div className="mt-3">
              <Link
                href="/generate/cookie-policy"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded inline-block"
              >
                Generate Cookie Policy
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
