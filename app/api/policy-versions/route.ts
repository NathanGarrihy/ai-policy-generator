import { NextResponse } from "next/server";
import { authenticateRequest, createAuthenticatedClient, verifyResourceOwnership } from "@/lib/auth-middleware";
import { comparePolicyVersions } from "@/lib/diff";
import { PolicyIdSchema, VersionIdSchema, PolicyTypeSchema } from "@/lib/validation";
import { createErrorResponse, handleError } from "@/lib/error-handler";

export async function GET(req: Request) {
  // Authenticate request
  const authResult = await authenticateRequest();
  if (!authResult.authenticated) {
    return authResult.response;
  }
  const { userId } = authResult;

  const { searchParams } = new URL(req.url);
  const policyId = searchParams.get("policy_id");
  const versionId = searchParams.get("version_id");
  const compareWith = searchParams.get("compare_with");

  if (!policyId && !versionId) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "policy_id or version_id required"
    );
  }

  // Validate UUIDs if provided
  if (versionId) {
    const versionIdResult = VersionIdSchema.safeParse(versionId);
    if (!versionIdResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid version_id format",
        versionIdResult.error.errors
      );
    }
  }

  if (compareWith) {
    const compareWithResult = VersionIdSchema.safeParse(compareWith);
    if (!compareWithResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid compare_with format",
        compareWithResult.error.errors
      );
    }
  }

  if (policyId && !versionId) {
    // Validate policy_type if using policy_id as policy_type
    const policyTypeResult = PolicyTypeSchema.safeParse(policyId);
    if (!policyTypeResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid policy_id/policy_type format",
        policyTypeResult.error.errors
      );
    }
  }

  // Use authenticated Supabase client
  const supabase = createAuthenticatedClient();

  try {
    if (versionId && compareWith) {
      // Get specific version and compare with another
      // Verify both versions belong to the authenticated user
      const { data: version1, error: e1 } = await supabase
        .from("user_policies")
        .select("*")
        .eq("id", versionId)
        .eq("user_id", userId) // Filter by authenticated user_id
        .single();

      const { data: version2, error: e2 } = await supabase
        .from("user_policies")
        .select("*")
        .eq("id", compareWith)
        .eq("user_id", userId) // Filter by authenticated user_id
        .single();

      if (e1 || e2 || !version1 || !version2) {
        return createErrorResponse(
          "NOT_FOUND",
          "Version not found"
        );
      }

      // Additional ownership verification (defense in depth)
      if (!verifyResourceOwnership(version1.user_id, userId) || 
          !verifyResourceOwnership(version2.user_id, userId)) {
        return createErrorResponse(
          "AUTHORIZATION_ERROR",
          "Cannot compare versions belonging to another user"
        );
      }

      const diff = comparePolicyVersions(version2.content, version1.content);

      // Calculate coverage delta
      const coverageDelta = {
        gdpr:
          (version1.framework_coverage?.gdpr_coverage || 0) -
          (version2.framework_coverage?.gdpr_coverage || 0),
        ai_act:
          (version1.framework_coverage?.ai_act_coverage || 0) -
          (version2.framework_coverage?.ai_act_coverage || 0),
        iso_42001:
          (version1.framework_coverage?.iso_42001_coverage || 0) -
          (version2.framework_coverage?.iso_42001_coverage || 0),
      };

      return NextResponse.json({
        version1,
        version2,
        diff,
        coverageDelta,
      });
    } else if (versionId) {
      // Get specific version
      const { data, error } = await supabase
        .from("user_policies")
        .select("*")
        .eq("id", versionId)
        .eq("user_id", userId) // Filter by authenticated user_id
        .single();

      if (error || !data) {
        return createErrorResponse(
          "NOT_FOUND",
          "Version not found"
        );
      }

      // Additional ownership verification
      if (!verifyResourceOwnership(data.user_id, userId)) {
        return createErrorResponse(
          "AUTHORIZATION_ERROR",
          "Cannot access version belonging to another user"
        );
      }

      return NextResponse.json({ version: data });
    } else {
      // List all versions for a policy type (filtered by user_id)
      const { data, error } = await supabase
        .from("user_policies")
        .select("*")
        .eq("policy_type", policyId)
        .eq("user_id", userId) // Only get versions for this user
        .order("version_number", { ascending: false });

      if (error) {
        return createErrorResponse(
          "INTERNAL_ERROR",
          "Failed to retrieve policy versions",
          process.env.NODE_ENV === "development" ? { error: error.message } : undefined
        );
      }

      return NextResponse.json({ versions: data || [] });
    }
  } catch (error) {
    return handleError(error, "policy-versions");
  }
}

