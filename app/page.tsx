"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    };

    getUser();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-white bg-black">
      {user ? (
        <>
          <h1 className="text-2xl font-semibold mb-4">Welcome</h1>
          <button
            onClick={handleLogout}
            className="text-red-400 underline mb-8"
          >
            Logout
          </button>

          <div className="flex gap-4">
            <button
              onClick={() => router.push("/questionnaire")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Create New Policy
            </button>
            <button
              onClick={() => router.push("/history")}
              className="bg-zinc-600 hover:bg-zinc-700 text-white px-4 py-2 rounded"
            >
              View Previous Versions
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold mb-6">You're not signed in</h1>
          <button
            onClick={handleLogin}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded shadow font-semibold"
          >
            Sign in with Google
          </button>
        </>
      )}
    </main>
  );
}
