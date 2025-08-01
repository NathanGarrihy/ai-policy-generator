"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/"; // force full reload to clear state
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-red-600 hover:underline font-medium ml-4"
    >
      Logout
    </button>
  );
}
