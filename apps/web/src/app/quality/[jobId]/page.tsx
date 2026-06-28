"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GenerationMode, UploadedSelfie } from "@/lib/types";

type QualityPhoto = UploadedSelfie & {
  signedUrl: string | null;
};

type QualityPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

export default function QualityPage({ params }: QualityPageProps) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string>("");
  const [photos, setPhotos] = useState<QualityPhoto[]>([]);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard");
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
      const [{ data: jobData }, { data, error: selfiesError }] = await Promise.all([
        supabase
          .from("jobs")
          .select("generation_mode")
          .eq("id", resolvedJobId)
          .single(),
        supabase
        .from("uploaded_selfies")
        .select(
          "id, job_id, user_id, file_url, quality_score, face_angle, is_approved, rejection_reason, created_at",
        )
          .eq("job_id", resolvedJobId)
          .order("created_at", { ascending: true }),
      ]);

      if (selfiesError) {
        throw new Error(selfiesError.message);
      }

      setGenerationMode((jobData?.generation_mode as GenerationMode | undefined) ?? "standard");

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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Нет активной сессии Supabase. Обновите страницу и попробуйте снова.");
      }

      const response = await fetch(`/api/jobs/${jobId}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        job?: { status?: string };
      };

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Не удалось принять фото.");
      }

      setPhotos((current) =>
        current.map((photo) => ({
          ...photo,
          is_approved: true,
          rejection_reason: null,
        })),
      );
      if (data.job?.status === "awaiting_payment") {
        setMessage("Фото приняты. Переходим к оплате фотосессии.");
        router.push(`/checkout/${jobId}`);
        return;
      }

      setMessage("Фото приняты. Переходим к генерации фотосессии.");
      router.push(`/generation/${jobId}`);
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
          <p className="lead">Проверьте загруженные фото перед запуском фотосессии.</p>
        </div>
        <div className="quality-summary">
          <strong>{approvedCount}/{photos.length} принято</strong>
          <span>{generationMode === "child_safe" ? "Детский безопасный режим" : "Стандартный режим"}</span>
          <span>Job: {jobId || "загрузка..."}</span>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Загруженные фото</h2>
            <p>Для генерации нужно минимум 6 подходящих фото.</p>
          </div>
          <button
            className="button button-primary"
            disabled={photos.length < 6 || isApproving}
            onClick={approveAll}
            type="button"
          >
            {isApproving ? "Принимаем..." : "Принять фото и перейти к генерации"}
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
