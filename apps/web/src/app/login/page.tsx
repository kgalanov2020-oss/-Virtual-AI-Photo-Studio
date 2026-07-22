"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthNavAction } from "@/app/auth-nav-action";
import { getStoredMarketingAttribution } from "@/lib/marketing-attribution";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import { trackVkGoal } from "@/lib/vk-pixel";
import { trackYandexGoal } from "@/lib/yandex-metrika";

const defaultNextPath = "/#studios";

type ConsentState = {
  legalTerms: boolean;
  privacy: boolean;
  personalData: boolean;
  photoRights: boolean;
};

const emptyConsentState: ConsentState = {
  legalTerms: false,
  privacy: false,
  personalData: false,
  photoRights: false,
};

function sanitizeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return defaultNextPath;

  const [pathAndQuery] = value.split("#");
  const [path, queryString = ""] = pathAndQuery.split("?");
  const params = new URLSearchParams(queryString);

  if (path === "/upload" && !params.get("studio")) return defaultNextPath;

  return value;
}

function formatAuthError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("Invalid login credentials")) {
      return "Неверный email или пароль.";
    }

    if (error.message.includes("Email not confirmed")) {
      return "Email ещё не подтверждён. Проверьте письмо и перейдите по ссылке.";
    }

    if (error.message.includes("Failed to fetch") || error.message.includes("fetch")) {
      return "Не удалось подключиться к Supabase Auth. Проверьте интернет и настройки проекта.";
    }

    return error.message;
  }

  return "Не удалось выполнить вход или регистрацию. Попробуйте ещё раз.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consents, setConsents] = useState<ConsentState>(emptyConsentState);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nextPath, setNextPath] = useState(defaultNextPath);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const storedConsentsAccepted = Boolean(
    profile?.legal_terms_accepted_at &&
      profile.privacy_accepted_at &&
      profile.personal_data_accepted_at &&
      profile.photo_rights_accepted_at,
  );
  const allConsentsAccepted = Object.values(consents).every(Boolean);
  const shouldShowConsents = !user || !storedConsentsAccepted;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(sanitizeNext(params.get("next")));

    let isMounted = true;

    async function loadSession() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user ?? null;

        if (!isMounted || !sessionUser) return;

        setUser(sessionUser);
        setEmail(sessionUser.email ?? "");
        await loadProfile(sessionUser);
      } catch {
        if (isMounted) {
          setError("Не удалось подключиться к Supabase Auth. Проверьте настройки проекта.");
        }
      }
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadProfile(nextUser: User) {
    const supabase = createSupabaseBrowserClient();
    const { data, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", nextUser.id)
      .maybeSingle();

    if (profileError && !profileError.message.includes("user_profiles")) {
      throw profileError;
    }

    const nextProfile = data ?? null;
    setProfile(nextProfile);
    setConsents((current) => ({
      legalTerms: current.legalTerms || Boolean(nextProfile?.legal_terms_accepted_at),
      privacy: current.privacy || Boolean(nextProfile?.privacy_accepted_at),
      personalData: current.personalData || Boolean(nextProfile?.personal_data_accepted_at),
      photoRights: current.photoRights || Boolean(nextProfile?.photo_rights_accepted_at),
    }));
    return nextProfile;
  }

  async function saveProfileConsents(nextUser: User) {
    const supabase = createSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const token = session?.access_token;
    if (!token || session?.user.id !== nextUser.id) {
      throw new Error("Сессия пользователя истекла. Войдите ещё раз.");
    }

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ consents }),
    });
    const payload = (await response.json()) as { error?: string; profile?: UserProfile };
    if (!response.ok || !payload.profile) {
      throw new Error(payload.error ?? "Не удалось сохранить согласия.");
    }

    setProfile(payload.profile);
    return payload.profile;
  }

  function redirectToNext() {
    window.location.href = nextPath;
  }

  async function register() {
    setError("");
    setMessage("");

    if (!email.trim() || password.length < 6) {
      setError("Введите email и пароль минимум из 6 символов.");
      return;
    }

    if (!allConsentsAccepted) {
      setError("Перед регистрацией отметьте каждое обязательное согласие отдельно.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const attribution = getStoredMarketingAttribution();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`,
          data: attribution
            ? {
                marketing_attribution_first: attribution.first,
                marketing_attribution_last: attribution.last,
              }
            : undefined,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user?.identities?.length) {
        const registrationKey = `vaps_registration_${data.user.id}`;
        if (!window.sessionStorage.getItem(registrationKey)) {
          trackVkGoal("registration");
          trackYandexRegistrationOnce(data.user.id);
          window.sessionStorage.setItem(registrationKey, "1");
        }
      }

      if (data.session?.user) {
        await saveProfileConsents(data.session.user);
        redirectToNext();
        return;
      }

      setMessage("Письмо подтверждения отправлено. Перейдите по ссылке из письма, затем войдите.");
    } catch (authError) {
      setError(`Регистрация сейчас не прошла: ${formatAuthError(authError)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function login() {
    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Введите email и пароль.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;
      if (!data.user) throw new Error("Supabase не вернул пользователя.");

      setUser(data.user);
      const nextProfile = await loadProfile(data.user);
      const hasStoredConsents = Boolean(
        nextProfile?.legal_terms_accepted_at &&
          nextProfile.privacy_accepted_at &&
          nextProfile.personal_data_accepted_at &&
          nextProfile.photo_rights_accepted_at,
      );

      if (hasStoredConsents) {
        redirectToNext();
        return;
      }

      setMessage("Перед входом подтвердите согласия и права на фото.");
    } catch (authError) {
      setError(`Не удалось выполнить вход: ${formatAuthError(authError)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveConsentsAndContinue() {
    if (!user || !allConsentsAccepted || isSubmitting) return;

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await saveProfileConsents(user);
      redirectToNext();
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Не удалось сохранить согласия.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setConsents(emptyConsentState);
  }

  function updateConsent(key: keyof ConsentState, checked: boolean) {
    setConsents((current) => ({ ...current, [key]: checked }));
  }

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
          <Link href="/">Каталог</Link>
          <AuthNavAction />
        </nav>
      </header>

      <section className="upload-layout">
        <div className="upload-copy">
          <p className="eyebrow">Аккаунт</p>
          <h1>Регистрация и вход</h1>
        </div>
      </section>

      <section className="section auth-section">
        <div className="section-header">
          <div>
            <h2>Email для аккаунта и чеков</h2>
            <p>
              Зарегистрируйтесь или войдите по email и паролю. На этот адрес будут
              приходить чеки и доступ к фотосессиям.
            </p>
          </div>
        </div>

        {user ? (
          <div className="account-state">
            <div>
              <strong>{user.email}</strong>
              <span>
                {storedConsentsAccepted
                  ? "email подтверждён, можно продолжать"
                  : "подтвердите согласия, чтобы продолжить"}
              </span>
            </div>
            <div className="auth-actions auth-actions-inline">
              {storedConsentsAccepted ? (
                <Link className="button button-primary" href={nextPath}>
                  Продолжить
                </Link>
              ) : (
                <button
                  className="button button-primary"
                  disabled={isSubmitting || !allConsentsAccepted}
                  onClick={saveConsentsAndContinue}
                  type="button"
                >
                  {isSubmitting ? "Сохраняем..." : "Принять и продолжить"}
                </button>
              )}
              <button className="button button-secondary" onClick={signOut} type="button">
                Выйти
              </button>
            </div>
          </div>
        ) : (
          <div className="auth-inline">
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@example.com"
              type="email"
              value={email}
            />
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Пароль"
              type="password"
              value={password}
            />
          </div>
        )}

        {shouldShowConsents ? (
          <div
            aria-labelledby="consent-heading"
            className="legal-consent-panel"
            role="group"
          >
            <p id="consent-heading">
              {user
                ? "Подтвердите согласия один раз. Мы сохраним их в профиле."
                : "Подтвердите согласия перед регистрацией."}
            </p>

            <label className="consent-option">
              <input
                checked={consents.personalData}
                disabled={isSubmitting || Boolean(profile?.personal_data_accepted_at)}
                onChange={(event) => updateConsent("personalData", event.target.checked)}
                type="checkbox"
              />
              <span>
                Я даю{" "}
                <Link href="/personal-data-consent" rel="noreferrer" target="_blank">
                  согласие на обработку персональных данных
                </Link>
                .
              </span>
            </label>

            <label className="consent-option">
              <input
                checked={consents.legalTerms}
                disabled={isSubmitting || Boolean(profile?.legal_terms_accepted_at)}
                onChange={(event) => updateConsent("legalTerms", event.target.checked)}
                type="checkbox"
              />
              <span>
                Я ознакомился(-ась) и принимаю{" "}
                <Link href="/oferta" rel="noreferrer" target="_blank">
                  Пользовательское соглашение
                </Link>
                .
              </span>
            </label>

            <label className="consent-option">
              <input
                checked={consents.privacy}
                disabled={isSubmitting || Boolean(profile?.privacy_accepted_at)}
                onChange={(event) => updateConsent("privacy", event.target.checked)}
                type="checkbox"
              />
              <span>
                Я ознакомился(-ась) и принимаю{" "}
                <Link href="/privacy" rel="noreferrer" target="_blank">
                  Политику конфиденциальности
                </Link>
                .
              </span>
            </label>

            <label className="consent-option">
              <input
                checked={consents.photoRights}
                disabled={isSubmitting || Boolean(profile?.photo_rights_accepted_at)}
                onChange={(event) => updateConsent("photoRights", event.target.checked)}
                type="checkbox"
              />
              <span>
                Я подтверждаю, что мне исполнилось 18 лет и я имею право использовать
                загружаемые фотографии. Я не загружаю чужие фото без согласия и не создаю
                незаконный или запрещённый контент. Если на фото ребёнок, я являюсь
                родителем/законным представителем или имею согласие на использование его
                изображения.
              </span>
            </label>

            <small>
              Загруженные фото используются для создания AI-фотосессии и могут временно
              храниться для генерации изображений, проверки качества, технической
              поддержки и обеспечения работы сервиса.
            </small>
          </div>
        ) : null}

        {!user ? (
          <div className="auth-actions auth-actions-after-consent">
            <button
              className="button button-primary"
              disabled={isSubmitting || !email.trim() || password.length < 6 || !allConsentsAccepted}
              onClick={register}
              type="button"
            >
              {isSubmitting ? "Подождите..." : "Зарегистрироваться"}
            </button>
            <button
              className="button button-secondary"
              disabled={isSubmitting || !email.trim() || !password.trim()}
              onClick={login}
              type="button"
            >
              Войти
            </button>
          </div>
        ) : null}

        {message ? <div className="upload-message success">{message}</div> : null}
        {error ? <div className="upload-message error">{error}</div> : null}
      </section>
    </main>
  );
}

function trackYandexRegistrationOnce(userId: string) {
  const key = `yandex-goal:registration_success:${userId}`;

  try {
    if (window.localStorage.getItem(key)) return;
    if (trackYandexGoal("registration_success")) {
      window.localStorage.setItem(key, "1");
    }
  } catch {
    trackYandexGoal("registration_success");
  }
}
