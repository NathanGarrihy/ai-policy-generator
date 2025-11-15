import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePDF, generateDOCX } from "@/lib/export";

function srv() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const { policy_id, format } = await req.json();

    if (!policy_id || !format || !["pdf", "docx"].includes(format)) {
      return NextResponse.json(
        { error: "policy_id and format (pdf|docx) required" },
        { status: 400 }
      );
    }

    const supabase = srv();

    // Get policy
    const { data: policy, error: policyError } = await supabase
      .from("user_policies")
      .select("*")
      .eq("id", policy_id)
      .single();

    if (policyError || !policy) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    // Get questionnaire for company name
    const { data: questionnaire } = await supabase
      .from("user_questionnaires")
      .select("answers")
      .eq("id", policy.source_questionnaire_id)
      .single();

    const companyName =
      (questionnaire?.answers as any)?.company_name || "Company";

    // Get mappings
    const { data: mappings } = await supabase
      .from("policy_mappings")
      .select("*")
      .eq("policy_version_id", policy_id);

    // Get version history with framework_coverage
    const { data: versions } = await supabase
      .from("user_policies")
      .select("version_number, created_at, framework_coverage")
      .eq("policy_type", policy.policy_type)
      .order("version_number", { ascending: false })
      .limit(10);

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
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Export failed" },
      { status: 500 }
    );
  }
}

