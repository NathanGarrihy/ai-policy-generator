import { NextResponse } from "next/server";
import { authenticateRequest, createAuthenticatedClient, verifyResourceOwnership } from "@/lib/auth-middleware";
import { PolicyTypeSchema, QuestionnaireStatusSchema } from "@/lib/validation";
import { parseRequestBody } from "@/lib/request-helpers";
import { createErrorResponse, handleError } from "@/lib/error-handler";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/questionnaire (app router)",
  });
}

export async function POST(req: Request) {
  try {
    // Authenticate request - derive user_id from session
    const authResult = await authenticateRequest();
    if (!authResult.authenticated) {
      return authResult.response;
    }
    const { userId } = authResult;

    // Parse and validate request body (optimized - single read)
    interface QuestionnaireRequestBody {
      policy_type?: string;
      status?: string;
      answers?: Record<string, unknown>;
    }
    
    const parseResult = await parseRequestBody<QuestionnaireRequestBody>(req, 2 * 1024 * 1024); // 2MB max
    if (parseResult instanceof NextResponse) {
      return parseResult; // Error response
    }
    const { body } = parseResult;
    const { policy_type, status, answers } = body || {};

    // Validate policy_type
    const policyTypeResult = PolicyTypeSchema.safeParse(policy_type);
    if (!policyTypeResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid policy_type",
        policyTypeResult.error.errors
      );
    }

    // Validate status
    const statusResult = QuestionnaireStatusSchema.safeParse(status);
    if (!statusResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid status. Must be 'draft' or 'final'",
        statusResult.error.errors
      );
    }

    // Use authenticated Supabase client (not service role)
    const supabase = createAuthenticatedClient();
    
    // Log for debugging (without sensitive data)
    if (process.env.NODE_ENV === "development") {
      console.log("Questionnaire API - Received:", { 
        userId, 
        policy_type, 
        status, 
        hasAnswers: !!answers 
      });
    }

    if (status === "draft") {
      // Check for existing draft
      const { data: existing, error: selErr } = await supabase
        .from("user_questionnaires")
        .select("id, user_id")
        .eq("user_id", userId)
        .eq("policy_type", policy_type)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (selErr) {
        console.error("Supabase select error:", selErr);
        throw selErr;
      }

      if (existing) {
        // Verify ownership before update
        if (!verifyResourceOwnership(existing.user_id, userId)) {
          return createErrorResponse(
            "AUTHORIZATION_ERROR",
            "Cannot update questionnaire belonging to another user"
          );
        }

        const { error } = await supabase
          .from("user_questionnaires")
          .update({ answers })
          .eq("id", existing.id)
          .eq("user_id", userId); // Additional safety check
        
        if (error) {
          console.error("Supabase update error:", error);
          throw error;
        }
        
        return NextResponse.json({
          ok: true,
          id: existing.id,
          mode: "updated-draft",
        });
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from("user_questionnaires")
          .insert({
            user_id: userId, // Use authenticated user_id, not from request body
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
        user_id: userId, // Use authenticated user_id, not from request body
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

    // Delete draft questionnaires for this user and policy type
    await supabase
      .from("user_questionnaires")
      .delete()
      .eq("user_id", userId)
      .eq("policy_type", policy_type)
      .eq("status", "draft");

    return NextResponse.json({
      ok: true,
      id: data!.id,
      mode: "created-final",
    });
  } catch (error) {
    // Handle database constraint violations specifically
    if (error && typeof error === "object" && "code" in error) {
      const dbError = error as { code?: string; message?: string };
      if (dbError.code === "23514" || dbError.message?.includes("check constraint")) {
        return createErrorResponse(
          "VALIDATION_ERROR",
          `Database constraint violation. Please check that policy_type is one of: privacy_policy, ai_usage_policy, ai_governance_policy`,
          process.env.NODE_ENV === "development" ? { originalMessage: dbError.message } : undefined
        );
      }
    }
    
    return handleError(error, "questionnaire");
  }
}

