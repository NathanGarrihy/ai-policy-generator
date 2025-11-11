import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function srv() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/questionnaire (app router)",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, policy_type, status, answers } = body || {};

    if (!user_id) throw new Error("Missing user_id");
    if (
      !["privacy_policy", "ai_usage_policy", "ai_governance_policy"].includes(
        policy_type
      )
    )
      throw new Error(`Invalid policy_type: ${policy_type}`);
    if (!["draft", "final"].includes(status))
      throw new Error("Invalid status");

    const supabase = srv();
    
    // Log for debugging
    console.log("Questionnaire API - Received:", { user_id, policy_type, status, hasAnswers: !!answers });

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
        return NextResponse.json({
          ok: true,
          id: existing.id,
          mode: "updated-draft",
        });
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
        if (error) {
          console.error("Supabase insert error:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            policy_type,
          });
          throw error;
        }
        return NextResponse.json({
          ok: true,
          id: data!.id,
          mode: "created-draft",
        });
      }
    }

    // status === "final"
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
    if (error) {
      console.error("Supabase insert error (final):", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        policy_type,
      });
      throw error;
    }

    await supabase
      .from("user_questionnaires")
      .delete()
      .eq("user_id", user_id)
      .eq("policy_type", policy_type)
      .eq("status", "draft");

    return NextResponse.json({
      ok: true,
      id: data!.id,
      mode: "created-final",
    });
  } catch (e: any) {
    console.error("Questionnaire API Error:", {
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
      error: e,
    });
    
    // Provide more detailed error message for constraint violations
    let errorMessage = e.message ?? "Unknown error";
    if (e.code === "23514" || e.message?.includes("check constraint")) {
      errorMessage = `Database constraint violation: ${e.message}. Please check that policy_type is one of: privacy_policy, ai_usage_policy, ai_governance_policy`;
    }
    
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 400 }
    );
  }
}

