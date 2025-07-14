"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";
import AuthForm from "../components/Auth";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  return user ? <div className="p-6">Welcome, {user.email}</div> : <AuthForm />;
}
