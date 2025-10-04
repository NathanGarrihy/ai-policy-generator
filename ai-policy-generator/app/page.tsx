"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * The home page displays a simple dashboard when the user is logged in and
 * provides a Google OAuth login when unauthenticated. Once authenticated
 * the user can start a new policy questionnaire or view previously saved
 * versions.
 */
export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // On mount fetch the current user and subscribe to auth changes.
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error);
        setUser(null);
      } else {
        setUser(data?.user ?? null);
      }
      setLoading(false);
    };

    fetchUser();
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      {user ? (
        <>
          <h1 className="text-2xl font-semibold mb-4">
            Welcome {user.email}
          </h1>
          <div className="flex gap-4">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={() => router.push("/questionnaire-v2")}
            >
              Create New Policy
            </button>
            <button
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
              onClick={() => router.push("/history")}
            >
              View Previous Versions
            </button>
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold mb-4">You're not signed in</h1>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            onClick={handleLogin}
          >
            Sign in with Google
          </button>
        </>
      )}
    </main>
  );
}
