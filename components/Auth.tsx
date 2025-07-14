"use client";

import { supabase } from "../lib/supabase";
import { useState } from "react";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    setMessage(error ? "Login failed" : "Check your email for magic link");
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold">Login</h2>
      <input
        className="border rounded p-2"
        type="email"
        placeholder="your@email.com"
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className="bg-blue-600 text-white p-2 rounded"
        onClick={handleLogin}
      >
        Send Magic Link
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
