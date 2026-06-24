"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { UploadedSelfie } from "@/lib/types";

type QualityPhoto = UploadedSelfie & {
  signedUrl: string | null;
};

type QualityPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

export default function QualityPage({ params }: QualityPageProps) {
  const [jobId, setJobId] = useState<string>("");
  const [photos, setPhotos] = useState<QualityPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ jobId: resolvedJobId }) => {
      setJobId(resolvedJobId);
      loadPhotos(resolvedJobId);
    });
  }, [params]);

  const approvedCount = useMemo(
    () => photos.filter((photo) => photo.is_approved).length,
    [photos],
  );

  async function loadPhotos(resolvedJobId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: selfiesError } = await supabase
        .from("uploaded_selfies")
        .select(
          "id, job_id, user_id, file_url, quality_score, face_angle, is_approved, rejection_reason, created_at",
        )
        .eq("job_id", resolvedJobId)
        .order("created_at", { ascending: true });

      if (selfiesError) {
        throw new Error(selfiesError.message);
      }

      const rows = (data ?? []) as UploadedSelfie[];
      const signedPhotos = await Promise.all(
        rows.map(async (row) => {
          const { data: signedData } = await supabase.storage
            .from("selfies")
            .createSignedUrl(row.file_url, 60 * 30);

          return {
            ...row,
            signedUrl: signedData?.signedUrl ?? null,
          };
        }),
      );

      setPhotos(signedPhotos);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Неизвестная ошибка.");
    } finally {
      setIsLoading(false);
    }
  }

  async function approveAll() {
    if (!jobId || photos.length === 0 || isApproving) return;

    setIsApproving(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("uploaded_selfies")
        .update({
          is_approved: true,
          rejection_reason: null,
        })
        .eq("job_id", jobId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: jobError } = await supabase
        .from("jobs")
        .update({
          status: "queued",
          progress: 5,
          queued_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (jobError) {
        throw new Error(jobError.message);
      }

      setPhotos((current) =>
        current.map((photo) => ({
          ...photo,
          is_approved: true,
          rejection_reason: null,
        })),
      );
      setMessage("Фото приняты. Job переведён в очередь генерации.");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Неизвестная ошибка.");
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          Виртуальная AI Фотостудия
        </Link>
        <div className="status">Проверка качества фото</div>
      </header>

      <section className="quality-hero">
        <div>
          <p className="eyebrow">Шаг 2 из 3</p>
          <h1>Проверка качества</h1>
          <p className="lead">
            Сейчас это MVP-проверка: показываем загруженные фото и вручную принимаем
            набор для генерации. Позже сюда подключим автоматическое определение лица,
            размытия, освещения и дублей.
          </p>
        </div>
        <div className="quality-summary">
          <strong>{approvedCount}/{photos.length} принято</strong>
          <span>Job: {jobId || "загрузка..."}</span>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Загруженные фото</h2>
            <p>Для генерации нужно минимум 8 подходящих фото.</p>
          </div>
          <button
            className="button button-primary"
            disabled={photos.length < 8 || isApproving}
            onClick={approveAll}
            type="button"
          >
            {isApproving ? "Принимаем..." : "Принять фото и поставить в очередь"}
          </button>
        </div>

        {isLoading ? (
          <div className="empty-state">
            <strong>Загружаем фото</strong>
            <span>Получаем данные из Supabase Storage.</span>
          </div>
        ) : null}

        {!isLoading && photos.length === 0 ? (
          <div className="empty-state">
            <strong>Фото не найдены</strong>
            <span>Проверьте, что job создан и файлы загрузились.</span>
          </div>
        ) : null}

        {photos.length > 0 ? (
          <div className="quality-grid">
            {photos.map((photo, index) => (
              <article className="quality-card" key={photo.id}>
                {photo.signedUrl ? (
                  <img alt={`Фото ${index + 1}`} src={photo.signedUrl} />
                ) : (
                  <div className="quality-placeholder">Нет превью</div>
                )}
                <div className="quality-card-body">
                  <strong>Фото {index + 1}</strong>
                  <span className={photo.is_approved ? "badge ok" : "badge pending"}>
                    {photo.is_approved ? "Принято" : "Ожидает проверки"}
                  </span>
                  <p>{photo.file_url.split("/").pop()}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {error ? <div className="upload-message error">{error}</div> : null}
        {message ? <div className="upload-message success">{message}</div> : null}
      </section>
    </main>
  );
}
