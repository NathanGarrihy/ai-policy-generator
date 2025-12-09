import { NextResponse } from "next/server";
import { authenticateRequest, createAuthenticatedClient, verifyResourceOwnership } from "@/lib/auth-middleware";
import { generatePDF, generateDOCX } from "@/lib/export";
import { PolicyIdSchema, ExportFormatSchema } from "@/lib/validation";
import { parseRequestBody } from "@/lib/request-helpers";
import { createErrorResponse, handleError } from "@/lib/error-handler";

interface ExportRequestBody {
  policy_id: string;
  format: "pdf" | "docx";
}

export async function POST(req: Request) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest();
    if (!authResult.authenticated) {
      return authResult.response;
    }
    const { userId } = authResult;

    // Parse and validate request body (optimized - single read)
    const parseResult = await parseRequestBody<ExportRequestBody>(req, 1024 * 1024); // 1MB max
    if (parseResult instanceof NextResponse) {
      return parseResult; // Error response
    }
    const { body } = parseResult;
    const { policy_id, format } = body;

    // Validate policy_id format
    const policyIdResult = PolicyIdSchema.safeParse(policy_id);
    if (!policyIdResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid policy_id format",
        policyIdResult.error.errors
      );
    }

    // Validate format
    const formatResult = ExportFormatSchema.safeParse(format);
    if (!formatResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid format. Must be 'pdf' or 'docx'",
        formatResult.error.errors
      );
    }

    // Use authenticated Supabase client
    const supabase = createAuthenticatedClient();

    // Get policy and verify ownership
    const { data: policy, error: policyError } = await supabase
      .from("user_policies")
      .select("*")
      .eq("id", policy_id)
      .eq("user_id", userId) // Filter by authenticated user_id
      .single();

    if (policyError || !policy) {
      // Don't reveal if policy exists but belongs to another user
      return createErrorResponse(
        "NOT_FOUND",
        "Policy not found"
      );
    }

    // Additional ownership verification (defense in depth)
    if (!verifyResourceOwnership(policy.user_id, userId)) {
      return createErrorResponse(
        "AUTHORIZATION_ERROR",
        "Cannot export policy belonging to another user"
      );
    }

    // Get questionnaire for company name (verify ownership)
    const { data: questionnaire } = await supabase
      .from("user_questionnaires")
      .select("answers, user_id")
      .eq("id", policy.source_questionnaire_id)
      .eq("user_id", userId) // Ensure questionnaire belongs to user
      .single();
    
    if (!questionnaire || !verifyResourceOwnership(questionnaire.user_id, userId)) {
      return createErrorResponse(
        "NOT_FOUND",
        "Questionnaire not found or unauthorized"
      );
    }

    // Extract company name from questionnaire answers
    const answers = questionnaire?.answers as Record<string, unknown> | undefined;
    const companyName = (answers?.company_name as string | undefined) || "Company";

    // Get mappings (no error handling needed - empty array is acceptable)
    const { data: mappings, error: mappingsError } = await supabase
      .from("policy_mappings")
      .select("*")
      .eq("policy_version_id", policy_id);
    
    if (mappingsError && process.env.NODE_ENV === "development") {
      console.warn("[Export Policy] Error fetching mappings:", mappingsError);
    }

    // Get version history with framework_coverage (filtered by user_id)
    // Note: Consider adding database index on (user_id, policy_type, version_number) for optimal performance
    const { data: versions, error: versionsError } = await supabase
      .from("user_policies")
      .select("version_number, created_at, framework_coverage")
      .eq("policy_type", policy.policy_type)
      .eq("user_id", userId) // Only get versions for this user
      .order("version_number", { ascending: false })
      .limit(10);
    
    if (versionsError) {
      return createErrorResponse(
        "INTERNAL_ERROR",
        "Failed to retrieve version history",
        process.env.NODE_ENV === "development" ? { error: versionsError.message } : undefined
      );
    }

    // Build version history with coverage and calculate deltas
    const versionHistory =
      versions?.map((v, index) => {
        const coverage = v.framework_coverage as {
          gdpr_coverage?: number;
          ai_act_coverage?: number;
          iso_42001_coverage?: number;
        } | null;

        // Calculate coverage delta from previous version
        let coverageDelta:
          | {
              gdpr?: number;
              ai_act?: number;
              iso_42001?: number;
            }
          | undefined;

        if (index < versions.length - 1) {
          const prevVersion = versions[index + 1];
          const prevCoverage = prevVersion.framework_coverage as {
            gdpr_coverage?: number;
            ai_act_coverage?: number;
            iso_42001_coverage?: number;
          } | null;

          coverageDelta = {
            gdpr:
              (coverage?.gdpr_coverage || 0) -
              (prevCoverage?.gdpr_coverage || 0),
            ai_act:
              (coverage?.ai_act_coverage || 0) -
              (prevCoverage?.ai_act_coverage || 0),
            iso_42001:
              (coverage?.iso_42001_coverage || 0) -
              (prevCoverage?.iso_42001_coverage || 0),
          };
        }

        return {
          version: v.version_number,
          date: new Date(v.created_at).toLocaleDateString(),
          changes: "Policy update",
          coverage: {
            gdpr: coverage?.gdpr_coverage,
            ai_act: coverage?.ai_act_coverage,
            iso_42001: coverage?.iso_42001_coverage,
          },
          coverageDelta,
        };
      }) || [];

    const mappingData =
      mappings?.map((m) => ({
        section_id: m.section_id,
        framework: m.framework,
        article_ref: m.article_ref,
        confidence: m.confidence || 1.0,
      })) || [];

    // Generate file
    let fileBuffer: Buffer | Uint8Array;
    let mimeType: string;
    let filename: string;

    if (format === "pdf") {
      fileBuffer = await generatePDF(
        policy.content,
        companyName,
        mappingData,
        versionHistory,
        policy.policy_type
      );
      mimeType = "application/pdf";
      filename = `${policy.policy_type}_v${policy.version_number}.pdf`;
    } else {
      fileBuffer = await generateDOCX(
        policy.content,
        companyName,
        mappingData,
        versionHistory,
        policy.policy_type
      );
      mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      filename = `${policy.policy_type}_v${policy.version_number}.docx`;
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleError(error, "export-policy");
  }
}

