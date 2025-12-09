/**
 * Centralized error handling and logging utilities
 */

import { NextResponse } from "next/server";

export type ErrorCode =
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMIT_EXCEEDED"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR"
  | "EXTERNAL_API_ERROR"
  | "INVALID_INPUT"
  | "SIZE_LIMIT_EXCEEDED";

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  statusCode: number;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  statusCode?: number
): NextResponse {
  const defaultStatusCodes: Record<ErrorCode, number> = {
    AUTHENTICATION_ERROR: 401,
    AUTHORIZATION_ERROR: 403,
    VALIDATION_ERROR: 400,
    NOT_FOUND: 404,
    RATE_LIMIT_EXCEEDED: 429,
    QUOTA_EXCEEDED: 429,
    INTERNAL_ERROR: 500,
    EXTERNAL_API_ERROR: 502,
    INVALID_INPUT: 400,
    SIZE_LIMIT_EXCEEDED: 413,
  };

  const status = statusCode || defaultStatusCodes[code];

  // Log error server-side (only in development or with explicit logging enabled)
  if (process.env.NODE_ENV === "development" || process.env.ENABLE_ERROR_LOGGING === "true") {
    console.error(`[Error] ${code}:`, {
      message,
      details: details ? JSON.stringify(details, null, 2) : undefined,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }

  // Don't expose internal details in production
  const responseBody: { error: string; message: string; details?: unknown } = {
    error: code,
    message,
  };

  // Only include details in development
  if (process.env.NODE_ENV === "development" && details) {
    responseBody.details = details;
  }

  return NextResponse.json(responseBody, { status });
}

/**
 * Handles unknown errors and converts them to standardized responses
 */
export function handleError(error: unknown, context?: string): NextResponse {
  // If it's already an AppError, use it directly
  if (error && typeof error === "object" && "code" in error && "statusCode" in error) {
    const appError = error as AppError;
    return createErrorResponse(
      appError.code,
      appError.message,
      appError.details,
      appError.statusCode
    );
  }

  // Handle known error types
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes("Unauthorized") || error.message.includes("authentication")) {
      return createErrorResponse("AUTHENTICATION_ERROR", "Authentication required");
    }

    if (error.message.includes("Forbidden") || error.message.includes("authorization")) {
      return createErrorResponse("AUTHORIZATION_ERROR", "Access denied");
    }

    if (error.message.includes("not found")) {
      return createErrorResponse("NOT_FOUND", error.message);
    }

    if (error.message.includes("validation") || error.message.includes("invalid")) {
      return createErrorResponse("VALIDATION_ERROR", error.message);
    }

    // Log unexpected errors with context
    if (process.env.NODE_ENV === "development" || process.env.ENABLE_ERROR_LOGGING === "true") {
      console.error(`[Unexpected Error]${context ? ` [${context}]` : ""}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    // Return generic error (don't expose stack trace in production)
    return createErrorResponse(
      "INTERNAL_ERROR",
      process.env.NODE_ENV === "development"
        ? error.message
        : "An internal error occurred. Please try again later.",
      process.env.NODE_ENV === "development" ? { stack: error.stack } : undefined
    );
  }

  // Unknown error type
  return createErrorResponse(
    "INTERNAL_ERROR",
    "An unexpected error occurred. Please try again later."
  );
}

/**
 * Sanitizes error messages to prevent information leakage
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove potential sensitive information patterns
  let sanitized = message;

  // Remove API keys (basic pattern matching)
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, "[REDACTED]");

  // Remove file paths (basic pattern)
  sanitized = sanitized.replace(/\/[^\s]+/g, "[PATH]");

  // Remove email addresses
  sanitized = sanitized.replace(/[^\s]+@[^\s]+\.[^\s]+/g, "[EMAIL]");

  return sanitized;
}

/**
 * Creates structured log entry for errors
 */
export function logError(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "development" || process.env.ENABLE_ERROR_LOGGING === "true") {
    const logEntry = {
      timestamp: new Date().toISOString(),
      code,
      message: sanitizeErrorMessage(message),
      ...(context && { context }),
    };

    console.error(JSON.stringify(logEntry, null, 2));
  }
}

