"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { formatMoney, getPhotoPackage, PHOTO_PACKAGES, type PhotoPackageCode } from "@/lib/pricing";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GenerationMode, UserProfile } from "@/lib/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type SelectedSelfie = {
  id: string;
  file: File;
  name: string;
  size: number;
  url: string;
};

const selfieGuide = [
  {
    title: "Анфас с нейтральным выражением лица",
    image: "/selfie-guide/01-front-neutral.jpg",
  },
  {
    title: "Анфас с лёгкой улыбкой",
    image: "/selfie-guide/02-front-smile.jpg",
  },
  {
    title: "Левый полуоборот",
    image: "/selfie-guide/03-left-three-quarter.jpg",
  },
  {
    title: "Правый полуоборот",
    image: "/selfie-guide/04-right-three-quarter.jpg",
  },
  {
    title: "Левый профиль",
    image: "/selfie-guide/05-left-profile.jpg",
  },
  {
    title: "Правый профиль",
    image: "/selfie-guide/06-right-profile.jpg",
  },
];

const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,.avif";
const acceptedImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "avif"]);

export default function UploadPage() {
  const router = useRouter();
  const [selfies, setSelfies] = useState<SelectedSelfie[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard");
  const [selectedStudioSlug, setSelectedStudioSlug] = useState("modern-office");
  const [selectedPackageCode, setSelectedPackageCode] = useState<PhotoPackageCode>("free_1");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [acceptedPhotoRights, setAcceptedPhotoRights] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const readyCount = selfies.length;
  const isReady = readyCount >= 6;
  const selectedPackage = useMemo(() => getPhotoPackage(selectedPackageCode), [selectedPackageCode]);
  const hasFreeCredits = (profile?.free_images_remaining ?? 0) > 0;
  const hasAcceptedStoredConsents = Boolean(
    profile?.legal_terms_accepted_at &&
      profile.privacy_accepted_at &&
      profile.personal_data_accepted_at &&
      profile.photo_rights_accepted_at,
  );
  const hasConsents = hasAcceptedStoredConsents || (acceptedLegal && acceptedPhotoRights);
  const canContinue =
    Boolean(userId && userEmail && profile) &&
    isReady &&
    hasConsents &&
    (!selectedPackage.isFree || hasFreeCredits);
  const continueHint = useMemo(() => {
    if (!userId || !userEmail) return "Сначала войдите по email.";
    if (!profile) return "Загружаем профиль пользователя.";
    if (!isReady) return "Загрузите минимум 6 фото.";
    if (!hasConsents) return "Подтвердите согласия.";
    if (selectedPackage.isFree && !hasFreeCredits) {
      return "Бесплатные фото закончились. Выберите платный пакет.";
    }

    return "";
  }, [hasConsents, hasFreeCredits, isReady, profile, selectedPackage.isFree, userEmail, userId]);
  const statusText = useMemo(() => {
    if (readyCount === 0) return "Загрузите 6 селфи, чтобы начать.";
    if (readyCount < 6) return `Нужно ещё ${6 - readyCount} фото.`;
    return "Набор фото готов для проверки качества.";
  }, [readyCount]);

  useEffect(() => {
    setSelectedStudioSlug(
      new URLSearchParams(window.location.search).get("studio") ?? "modern-office",
    );
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      syncUserSession(supabase, data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUserSession(supabase, session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function syncUserSession(supabase: SupabaseClient, user: User | null) {
    if (user?.is_anonymous || (user?.id && !user.email)) {
      await supabase.auth.signOut();
      clearUserSession();
      setAuthError(null);
      setAuthMessage("Старая тестовая сессия сброшена. Войдите по email.");
      return;
    }

    if (!user?.id || !user.email) {
      clearUserSession();
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email);
    setAuthEmail(user.email);
    setAuthError(null);
    await loadOrCreateProfile(user.id, user.email);
  }

  function clearUserSession() {
    setUserId(null);
    setUserEmail("");
    setProfile(null);
    setAcceptedLegal(false);
    setAcceptedPhotoRights(false);
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    clearUserSession();
    setAuthEmail("");
    setAuthError(null);
    setAuthMessage("Вы вышли из аккаунта.");
  }

  useEffect(() => {
    if (selectedPackageCode === "free_1" && profile && profile.free_images_remaining <= 0) {
      setSelectedPackageCode("studio_5");
    }
  }, [profile, selectedPackageCode]);

  async function sendLoginLink() {
    if (!authEmail.trim() || isSendingLink) return;

    setIsSendingLink(true);
    setUploadError(null);
    setAuthMessage(null);
    setAuthError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/upload?studio=${selectedStudioSlug}`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setAuthMessage("Отправили ссылку для входа. Откройте письмо и подтвердите email.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Не удалось отправить ссылку.");
    } finally {
      setIsSendingLink(false);
    }
  }

  async function loadOrCreateProfile(activeUserId: string, email: string) {
    const supabase = createSupabaseBrowserClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: activeUserId,
          email,
          updated_at: now,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (error) {
      setAuthError(
        error.message.includes("user_profiles")
          ? "Профиль не удалось загрузить. Проверьте, что SQL-миграция в Supabase выполнена."
          : error.message,
      );
      return;
    }

    const nextProfile = data as UserProfile;
    setAuthError(null);
    setProfile(nextProfile);
    setAcceptedLegal(
      Boolean(
        nextProfile.legal_terms_accepted_at &&
          nextProfile.privacy_accepted_at &&
          nextProfile.personal_data_accepted_at,
      ),
    );
    setAcceptedPhotoRights(Boolean(nextProfile.photo_rights_accepted_at));
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
      .filter(isAcceptedImage)
      .slice(0, 12);

    selfies.forEach((selfie) => URL.revokeObjectURL(selfie.url));

    setSelfies(
      files.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
      })),
    );
    setUploadError(null);
    setUploadResult(null);
  }

  function clearFiles() {
    selfies.forEach((selfie) => URL.revokeObjectURL(selfie.url));
    setSelfies([]);
    setUploadError(null);
    setUploadResult(null);
  }

  async function handleUpload() {
    if (isUploading) return;

    if (!isReady) {
      setUploadError("Загрузите минимум 6 фото.");
      return;
    }

    if (!hasConsents) {
      setUploadError("Подтвердите согласия перед продолжением.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const activeUserId = sessionData.session?.user.id;
      const activeEmail = sessionData.session?.user.email;

      if (!activeUserId || !activeEmail) {
        throw new Error("Сначала войдите по email.");
      }

      if (selectedPackage.isFree && !hasFreeCredits) {
        throw new Error("Бесплатные фото закончились. Выберите платный пакет.");
      }

      const now = new Date().toISOString();
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: activeUserId,
            email: activeEmail,
            legal_terms_accepted_at: now,
            privacy_accepted_at: now,
            personal_data_accepted_at: now,
            photo_rights_accepted_at: now,
            updated_at: now,
          },
          { onConflict: "user_id" },
        );

      if (profileError) {
        throw new Error(profileError.message);
      }

      const { data: studio, error: studioError } = await supabase
        .from("studios")
        .select("id")
        .eq("slug", selectedStudioSlug)
        .single();

      if (studioError || !studio) {
        throw new Error(studioError?.message ?? "Студия не найдена.");
      }

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          user_id: activeUserId,
          studio_id: studio.id,
          generation_mode: generationMode,
          status: "draft",
          payment_status: selectedPackage.isFree ? "unpaid" : "unpaid",
          amount_cents: selectedPackage.amountCents,
          currency: "rub",
          product_code: selectedPackage.code,
          target_image_count: selectedPackage.imageCount,
          progress: 0,
        })
        .select("id")
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message ?? "Не удалось создать job.");
      }

      const uploadedRows = [];

      for (const [index, selfie] of selfies.entries()) {
        const filePath = `${activeUserId}/${job.id}/${String(index + 1).padStart(2, "0")}-${sanitizeFileName(selfie.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("selfies")
          .upload(filePath, selfie.file, {
            contentType: selfie.file.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        uploadedRows.push({
          job_id: job.id,
          user_id: activeUserId,
          file_url: filePath,
          is_approved: false,
        });
      }

      const { error: selfiesError } = await supabase
        .from("uploaded_selfies")
        .insert(uploadedRows);

      if (selfiesError) {
        throw new Error(selfiesError.message);
      }

      setUploadResult(`Job создан: ${job.id}. Загружено фото: ${uploadedRows.length}.`);
      router.push(`/quality/${job.id}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Неизвестная ошибка.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
          <Link href="/">Каталог</Link>
        </nav>
      </header>

      <section className="upload-layout">
        <div className="upload-copy">
          <p className="eyebrow">Шаг 1 из 3</p>
          <h1>Загрузите фото</h1>
        </div>
      </section>

      <section className="section auth-section">
        <div className="section-header">
          <div>
            <h2>Email для аккаунта и чеков</h2>
            <p>
              Войдите по email. На этот адрес будут приходить чеки и доступ к
              фотосессиям.
            </p>
          </div>
        </div>
        {userId && userEmail ? (
          <div className="account-state">
            <div>
              <strong>{userEmail}</strong>
              <span>email подтверждён, можно продолжать загрузку</span>
            </div>
            <button className="button button-secondary" onClick={signOut} type="button">
              Выйти
            </button>
          </div>
        ) : (
          <div className="auth-inline">
            <input
              autoComplete="email"
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="email@example.com"
              type="email"
              value={authEmail}
            />
            <button
              className="button button-primary"
              disabled={isSendingLink || !authEmail.trim()}
              onClick={sendLoginLink}
              type="button"
            >
              {isSendingLink ? "Отправляем..." : "Получить ссылку для входа"}
            </button>
          </div>
        )}
        {authMessage ? <div className="upload-message success">{authMessage}</div> : null}
        {authError ? <div className="upload-message error">{authError}</div> : null}
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Какие фото нужны</h2>
            <p>
              От 6 обычных фото с телефона: анфас, полуобороты, профиль при
              дневном свете, без солнцезащитных очков и сильных теней.
              Чем больше подходящих фото, тем точнее результат.
            </p>
          </div>
        </div>

        <div className="guide-grid">
          {selfieGuide.map((item, index) => (
            <article className="guide-card" key={item.title}>
              <img className="guide-photo" alt={item.title} src={item.image} />
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section child-mode-section">
        <div className="section-header">
          <div>
            <h2>Пакет фотосессии</h2>
            <p>
              Бесплатно доступно {profile?.free_images_remaining ?? 0} фото. После
              бесплатного теста можно выбрать платный пакет.
            </p>
          </div>
        </div>
        <div className="package-grid">
          {PHOTO_PACKAGES.map((photoPackage) => {
            const isDisabled = photoPackage.isFree && !hasFreeCredits;

            return (
              <label
                className={`package-card ${selectedPackageCode === photoPackage.code ? "active" : ""} ${isDisabled ? "disabled" : ""}`}
                key={photoPackage.code}
              >
                <input
                  checked={selectedPackageCode === photoPackage.code}
                  disabled={isDisabled}
                  name="photo-package"
                  onChange={() => setSelectedPackageCode(photoPackage.code)}
                  type="radio"
                />
                <strong>{photoPackage.imageCount} фото</strong>
                <span>{formatMoney(photoPackage.amountCents)}</span>
                <em>{photoPackage.description}</em>
              </label>
            );
          })}
        </div>
      </section>

      <section className="section child-mode-section">
        <label className="mode-option">
          <input
            checked={generationMode === "child_safe"}
            onChange={(event) =>
              setGenerationMode(event.target.checked ? "child_safe" : "standard")
            }
            type="checkbox"
          />
          <span>
            <strong>Детский безопасный режим</strong>
            <em>
              Для детских фото: полностью одетый ребёнок, школьный или детский
              портрет без взрослого делового образа и двусмысленных сцен.
            </em>
          </span>
        </label>
      </section>

      <section className="section upload-action-section">
        <label className="upload-dropzone">
          <input accept={acceptedImageTypes} multiple onChange={handleFiles} type="file" />
          <span>Выбрать фото</span>
          <strong>Загрузите от 6 селфи одним разом</strong>
          <em>JPG, PNG, WEBP, HEIC, HEIF или AVIF</em>
        </label>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Выбранные фото</h2>
            <p>После загрузки откроется экран проверки качества фото.</p>
          </div>
          {selfies.length > 0 ? (
            <button className="button button-secondary" onClick={clearFiles} type="button">
              Очистить
            </button>
          ) : null}
        </div>

        {selfies.length > 0 ? (
          <div className="selfie-grid">
            {selfies.map((selfie) => (
              <article className="selfie-card" key={selfie.id}>
                <img alt={selfie.name} src={selfie.url} />
                <div>
                  <strong>{selfie.name}</strong>
                  <span>{formatFileSize(selfie.size)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Фото ещё не выбраны</strong>
            <span>После выбора здесь появятся превью и список файлов.</span>
          </div>
        )}

        <div className="legal-consent-panel">
          <p>{hasAcceptedStoredConsents ? "Согласия уже сохранены в профиле." : "Подтвердите согласия один раз. Мы сохраним их в профиле."}</p>
          {!userId || !userEmail ? (
            <p className="legal-consent-note">Сначала войдите по email, затем подтвердите юридические согласия.</p>
          ) : null}

          <label className="consent-option">
            <input
              checked={acceptedLegal}
              disabled={!userId || !userEmail || hasAcceptedStoredConsents}
              onChange={(event) => setAcceptedLegal(event.target.checked)}
              type="checkbox"
            />
            <span>
              Я принимаю{" "}
              <Link href="/oferta" target="_blank">
                Пользовательское соглашение
              </Link>
              ,{" "}
              <Link href="/privacy" target="_blank">
                Политику конфиденциальности
              </Link>{" "}
              и даю{" "}
              <Link href="/personal-data-consent" target="_blank">
                согласие на обработку персональных данных
              </Link>
              .
            </span>
          </label>

          <label className="consent-option">
            <input
              checked={acceptedPhotoRights}
              disabled={!userId || !userEmail || hasAcceptedStoredConsents}
              onChange={(event) => setAcceptedPhotoRights(event.target.checked)}
              type="checkbox"
            />
            <span>
              Я подтверждаю, что мне исполнилось 18 лет, я имею право использовать
              загруженные изображения, не загружаю чужие фото без согласия и не создаю
              незаконный или запрещённый контент. Если на фото ребёнок, я являюсь
              родителем/законным представителем или имею согласие на использование
              изображения.
            </span>
          </label>

          <small>
            Загруженные фото используются для создания AI-фотосессии и могут временно
            храниться для генерации изображений, проверки качества, технической
            поддержки и обеспечения работы сервиса.
          </small>
        </div>

        <div className="upload-footer">
          <Link className="button button-secondary" href="/">
            Назад к студии
          </Link>
          <button
            className="button button-primary"
            disabled={!canContinue || isUploading}
            onClick={handleUpload}
            type="button"
          >
            {isUploading ? "Загружаем..." : "Продолжить к проверке качества"}
          </button>
        </div>
        {!canContinue && continueHint ? (
          <div className="upload-message muted">{continueHint}</div>
        ) : null}

        {uploadError ? <div className="upload-message error">{uploadError}</div> : null}
        {uploadResult ? <div className="upload-message success">{uploadResult}</div> : null}
      </section>
    </main>
  );
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isAcceptedImage(file: File) {
  if (file.type.startsWith("image/")) return true;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? acceptedImageExtensions.has(extension) : false;
}
