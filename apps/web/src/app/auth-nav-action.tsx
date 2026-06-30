"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function AuthNavAction() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(Boolean(data.session?.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    window.location.href = "/";
  }

  if (isLoggedIn) {
    return (
      <span className="auth-nav-actions">
        <Link className="nav-auth-link" href="/sessions">
          Мои фотосессии
        </Link>
        <button className="nav-auth-button" onClick={signOut} type="button">
          Выйти
        </button>
      </span>
    );
  }

  return (
    <Link className="nav-auth-link" href="/login">
      Регистрация/Войти
    </Link>
  );
}
