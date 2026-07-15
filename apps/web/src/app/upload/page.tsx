"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AuthNavAction } from "@/app/auth-nav-action";
import { BODY_BUILD_LABELS, calculateBodyProfile } from "@/lib/body-profile";
import { getStoredMarketingAttribution } from "@/lib/marketing-attribution";
import { formatMoney, getPhotoPackage, PHOTO_PACKAGES, type PhotoPackageCode } from "@/lib/pricing";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GenerationMode, UserProfile } from "@/lib/types";
import { trackVkGoal } from "@/lib/vk-pixel";
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
    image: "/selfie-guide/01-front-neutral.webp",
  },
  {
    title: "Анфас с лёгкой улыбкой",
    image: "/selfie-guide/02-front-smile.webp",
  },
  {
    title: "Левый полуоборот",
    image: "/selfie-guide/03-left-three-quarter.webp",
  },
  {
    title: "Правый полуоборот",
    image: "/selfie-guide/04-right-three-quarter.webp",
  },
  {
    title: "Левый профиль",
    image: "/selfie-guide/05-left-profile.webp",
  },
  {
    title: "Правый профиль",
    image: "/selfie-guide/06-right-profile.webp",
  },
];

const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,.avif";
const acceptedImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "avif"]);
const visiblePhotoPackages = PHOTO_PACKAGES.filter((photoPackage) => photoPackage.code !== "free_1");

export default function UploadPage() {
  const router = useRouter();
  const [selfies, setSelfies] = useState<SelectedSelfie[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [selectedStudioSlug, setSelectedStudioSlug] = useState<string | null>(null);
  const [selectedPackageCode, setSelectedPackageCode] = useState<PhotoPackageCode>("studio_5");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  const readyCount = selfies.length;
  const isReady = readyCount >= 6;
  const selectedPackage = useMemo(() => getPhotoPackage(selectedPackageCode), [selectedPackageCode]);
  const parsedHeightCm = useMemo(() => parseOptionalNumber(heightCm), [heightCm]);
  const parsedWeightKg = useMemo(() => parseOptionalNumber(weightKg), [weightKg]);
  const bodyProfile = useMemo(
    () =>
      parsedHeightCm !== null && parsedWeightKg !== null
        ? calculateBodyProfile(parsedHeightCm, parsedWeightKg)
        : null,
    [parsedHeightCm, parsedWeightKg],
  );
  const hasPartialBodyProfile = Boolean(heightCm.trim() || weightKg.trim()) && !bodyProfile;
  const freeImagesRemaining = profile?.free_images_remaining ?? 0;
  const hasEnoughPhotoBalance = freeImagesRemaining >= selectedPackage.imageCount;
  const isAuthenticated = Boolean(userId && userEmail && profile);
  const canContinue =
    Boolean(userId && userEmail && profile) &&
    Boolean(selectedStudioSlug) &&
    isReady &&
    (!selectedPackage.isFree || hasEnoughPhotoBalance);
  const continueHint = useMemo(() => {
    if (!userId || !userEmail) return "Сначала войдите по email.";
    if (!profile) return "Загружаем профиль пользователя.";
    if (!selectedStudioSlug) return "Сначала выберите интерьер.";
    if (!isReady) return "Загрузите минимум 6 фото.";
    if (selectedPackage.isFree && !hasEnoughPhotoBalance) {
      return `Для бесплатной генерации нужно ${selectedPackage.imageCount} фото на балансе. Введите промокод или выберите платный пакет.`;
    }

    return "";
  }, [
    hasEnoughPhotoBalance,
    isReady,
    profile,
    selectedStudioSlug,
    selectedPackage.imageCount,
    selectedPackage.isFree,
    userEmail,
    userId,
  ]);
  const statusText = useMemo(() => {
    if (readyCount === 0) return "Загрузите 6 селфи, чтобы начать.";
    if (readyCount < 6) return `Нужно ещё ${6 - readyCount} фото.`;
    return "Набор фото готов для проверки качества.";
  }, [readyCount]);

  useEffect(() => {
    const studioSlug = new URLSearchParams(window.location.search).get("studio");

    if (!studioSlug) {
      window.location.replace("/#studios");
      return;
    }

    setSelectedStudioSlug(studioSlug);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      syncUserSession(supabase, data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void syncUserSession(createSupabaseBrowserClient(), session?.user ?? null);
      }, 0);
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
      redirectToLogin();
      return;
    }

    if (!user?.id || !user.email) {
      clearUserSession();
      redirectToLogin();
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email);
    setAuthError(null);
    await loadOrCreateProfile(user.id, user.email);
  }

  function clearUserSession() {
    setUserId(null);
    setUserEmail("");
    setProfile(null);
  }

  function redirectToLogin() {
    const nextPath = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  useEffect(() => {
    if (selectedPackageCode === "free_1") {
      setSelectedPackageCode("studio_5");
    }
  }, [selectedPackageCode]);

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

    const hasRequiredConsents = Boolean(
      nextProfile.legal_terms_accepted_at &&
        nextProfile.privacy_accepted_at &&
        nextProfile.personal_data_accepted_at &&
        nextProfile.photo_rights_accepted_at,
    );

    if (!hasRequiredConsents) {
      setProfile(null);
      setAuthMessage("Перед загрузкой фото нужно подтвердить согласия.");
      redirectToLogin();
      return;
    }

    setAuthError(null);
    setProfile(nextProfile);
  }

  async function applyPromoCode() {
    if (isApplyingPromo) return;

    const normalizedCode = promoCode.trim().replace(/\s+/g, "").toUpperCase();
    if (!normalizedCode) {
      setPromoError("Введите промокод.");
      setPromoMessage(null);
      return;
    }

    setIsApplyingPromo(true);
    setPromoError(null);
    setPromoMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Сначала войдите в аккаунт.");
      }

      const response = await fetch("/api/promo-codes/redeem", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const payload = (await response.json()) as {
        error?: string;
        creditsGranted?: number;
        freeImagesRemaining?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось применить промокод.");
      }

      setProfile((currentProfile) =>
        currentProfile
          ? {
              ...currentProfile,
              free_images_remaining:
                payload.freeImagesRemaining ?? currentProfile.free_images_remaining,
            }
          : currentProfile,
      );
      if ((payload.freeImagesRemaining ?? 0) >= getPhotoPackage("studio_5").imageCount) {
        setSelectedPackageCode("studio_5");
      }
      setPromoCode("");
      setPromoMessage(
        `Промокод применён: +${payload.creditsGranted ?? 0} фото. Бесплатный баланс: ${payload.freeImagesRemaining ?? 0} фото.`,
      );
    } catch (error) {
      setPromoError(error instanceof Error ? error.message : "Неизвестная ошибка.");
    } finally {
      setIsApplyingPromo(false);
    }
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

      const attribution = getStoredMarketingAttribution();
      if (attribution) {
        const existingMetadata = sessionData.session?.user.user_metadata ?? {};
        const { error: attributionError } = await supabase.auth.updateUser({
          data: {
            marketing_attribution_first:
              existingMetadata.marketing_attribution_first ?? attribution.first,
            marketing_attribution_last: attribution.last,
          },
        });

        if (attributionError) {
          console.warn("Marketing attribution was not saved", attributionError.message);
        }
      }

      if (selectedPackage.isFree && !hasEnoughPhotoBalance) {
        throw new Error(
          `Для бесплатной генерации нужно ${selectedPackage.imageCount} фото на балансе.`,
        );
      }

      if (!selectedStudioSlug) {
        throw new Error("Сначала выберите интерьер.");
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

      storeBodyProfileForJob(job.id, bodyProfile);

      trackVkGoal("selfies_uploaded", {
        studio_slug: selectedStudioSlug,
        generation_mode: generationMode,
        product_code: selectedPackage.code,
        image_count: selectedPackage.imageCount,
      });

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
          <AuthNavAction />
        </nav>
      </header>

      <section className="upload-layout">
        <div className="upload-copy">
          <p className="eyebrow">Шаг 1 из 3</p>
          <h1>Загрузите фото</h1>
        </div>
      </section>

      {!isAuthenticated ? (
        <section className="section auth-gate">
          <div className="section-header">
            <div>
              <h2>Сначала войдите в аккаунт</h2>
              <p>
                Аккаунт нужен для чеков, оплаты и доступа к вашим фотосессиям.
              </p>
            </div>
            <Link
              className="button button-primary"
              href={`/login?next=${encodeURIComponent(
                selectedStudioSlug ? `/upload?studio=${selectedStudioSlug}` : "/#studios",
              )}`}
            >
              Регистрация/Войти
            </Link>
          </div>
          {authMessage ? <div className="upload-message success">{authMessage}</div> : null}
          {authError ? <div className="upload-message error">{authError}</div> : null}
        </section>
      ) : null}

      {isAuthenticated ? (
        <>
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
                <p>На балансе доступно {freeImagesRemaining} фото.</p>
              </div>
            </div>
            <div className="package-grid">
              {visiblePhotoPackages.map((photoPackage) => {
                const packageCoveredByBalance = freeImagesRemaining >= photoPackage.imageCount;
                const isDisabled = photoPackage.isFree && !packageCoveredByBalance;

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
                    <span>
                      {packageCoveredByBalance ? "С баланса" : formatMoney(photoPackage.amountCents)}
                    </span>
                    <em>{photoPackage.description}</em>
                  </label>
                );
              })}
            </div>
            <div className="promo-code-panel">
              <div>
                <strong>Есть промокод?</strong>
                <span>
                  Введите код, чтобы пополнить баланс на количество фото по условиям
                  промокода.
                </span>
              </div>
              <div className="promo-code-form">
                <input
                  autoComplete="off"
                  onChange={(event) => {
                    setPromoCode(event.target.value);
                    setPromoError(null);
                    setPromoMessage(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void applyPromoCode();
                    }
                  }}
                  placeholder="Введите промокод"
                  type="text"
                  value={promoCode}
                />
                <button
                  className="button button-secondary"
                  disabled={isApplyingPromo}
                  onClick={applyPromoCode}
                  type="button"
                >
                  {isApplyingPromo ? "Проверяем..." : "Применить"}
                </button>
              </div>
              {promoError ? <div className="upload-message error">{promoError}</div> : null}
              {promoMessage ? <div className="upload-message success">{promoMessage}</div> : null}
            </div>
          </section>

          <section className="section child-mode-section">
            <div className="body-profile-panel">
              <div>
                <h2>Телосложение</h2>
                <p>
                  Необязательно. Если заполнить рост и вес, система сама рассчитает
                  ИМТ и подстроит силуэт. Если не заполнять, генерация пойдёт как
                  раньше.
                </p>
              </div>
              <div className="body-profile-fields">
                <label>
                  <span>Рост, см</span>
                  <input
                    inputMode="decimal"
                    onChange={(event) => setHeightCm(event.target.value)}
                    placeholder="Например, 168"
                    type="text"
                    value={heightCm}
                  />
                </label>
                <label>
                  <span>Вес, кг</span>
                  <input
                    inputMode="decimal"
                    onChange={(event) => setWeightKg(event.target.value)}
                    placeholder="Например, 62"
                    type="text"
                    value={weightKg}
                  />
                </label>
              </div>
              {bodyProfile ? (
                <div className="upload-message success">
                  ИМТ {bodyProfile.bmi}: {BODY_BUILD_LABELS[bodyProfile.bodyBuild]}.
                </div>
              ) : hasPartialBodyProfile ? (
                <div className="upload-message muted">
                  Заполните оба поля корректно: рост 120–230 см, вес 30–250 кг.
                  Иначе параметр телосложения не будет применён.
                </div>
              ) : null}
            </div>
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
                  Для детских фото: полностью одетый ребёнок, безопасная поза и
                  одежда по выбранной локации без взрослого делового образа и
                  двусмысленных сцен.
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
        </>
      ) : null}
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

function parseOptionalNumber(value: string) {
  const normalizedValue = value.trim().replace(",", ".");

  if (!normalizedValue) return null;

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function storeBodyProfileForJob(jobId: string, bodyProfile: ReturnType<typeof calculateBodyProfile>) {
  if (typeof window === "undefined") return;

  const key = `virtual-photo-studio:body-profile:${jobId}`;

  if (!bodyProfile) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(bodyProfile));
}
