/**
 * Request parsing and validation helpers
 * Optimizes request body parsing to avoid reading twice
 */

import { NextResponse } from "next/server";
import { validateRequestBodySize } from "./validation";
import { createErrorResponse } from "./error-handler";

export interface ParsedRequestBody<T = unknown> {
  body: T;
  bodyText: string;
}

/**
 * Parses and validates request body in a single operation
 * Returns parsed body and original text, or error response
 */
export async function parseRequestBody<T = unknown>(
  req: Request,
  maxSizeBytes: number = 2 * 1024 * 1024 // 2MB default
): Promise<ParsedRequestBody<T> | NextResponse> {
  try {
    const bodyText = await req.text();
    
    // Validate size before parsing
    if (!validateRequestBodySize(bodyText, maxSizeBytes)) {
      return createErrorResponse(
        "SIZE_LIMIT_EXCEEDED",
        `Request body too large. Maximum size: ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
        undefined,
        413
      );
    }

    // Parse JSON
    try {
      const body = JSON.parse(bodyText) as T;
      return { body, bodyText };
    } catch (parseError) {
      return createErrorResponse(
        "INVALID_INPUT",
        "Invalid JSON in request body",
        process.env.NODE_ENV === "development" 
          ? { parseError: parseError instanceof Error ? parseError.message : String(parseError) }
          : undefined,
        400
      );
    }
  } catch (error) {
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Failed to read request body",
      process.env.NODE_ENV === "development" 
        ? { error: error instanceof Error ? error.message : String(error) }
        : undefined,
      500
    );
  }
}

