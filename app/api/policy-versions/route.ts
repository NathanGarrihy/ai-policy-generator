import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { comparePolicyVersions } from "@/lib/diff";

function srv() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const policyId = searchParams.get("policy_id");
  const versionId = searchParams.get("version_id");
  const compareWith = searchParams.get("compare_with");

  if (!policyId && !versionId) {
    return NextResponse.json(
      { error: "policy_id or version_id required" },
      { status: 400 }
    );
  }

  const supabase = srv();

  try {
    if (versionId && compareWith) {
      // Get specific version and compare with another
      const { data: version1, error: e1 } = await supabase
        .from("user_policies")
        .select("*")
        .eq("id", versionId)
        .single();

      const { data: version2, error: e2 } = await supabase
        .from("user_policies")
        .select("*")
        .eq("id", compareWith)
        .single();

      if (e1 || e2 || !version1 || !version2) {
        return NextResponse.json(
          { error: "Version not found" },
          { status: 404 }
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
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Version not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ version: data });
    } else {
      // List all versions for a policy
      const { data, error } = await supabase
        .from("user_policies")
        .select("*")
        .eq("policy_type", policyId)
        .order("version_number", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ versions: data || [] });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Unknown error" },
      { status: 500 }
    );
  }
}

