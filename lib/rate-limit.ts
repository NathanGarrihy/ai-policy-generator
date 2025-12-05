/**
 * Rate limiting middleware for API endpoints
 * Supports tier-based limits (standard vs premium)
 */

import { NextResponse } from "next/server";
import { RATE_LIMITS } from "./constants";

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

// In-memory store for rate limiting
// In production, consider using Redis or similar distributed cache
const rateLimitStore: RateLimitStore = new Map();

/**
 * Clean up expired entries from rate limit store
 * Runs periodically to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * Get rate limit configuration from environment variables
 * Falls back to constants if not configured
 */
function getRateLimitConfig(tier: "standard" | "premium") {
  const envKey = tier === "premium" 
    ? "RATE_LIMIT_PREMIUM_REQUESTS" 
    : "RATE_LIMIT_STANDARD_REQUESTS";
  const envWindow = "RATE_LIMIT_WINDOW_SECONDS";
  
  const requests = process.env[envKey] 
    ? parseInt(process.env[envKey]!, 10) 
    : (tier === "premium" ? RATE_LIMITS.PREMIUM_REQUESTS : RATE_LIMITS.STANDARD_REQUESTS);
  
  const windowSeconds = process.env[envWindow]
    ? parseInt(process.env[envWindow]!, 10)
    : RATE_LIMITS.WINDOW_SECONDS;
  
  return { requests, windowSeconds };
}

/**
 * Generate a rate limit key from request identifier
 * Uses IP address or user ID if available
 */
function getRateLimitKey(identifier: string, tier: "standard" | "premium"): string {
  return `rate_limit:${tier}:${identifier}`;
}

/**
 * Check if request should be rate limited
 * Returns null if allowed, or rate limit info if blocked
 */
export function checkRateLimit(
  identifier: string,
  tier: "standard" | "premium" = "standard"
): { allowed: boolean; remaining: number; resetAt: number } | null {
  const config = getRateLimitConfig(tier);
  const key = getRateLimitKey(identifier, tier);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    // No entry or expired - create new window
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt,
    };
  }
  
  // Entry exists and is valid
  if (entry.count >= config.requests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: config.requests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit middleware for Next.js API routes
 * Returns NextResponse with 429 status if rate limited
 */
export function rateLimitMiddleware(
  request: Request,
  tier: "standard" | "premium" = "standard"
): NextResponse | null {
  // Get identifier from request (IP address or user ID)
  // In production, extract from headers or auth token
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const identifier = ip !== "unknown" ? ip : "anonymous";
  
  const result = checkRateLimit(identifier, tier);
  
  if (!result || !result.allowed) {
    const resetAt = result?.resetAt || Date.now() + RATE_LIMITS.WINDOW_SECONDS * 1000;
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Too many requests. Please try again after ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": getRateLimitConfig(tier).requests.toString(),
          "X-RateLimit-Remaining": (result?.remaining || 0).toString(),
          "X-RateLimit-Reset": resetAt.toString(),
        },
      }
    );
  }
  
  // Request allowed - add rate limit headers
  const response = new NextResponse();
  response.headers.set("X-RateLimit-Limit", getRateLimitConfig(tier).requests.toString());
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set("X-RateLimit-Reset", result.resetAt.toString());
  
  return null; // null means continue processing
}

/**
 * Log rate limit violations for monitoring
 */
export function logRateLimitViolation(
  identifier: string,
  tier: "standard" | "premium",
  path: string
): void {
  console.warn(`[Rate Limit] Violation detected:`, {
    identifier,
    tier,
    path,
    timestamp: new Date().toISOString(),
  });
}


