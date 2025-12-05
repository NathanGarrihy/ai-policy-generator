import { NextResponse } from "next/server";
import {
  parsePolicyOutput,
  replaceDatePlaceholders,
  replaceContactPlaceholders,
  removeContactInfoFromMappingAppendix,
} from "@/lib/parser";
import { buildPromptForModel, buildPrompt } from "@/lib/prompts";
import {
  analyzePolicyCompliance,
  validatePolicyQuality,
  getPolicyThresholds,
  buildApplicabilityContext,
  type PolicyType,
  type PolicyCopResult,
} from "@/lib/policycop";
import {
  PrivacyQuestionnaireSchema,
  AIUsageQuestionnaireSchema,
  AIGovernanceQuestionnaireSchema,
} from "@/lib/types";
import {
  QUALITY_THRESHOLDS,
  COVERAGE_MARGINS,
  TOKEN_LIMITS,
  GENERATION_CONFIG,
} from "@/lib/constants";
import { rateLimitMiddleware, logRateLimitViolation } from "@/lib/rate-limit";

type QualityTier = "standard" | "premium";

type ModelInfo = {
  id: string;
  temperature: number;
  maxTokens?: number;
};

const MODEL_CONFIG: Record<QualityTier, ModelInfo[]> = {
  standard: [
    {
      // Cheap, capable default model for standard mode
      id: process.env.OPENAI_STANDARD_MODEL ?? "gpt-3.5-turbo",
      temperature: 0.3,
      maxTokens: TOKEN_LIMITS.MAX_TOKENS,
    },
    {
      // Second attempt still uses the same cheaper model
      id: process.env.OPENAI_STANDARD_MODEL ?? "gpt-3.5-turbo",
      temperature: 0.3,
      maxTokens: TOKEN_LIMITS.MAX_TOKENS,
    },
  ],
  premium: [
    {
      // First attempt: cheaper model
      id: process.env.OPENAI_PREMIUM_BASE_MODEL ?? "gpt-3.5-turbo",
      temperature: 0.3,
      maxTokens: TOKEN_LIMITS.MAX_TOKENS,
    },
    {
      // Fallback attempt: single GPT-4-class model (cheaper variant by default)
      id: process.env.OPENAI_PREMIUM_FALLBACK_MODEL ?? "gpt-4o",
      temperature: 0.2,
      maxTokens: TOKEN_LIMITS.MAX_TOKENS,
    },
  ],
};

type GenerationAttempt = {
  attemptNumber: number;
  model: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  qualityScore?: number;
  policyCopResult?: PolicyCopResult;
  success: boolean;
  error?: string;
  feedback?: string[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCostUsd?: number;
};

type GenerationResult = {
  rawContent: string;
  parsed: ReturnType<typeof parsePolicyOutput>;
  qualityScore: number;
  policyCopResult: PolicyCopResult;
  attempts: GenerationAttempt[];
};

function estimateOpenAICostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Very rough defaults; override via env vars if needed.
  const promptPer1K =
    Number(process.env.OPENAI_COST_PROMPT_PER_1K ?? "") ||
    (model.includes("gpt-4") ? 0.01 : 0.0015);
  const completionPer1K =
    Number(process.env.OPENAI_COST_COMPLETION_PER_1K ?? "") ||
    (model.includes("gpt-4") ? 0.03 : 0.002);

  const promptCost = (promptTokens / 1000) * promptPer1K;
  const completionCost = (completionTokens / 1000) * completionPer1K;
  return Number((promptCost + completionCost).toFixed(6));
}

/**
 * Generate policy with validation and retry logic
 * Attempts 1-2: Use GPT-3.5-turbo with enhanced prompts
 * Attempt 3: Fallback to GPT-4 if quality score < 0.8 or coverage below thresholds
 * Each retry includes feedback from previous attempt
 */
async function generatePolicyWithValidation(
  apiKey: string,
  questionnaireData: Record<string, any>,
  policyType: PolicyType,
  promptPolicyType: string,
  qualityTier: QualityTier
): Promise<GenerationResult> {
  const attempts: GenerationAttempt[] = [];
  // Quality/cost tier configuration
  const maxAttempts = GENERATION_CONFIG.MAX_ATTEMPTS;
  const qualityThreshold = qualityTier === "premium" 
    ? QUALITY_THRESHOLDS.PREMIUM 
    : QUALITY_THRESHOLDS.STANDARD;
  let lastFeedback: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStartTime = Date.now();
    const isLastAttempt = attempt === maxAttempts;
    
    // Determine model from central MODEL_CONFIG based on tier and attempt number
    const tierModels = MODEL_CONFIG[qualityTier];
    const attemptIndex = Math.min(attempt - 1, tierModels.length - 1);
    const { id: modelName, temperature, maxTokens } = tierModels[attemptIndex];
    
    const attemptLog: GenerationAttempt = {
      attemptNumber: attempt,
      model: modelName,
      startTime: attemptStartTime,
      success: false,
    };

    try {
      // Build prompts with feedback from previous attempt
      let systemPrompt = buildPromptForModel(modelName, promptPolicyType, {
        responses: questionnaireData,
      });
      
      let userMessage = buildPrompt(promptPolicyType, questionnaireData);
      
      // Add feedback from previous attempt
      if (lastFeedback.length > 0) {
        const feedbackText = `\n\n## Previous Attempt Feedback:\n\nPrevious attempt had insufficient coverage or quality issues:\n${lastFeedback.map(f => `- ${f}`).join("\n")}\n\nPlease address these issues in your response.`;
        userMessage = userMessage + feedbackText;
      }

      // Log attempt start
      console.log(`[Policy Generation] Attempt ${attempt}/${maxAttempts} using ${modelName}`);

      // Call OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature,
          ...(maxTokens && { max_tokens: maxTokens }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: { message: "Unknown OpenAI API error" },
        }));
        const errorMessage = `OpenAI API error: ${
          errorData.error?.message || `HTTP ${response.status}`
        }`;
        attemptLog.error = errorMessage;
        attemptLog.endTime = Date.now();
        attemptLog.duration = attemptLog.endTime - attemptLog.startTime;
        attempts.push(attemptLog);
        
        // If last attempt failed, throw error
        if (isLastAttempt) {
          throw new Error(errorMessage);
        }
        continue; // Retry with next attempt
      }

      const data = await response.json();

      if (
        !data.choices ||
        !Array.isArray(data.choices) ||
        data.choices.length === 0
      ) {
        const errorMessage = "Invalid response format from OpenAI API";
        attemptLog.error = errorMessage;
        attemptLog.endTime = Date.now();
        attemptLog.duration = attemptLog.endTime - attemptLog.startTime;
        attempts.push(attemptLog);
        
        if (isLastAttempt) {
          throw new Error(errorMessage);
        }
        continue;
      }

      const rawContent = data.choices[0]?.message?.content;
      if (!rawContent) {
        const errorMessage = "No content generated by OpenAI API";
        attemptLog.error = errorMessage;
        attemptLog.endTime = Date.now();
        attemptLog.duration = attemptLog.endTime - attemptLog.startTime;
        attempts.push(attemptLog);
        
        if (isLastAttempt) {
          throw new Error(errorMessage);
        }
        continue;
      }

      // Parse and validate the output
      const parsed = parsePolicyOutput(rawContent);
      
      // Build applicability context from questionnaire data
      const applicabilityContext = buildApplicabilityContext(questionnaireData, policyType);
      
      // Run PolicyCop analysis
      const policyCopResult = analyzePolicyCompliance(
        parsed.content || rawContent,
        policyType,
        {
          frameworks_selected: parsed.metadata?.frameworks_selected,
          applicabilityContext,
        }
      );

      // Calculate quality score
      const qualityValidation = validatePolicyQuality(
        parsed.content || rawContent,
        policyType,
        {
          frameworks_selected: parsed.metadata?.frameworks_selected,
          applicabilityContext,
        }
      );

      // Track token usage and estimate cost for this attempt
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens =
        data.usage?.total_tokens ?? promptTokens + completionTokens;
      const estimatedCost = estimateOpenAICostUsd(
        modelName,
        promptTokens,
        completionTokens
      );

      const qualityScore = qualityValidation.qualityScore;
      attemptLog.qualityScore = qualityScore;
      attemptLog.policyCopResult = policyCopResult;
      attemptLog.tokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens,
      };
      attemptLog.estimatedCostUsd = estimatedCost;
      attemptLog.endTime = Date.now();
      attemptLog.duration = attemptLog.endTime - attemptLog.startTime;

      // Log attempt results
      console.log(`[Policy Generation] Attempt ${attempt} completed:`, {
        model: modelName,
        qualityScore: qualityScore.toFixed(3),
        gdprCoverage: (policyCopResult.gdpr_coverage * 100).toFixed(1) + "%",
        aiActCoverage: (policyCopResult.ai_act_coverage * 100).toFixed(1) + "%",
        iso42001Coverage: (policyCopResult.iso_42001_coverage * 100).toFixed(1) + "%",
        duration: `${attemptLog.duration}ms`,
        retryCount: attempt - 1,
        tokenUsage: attemptLog.tokenUsage,
        estimatedCostUsd: attemptLog.estimatedCostUsd,
      });

      // Check if quality is acceptable
      const meetsQualityThreshold = qualityScore >= qualityThreshold;

      
      // Compute coverage thresholds directly from PolicyCop result, with a small margin
      const thresholds = getPolicyThresholds(policyType, applicabilityContext);
      const margin = qualityTier === "premium" 
        ? COVERAGE_MARGINS.PREMIUM 
        : COVERAGE_MARGINS.STANDARD;
      const adjustedThresholds = {
        gdpr: thresholds.gdpr * (1 - margin),
        ai_act: thresholds.ai_act * (1 - margin),
        iso_42001: thresholds.iso_42001 * (1 - margin),
      };

      const meetsCoverageThresholds =
        policyCopResult.gdpr_coverage >= adjustedThresholds.gdpr &&
        policyCopResult.ai_act_coverage >= adjustedThresholds.ai_act &&
        policyCopResult.iso_42001_coverage >= adjustedThresholds.iso_42001;

      const hasValidStructure =
        qualityValidation.qualityChecks.structuredFormat &&
        qualityValidation.qualityChecks.metajsonValid;

      if (meetsQualityThreshold && meetsCoverageThresholds && hasValidStructure) {
        // Success! Return the result
        attemptLog.success = true;
        attempts.push(attemptLog);
        
        console.log(`[Policy Generation] Success on attempt ${attempt} with ${modelName}`);
        
        return {
          rawContent,
          parsed,
          qualityScore,
          policyCopResult,
          attempts,
        };
      } else {
        // Quality or coverage insufficient - prepare feedback for retry
        attemptLog.success = false;
        lastFeedback = [
          ...qualityValidation.issues,
          ...qualityValidation.actionableFeedback,
        ].slice(0, GENERATION_CONFIG.MAX_FEEDBACK_ITEMS);
        
        // Add specific missing clauses if available
        if (policyCopResult.missing_clauses.length > 0) {
          const missingClauses = policyCopResult.missing_clauses
            .slice(0, GENERATION_CONFIG.MAX_MISSING_CLAUSES)
            .map(
              (c) =>
                `Missing ${c.framework} ${c.article_ref}: ${c.clause_text.substring(0, 100)}`
            );
          lastFeedback.push(...missingClauses);
        }
        
        attempts.push(attemptLog);
        
        // If this was the last attempt, return anyway (fallback to GPT-4 should have been used)
        if (isLastAttempt) {
          console.log(
            `[Policy Generation] Last attempt completed but quality below threshold. Returning result anyway.`
          );
          return {
            rawContent,
            parsed,
            qualityScore,
            policyCopResult,
            attempts,
          };
        }
        
        // Continue to next attempt
        console.log(`[Policy Generation] Attempt ${attempt} quality insufficient (score: ${qualityScore.toFixed(3)}), retrying...`);
      }
    } catch (error: any) {
      attemptLog.error = error.message || String(error);
      attemptLog.endTime = Date.now();
      attemptLog.duration = attemptLog.endTime - attemptLog.startTime;
      attempts.push(attemptLog);
      
      // If last attempt, throw error
      if (isLastAttempt) {
        throw error;
      }
      
      // Otherwise, continue to next attempt
      console.error(`[Policy Generation] Attempt ${attempt} failed:`, error);
    }
  }

  // Should never reach here, but TypeScript requires it
  throw new Error("All generation attempts failed");
}

export async function POST(req: Request) {
  const requestStartTime = Date.now();
  
  try {
    // Extract quality tier for rate limiting (before parsing body)
    const url = new URL(req.url);
    const qualityTierParam = url.searchParams.get("qualityTier") || "standard";
    const tier = qualityTierParam === "premium" ? "premium" : "standard";
    
    // Apply rate limiting
    const rateLimitResponse = rateLimitMiddleware(req, tier);
    if (rateLimitResponse) {
      // Get identifier for logging
      const forwarded = req.headers.get("x-forwarded-for");
      const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
      logRateLimitViolation(ip !== "unknown" ? ip : "anonymous", tier, "/api/generate-policy");
      return rateLimitResponse;
    }
    
    const body = await req.json();
    const { questionnaireData, policyType, model, qualityTier, mode } = body;

    if (!questionnaireData || !policyType) {
      return NextResponse.json(
        { error: "questionnaireData and policyType are required" },
        { status: 400 }
      );
    }

    // Validate questionnaire data based on policy type
    let validatedQuestionnaireData: Record<string, any>;
    try {
      if (policyType === "privacy_policy") {
        validatedQuestionnaireData = PrivacyQuestionnaireSchema.parse(questionnaireData);
      } else if (policyType === "ai_usage_policy") {
        validatedQuestionnaireData = AIUsageQuestionnaireSchema.parse(questionnaireData);
      } else if (policyType === "ai_governance_policy") {
        validatedQuestionnaireData = AIGovernanceQuestionnaireSchema.parse(questionnaireData);
      } else {
        return NextResponse.json(
          { error: `Invalid policy type: ${policyType}` },
          { status: 400 }
        );
      }
    } catch (validationError: any) {
      if (validationError.errors) {
        // Zod validation error
        return NextResponse.json(
          {
            error: "Validation failed",
            details: validationError.errors.map((err: any) => ({
              path: err.path.join("."),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid questionnaire data format" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Map policy type from database format to prompt format
    const promptPolicyType = policyType === "privacy_policy" 
      ? "privacy-policy" 
      : policyType === "ai_usage_policy"
      ? "ai-usage-policy"
      : policyType === "ai_governance_policy"
      ? "ai-governance-policy"
      : policyType;

    // Normalize quality tier (default to standard). Support both `qualityTier` and legacy `mode`.
    const requestedTier = (qualityTier ?? mode) as string | undefined;
    const normalizedTier: QualityTier =
      requestedTier === "premium" ? "premium" : "standard";

    // Generate policy with validation and retry logic
    const generationResult = await generatePolicyWithValidation(
      apiKey,
      validatedQuestionnaireData,
      policyType as PolicyType,
      promptPolicyType,
      normalizedTier
    );

    // Replace date placeholders and outdated dates with current date
    let contentWithDates = replaceDatePlaceholders(generationResult.parsed.content);

    // Replace contact and procedure placeholders with questionnaire data if provided
    if (validatedQuestionnaireData && policyType) {
      contentWithDates = replaceContactPlaceholders(
        contentWithDates,
        validatedQuestionnaireData,
        policyType as
          | "privacy_policy"
          | "ai_usage_policy"
          | "ai_governance_policy"
      );
    }

    // Remove Contact Information from Mapping Appendix (it shouldn't be there)
    contentWithDates = removeContactInfoFromMappingAppendix(contentWithDates);

    // Calculate total generation time
    const totalDuration = Date.now() - requestStartTime;
    const successfulAttempt =
      generationResult.attempts.find((a) => a.success) ||
      generationResult.attempts[generationResult.attempts.length - 1];

    const totalEstimatedCostUsd = generationResult.attempts.reduce(
      (sum, a) => sum + (a.estimatedCostUsd ?? 0),
      0
    );

    // Log final generation summary
    console.log(`[Policy Generation] Completed:`, {
      policyType,
      finalModel: successfulAttempt.model,
      qualityScore: generationResult.qualityScore.toFixed(3),
      gdprCoverage:
        (generationResult.policyCopResult.gdpr_coverage * 100).toFixed(1) + "%",
      aiActCoverage:
        (generationResult.policyCopResult.ai_act_coverage * 100).toFixed(1) +
        "%",
      iso42001Coverage:
        (generationResult.policyCopResult.iso_42001_coverage * 100).toFixed(1) +
        "%",
      totalDuration: `${totalDuration}ms`,
      retryCount: generationResult.attempts.length - 1,
      totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
      attempts: generationResult.attempts.map((a) => ({
        attempt: a.attemptNumber,
        model: a.model,
        success: a.success,
        qualityScore: a.qualityScore?.toFixed(3),
        duration: a.duration ? `${a.duration}ms` : undefined,
        estimatedCostUsd: a.estimatedCostUsd,
        tokenUsage: a.tokenUsage,
      })),
    });

    return NextResponse.json({
      content: contentWithDates,
      metadata: generationResult.parsed.metadata,
      hasStructure: generationResult.parsed.hasStructure,
      // Include generation metadata for debugging/monitoring
      generationMetadata: {
        qualityScore: generationResult.qualityScore,
        policyCopResult: {
          gdpr_coverage: generationResult.policyCopResult.gdpr_coverage,
          ai_act_coverage: generationResult.policyCopResult.ai_act_coverage,
          iso_42001_coverage: generationResult.policyCopResult.iso_42001_coverage,
        },
        attempts: generationResult.attempts.map(a => ({
          attemptNumber: a.attemptNumber,
          model: a.model,
          success: a.success,
          qualityScore: a.qualityScore,
          duration: a.duration,
        })),
        totalDuration,
      },
    });
  } catch (e: any) {
    const totalDuration = Date.now() - requestStartTime;
    console.error(`[Policy Generation] Failed after ${totalDuration}ms:`, e);
    
    return NextResponse.json(
      { 
        error: e.message ?? "Failed to generate policy",
        // Include error details for debugging
        errorDetails: {
          message: e.message,
          duration: totalDuration,
        },
      },
      { status: 500 }
    );
  }
}
