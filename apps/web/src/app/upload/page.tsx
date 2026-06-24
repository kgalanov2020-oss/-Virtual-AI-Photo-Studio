"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type SelectedSelfie = {
  id: string;
  file: File;
  name: string;
  size: number;
  url: string;
};

const selfieGuide = [
  "Анфас с нейтральным выражением лица",
  "Анфас с лёгкой улыбкой",
  "Левый полуоборот",
  "Правый полуоборот",
  "Левый профиль",
  "Правый профиль",
  "Фото немного сверху",
  "Фото немного снизу",
  "Фото при дневном свете",
  "Без солнцезащитных очков и сильных теней",
];

export default function UploadPage() {
  const [selfies, setSelfies] = useState<SelectedSelfie[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const readyCount = selfies.length;
  const isReady = readyCount >= 8;
  const statusText = useMemo(() => {
    if (readyCount === 0) return "Загрузите 8-10 селфи, чтобы начать.";
    if (readyCount < 8) return `Нужно ещё ${8 - readyCount} фото.`;
    if (readyCount <= 10) return "Набор фото готов для проверки качества.";
    return "Лучше оставить 10 самых разных фото.";
  }, [readyCount]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith("image/"))
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
    if (!isReady || isUploading) return;

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
        .eq("slug", "modern-business-studio")
        .single();

      if (studioError || !studio) {
        throw new Error(studioError?.message ?? "Студия не найдена.");
      }

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          user_id: userId,
          studio_id: studio.id,
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
        <div className="status">Загрузка селфи для Modern Business Studio</div>
      </header>

      <section className="upload-layout">
        <div className="upload-copy">
          <p className="eyebrow">Шаг 1 из 3</p>
          <h1>Загрузите 8-10 селфи</h1>
          <p className="lead">
            Нужны разные ракурсы лица, чтобы AI лучше сохранил похожесть в готовой
            бизнес-фотосессии.
          </p>

          <div className="upload-status">
            <strong>{readyCount}/10 фото</strong>
            <span>{statusText}</span>
          </div>
        </div>

        <label className="upload-dropzone">
          <input accept="image/*" multiple onChange={handleFiles} type="file" />
          <span>Выбрать фото</span>
          <strong>JPG, PNG или HEIC</strong>
          <em>Можно выбрать сразу несколько файлов</em>
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
            <article className="guide-card" key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Выбранные фото</h2>
            <p>Пока это локальное превью. Следующий шаг - отправка в Supabase Storage.</p>
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
            disabled={!isReady || isUploading}
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
