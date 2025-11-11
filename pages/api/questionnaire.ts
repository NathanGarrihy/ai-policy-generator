// pages/api/questionnaire.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

function srv() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    return res
      .status(200)
      .json({ ok: true, route: "/api/questionnaire (pages)" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { user_id, policy_type, status, answers } = req.body || {};
    if (!user_id) throw new Error("Missing user_id");
    if (
      !["privacy_policy", "ai_usage_policy", "ai_governance_policy"].includes(
        policy_type
      )
    )
      throw new Error("Invalid policy_type");
    if (!["draft", "final"].includes(status)) throw new Error("Invalid status");

    const supabase = srv();

    if (status === "draft") {
      const { data: existing, error: selErr } = await supabase
        .from("user_questionnaires")
        .select("id")
        .eq("user_id", user_id)
        .eq("policy_type", policy_type)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error } = await supabase
          .from("user_questionnaires")
          .update({ answers })
          .eq("id", existing.id);
        if (error) throw error;
        return res
          .status(200)
          .json({ ok: true, id: existing.id, mode: "updated-draft" });
      } else {
        const { data, error } = await supabase
          .from("user_questionnaires")
          .insert({
            user_id,
            policy_type,
            status: "draft",
            answers,
          })
          .select("id")
          .single();
        if (error) throw error;
        return res
          .status(200)
          .json({ ok: true, id: data!.id, mode: "created-draft" });
      }
    }

    const { data, error } = await supabase
      .from("user_questionnaires")
      .insert({
        user_id,
        policy_type,
        status: "final",
        answers,
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabase
      .from("user_questionnaires")
      .delete()
      .eq("user_id", user_id)
      .eq("policy_type", policy_type)
      .eq("status", "draft");

    return res
      .status(200)
      .json({ ok: true, id: data!.id, mode: "created-final" });
  } catch (e: any) {
    return res
      .status(400)
      .json({ ok: false, error: e.message ?? "Unknown error" });
  }
}
