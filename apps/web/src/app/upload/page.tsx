"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GenerationMode } from "@/lib/types";

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
  {
    title: "Фото немного сверху",
    image: "/selfie-guide/07-from-above.jpg",
  },
  {
    title: "Фото немного снизу",
    image: "/selfie-guide/08-from-below.jpg",
  },
  {
    title: "Фото при дневном свете",
    image: "/selfie-guide/09-daylight.jpg",
  },
  {
    title: "Без солнцезащитных очков и сильных теней",
    image: "/selfie-guide/10-clean-face.jpg",
  },
];

const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,.avif";
const acceptedImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "avif"]);

export default function UploadPage() {
  const router = useRouter();
  const [selfies, setSelfies] = useState<SelectedSelfie[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard");
  const [selectedStudioSlug, setSelectedStudioSlug] = useState("modern-office");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [acceptedPhotoRights, setAcceptedPhotoRights] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const readyCount = selfies.length;
  const isReady = readyCount >= 8;
  const canContinue = isReady && acceptedLegal && acceptedPhotoRights;
  const statusText = useMemo(() => {
    if (readyCount === 0) return "Загрузите 8-10 селфи, чтобы начать.";
    if (readyCount < 8) return `Нужно ещё ${8 - readyCount} фото.`;
    if (readyCount <= 10) return "Набор фото готов для проверки качества.";
    return "Лучше оставить 10 самых разных фото.";
  }, [readyCount]);

  useEffect(() => {
    setSelectedStudioSlug(
      new URLSearchParams(window.location.search).get("studio") ?? "modern-office",
    );
  }, []);

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
      setUploadError("Загрузите минимум 8 фото.");
      return;
    }

    if (!acceptedLegal || !acceptedPhotoRights) {
      setUploadError("Подтвердите согласия перед продолжением.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      let userId = sessionData.session?.user.id;

      if (!userId) {
        const { data: anonymousData, error: authError } =
          await supabase.auth.signInAnonymously();

        if (authError || !anonymousData.user) {
          throw new Error(
            authError?.message
              ? `Не удалось создать анонимную сессию: ${authError.message}`
              : "Не удалось создать анонимную сессию. Включите Anonymous sign-ins в Supabase Auth.",
          );
        }

        userId = anonymousData.user.id;
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
          user_id: userId,
          studio_id: studio.id,
          generation_mode: generationMode,
          status: "draft",
          progress: 0,
        })
        .select("id")
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message ?? "Не удалось создать job.");
      }

      const uploadedRows = [];

      for (const [index, selfie] of selfies.entries()) {
        const filePath = `${userId}/${job.id}/${String(index + 1).padStart(2, "0")}-${sanitizeFileName(selfie.name)}`;
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
          user_id: userId,
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
          Виртуальная AI Фотостудия
        </Link>
        <div className="status">Загрузка селфи для {selectedStudioSlug}</div>
      </header>

      <section className="upload-layout">
        <div className="upload-copy">
          <p className="eyebrow">Шаг 1 из 3</p>
          <h1>Загрузите фото для сохранения похожести</h1>
          <p className="lead">
            Нужны 8-10 обычных фото с телефона: анфас, полуобороты, профиль и
            несколько вариантов освещения. Так итоговая серия лучше сохранит лицо.
          </p>

          <div className="upload-status">
            <strong>{readyCount}/10 фото</strong>
            <span>{statusText}</span>
          </div>

          <div className="mode-panel">
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
          </div>
        </div>

        <label className="upload-dropzone">
          <input accept={acceptedImageTypes} multiple onChange={handleFiles} type="file" />
          <span>Выбрать фото</span>
          <strong>Загрузите 8-10 селфи одним разом</strong>
          <em>JPG, PNG, WEBP, HEIC, HEIF или AVIF</em>
        </label>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Какие фото нужны</h2>
            <p>Сделайте фото на телефон при хорошем свете, без фильтров и сильной ретуши.</p>
          </div>
          <div className="count-pill">Минимум 8 фото</div>
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
          <p>
            Используя сервис Virtual AI Photo Studio, вы соглашаетесь с обработкой
            персональных данных, условиями Пользовательского соглашения и Политикой
            конфиденциальности.
          </p>

          <label className="consent-option">
            <input
              checked={acceptedLegal}
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
