/**
 * Input validation and sanitization utilities
 */

import { z } from "zod";

/**
 * Validates UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validates and sanitizes string input
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== "string") {
    return "";
  }
  return input.trim().slice(0, maxLength);
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates request body size
 * Returns true if size is acceptable, false otherwise
 */
export function validateRequestBodySize(body: string, maxSizeBytes: number = 1024 * 1024): boolean {
  const sizeBytes = new TextEncoder().encode(body).length;
  return sizeBytes <= maxSizeBytes;
}

/**
 * Schema for policy_id validation
 */
export const PolicyIdSchema = z.string().uuid("Invalid policy ID format");

/**
 * Schema for version_id validation
 */
export const VersionIdSchema = z.string().uuid("Invalid version ID format");

/**
 * Schema for questionnaire_id validation
 */
export const QuestionnaireIdSchema = z.string().uuid("Invalid questionnaire ID format");

/**
 * Schema for export format validation
 */
export const ExportFormatSchema = z.enum(["pdf", "docx"], {
  errorMap: () => ({ message: "Format must be 'pdf' or 'docx'" }),
});

/**
 * Schema for policy type validation
 */
export const PolicyTypeSchema = z.enum(["privacy_policy", "ai_usage_policy", "ai_governance_policy"], {
  errorMap: () => ({ message: "Invalid policy type" }),
});

/**
 * Schema for questionnaire status validation
 */
export const QuestionnaireStatusSchema = z.enum(["draft", "final"], {
  errorMap: () => ({ message: "Status must be 'draft' or 'final'" }),
});

/**
 * Schema for quality tier validation
 */
export const QualityTierSchema = z.enum(["standard", "premium"], {
  errorMap: () => ({ message: "Quality tier must be 'standard' or 'premium'" }),
});

/**
 * Validates and sanitizes company name
 */
export function sanitizeCompanyName(name: string): string {
  return sanitizeString(name, 200);
}

/**
 * Validates and sanitizes email address
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email, 255);
  if (!isValidEmail(sanitized)) {
    throw new Error("Invalid email format");
  }
  return sanitized.toLowerCase();
}

