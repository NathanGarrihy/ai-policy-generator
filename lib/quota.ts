/**
 * Per-user generation quota tracking
 * 
 * NOTE: This uses in-memory storage for simplicity.
 * 
 * LIMITATIONS:
 * - Quotas are reset on server restart
 * - Not suitable for distributed deployments (multiple server instances)
 * - No persistence across deployments
 * 
 * PRODUCTION RECOMMENDATION:
 * For production, migrate to a database-backed solution:
 * 1. Create a `user_generation_quota` table with columns:
 *    - user_id (UUID, foreign key to auth.users)
 *    - tier (enum: 'standard' | 'premium')
 *    - period (enum: 'day' | 'month')
 *    - date_key (VARCHAR, e.g., '2024-01-15' for day, '2024-01' for month)
 *    - count (INTEGER, default 0)
 *    - updated_at (TIMESTAMP)
 *    - PRIMARY KEY (user_id, tier, period, date_key)
 * 2. Use upsert operations to increment counts atomically
 * 3. Add database indexes for efficient queries
 * 4. Consider using Redis for high-performance scenarios
 */

import { NextResponse } from "next/server";

type QuotaPeriod = "day" | "month";

type QuotaConfig = {
  standard: {
    day: number;
    month: number;
  };
  premium: {
    day: number;
    month: number;
  };
};

// Default quota limits (can be overridden via environment variables)
const DEFAULT_QUOTAS: QuotaConfig = {
  standard: {
    day: 10, // 10 generations per day for standard tier
    month: 100, // 100 generations per month for standard tier
  },
  premium: {
    day: 50, // 50 generations per day for premium tier
    month: 500, // 500 generations per month for premium tier
  },
};

// In-memory quota store
// Key format: `quota:${userId}:${tier}:${period}:${dateKey}`
// Value: count
type QuotaStore = Map<string, number>;

const quotaStore: QuotaStore = new Map();

/**
 * Get quota configuration from environment or defaults
 */
function getQuotaConfig(tier: "standard" | "premium"): { day: number; month: number } {
  const envKey = tier === "premium" ? "QUOTA_PREMIUM" : "QUOTA_STANDARD";
  const envDayKey = `${envKey}_DAY`;
  const envMonthKey = `${envKey}_MONTH`;

  return {
    day: process.env[envDayKey] 
      ? parseInt(process.env[envDayKey]!, 10) 
      : DEFAULT_QUOTAS[tier].day,
    month: process.env[envMonthKey]
      ? parseInt(process.env[envMonthKey]!, 10)
      : DEFAULT_QUOTAS[tier].month,
  };
}

/**
 * Generate quota key for storage
 */
function getQuotaKey(
  userId: string,
  tier: "standard" | "premium",
  period: QuotaPeriod,
  dateKey: string
): string {
  return `quota:${userId}:${tier}:${period}:${dateKey}`;
}

/**
 * Get date key for quota period
 */
function getDateKey(period: QuotaPeriod): string {
  const now = new Date();
  if (period === "day") {
    return now.toISOString().split("T")[0]; // YYYY-MM-DD
  } else {
    // month
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  }
}

/**
 * Check if user has quota remaining
 * Returns true if quota available, false if exceeded
 */
export function checkQuota(
  userId: string,
  tier: "standard" | "premium"
): { allowed: boolean; remaining: { day: number; month: number }; limits: { day: number; month: number } } {
  const config = getQuotaConfig(tier);
  const dayKey = getDateKey("day");
  const monthKey = getDateKey("month");

  const dayQuotaKey = getQuotaKey(userId, tier, "day", dayKey);
  const monthQuotaKey = getQuotaKey(userId, tier, "month", monthKey);

  const dayCount = quotaStore.get(dayQuotaKey) || 0;
  const monthCount = quotaStore.get(monthQuotaKey) || 0;

  const dayRemaining = Math.max(0, config.day - dayCount);
  const monthRemaining = Math.max(0, config.month - monthCount);

  const allowed = dayCount < config.day && monthCount < config.month;

  return {
    allowed,
    remaining: {
      day: dayRemaining,
      month: monthRemaining,
    },
    limits: config,
  };
}

/**
 * Increment quota usage for a user
 */
export function incrementQuota(userId: string, tier: "standard" | "premium"): void {
  const dayKey = getDateKey("day");
  const monthKey = getDateKey("month");

  const dayQuotaKey = getQuotaKey(userId, tier, "day", dayKey);
  const monthQuotaKey = getQuotaKey(userId, tier, "month", monthKey);

  const dayCount = quotaStore.get(dayQuotaKey) || 0;
  const monthCount = quotaStore.get(monthQuotaKey) || 0;

  quotaStore.set(dayQuotaKey, dayCount + 1);
  quotaStore.set(monthQuotaKey, monthCount + 1);
}

/**
 * Clean up expired quota entries (older than 2 months)
 */
export function cleanupExpiredQuotas(): void {
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const cutoffKey = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

  for (const [key, _] of quotaStore.entries()) {
    // Extract date key from quota key
    const parts = key.split(":");
    if (parts.length >= 5) {
      const dateKey = parts[4];
      if (dateKey < cutoffKey) {
        quotaStore.delete(key);
      }
    }
  }
}

// Clean up expired quotas every hour
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredQuotas, 60 * 60 * 1000);
}

/**
 * Middleware to check quota before processing request
 * Returns NextResponse with 429 if quota exceeded, null if allowed
 */
export function checkQuotaMiddleware(
  userId: string,
  tier: "standard" | "premium"
): NextResponse | null {
  const quotaCheck = checkQuota(userId, tier);

  if (!quotaCheck.allowed) {
    const exceededPeriods: string[] = [];
    if (quotaCheck.remaining.day === 0) exceededPeriods.push("daily");
    if (quotaCheck.remaining.month === 0) exceededPeriods.push("monthly");

    return NextResponse.json(
      {
        error: "Quota exceeded",
        message: `Generation quota exceeded (${exceededPeriods.join(" and ")} limit reached). Please try again later.`,
        remaining: quotaCheck.remaining,
        limits: quotaCheck.limits,
      },
      {
        status: 429,
        headers: {
          "X-Quota-Remaining-Day": quotaCheck.remaining.day.toString(),
          "X-Quota-Remaining-Month": quotaCheck.remaining.month.toString(),
          "X-Quota-Limit-Day": quotaCheck.limits.day.toString(),
          "X-Quota-Limit-Month": quotaCheck.limits.month.toString(),
        },
      }
    );
  }

  return null; // Quota available
}

