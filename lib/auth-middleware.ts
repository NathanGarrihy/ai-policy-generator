/**
 * Authentication middleware for Next.js App Router API routes
 * Extracts and validates Supabase user sessions from request cookies
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export type AuthResult = 
  | { authenticated: true; user: User; userId: string }
  | { authenticated: false; response: NextResponse };

/**
 * Creates an authenticated Supabase client for server-side use
 * Reads session from cookies and returns client with user context
 */
export function createAuthenticatedClient() {
  const cookieStore = cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Cookie setting may fail in middleware/edge runtime
            // This is expected in some contexts
          }
        },
      },
    }
  );
}

/**
 * Authenticates a request and returns user information
 * Returns 401 Unauthorized if user is not authenticated
 * 
 * @returns AuthResult with user info if authenticated, or error response if not
 */
export async function authenticateRequest(): Promise<AuthResult> {
  try {
    const supabase = createAuthenticatedClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        ),
      };
    }

    return {
      authenticated: true,
      user,
      userId: user.id,
    };
  } catch (error) {
    console.error("[Auth] Error authenticating request:", error);
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Authentication error", message: "Failed to verify authentication" },
        { status: 500 }
      ),
    };
  }
}

/**
 * Verifies that a resource belongs to the authenticated user
 * Used to ensure users can only access their own data
 * 
 * @param resourceUserId - The user_id from the resource being accessed
 * @param authenticatedUserId - The user_id from the authenticated session
 * @returns true if resource belongs to user, false otherwise
 */
export function verifyResourceOwnership(
  resourceUserId: string | null | undefined,
  authenticatedUserId: string
): boolean {
  if (!resourceUserId) {
    return false;
  }
  return resourceUserId === authenticatedUserId;
}

