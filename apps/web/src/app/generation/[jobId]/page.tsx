"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { translateShot } from "@/lib/ru";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GeneratedImage, Job, StudioShot } from "@/lib/types";

type GenerationPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

type GenerationShot = StudioShot & {
  generated: GeneratedImage[];
};

type RunPodResponse = {
  ok?: boolean;
  done?: boolean;
  completed?: number;
  total?: number;
  error?: string;
};

const statusLabels: Record<Job["status"], string> = {
  draft: "Черновик",
  queued: "В очереди",
  running: "Генерация",
  completed: "Готово",
  failed: "Ошибка",
  cancelled: "Отменено",
};

export default function GenerationPage({ params }: GenerationPageProps) {
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [shots, setShots] = useState<GenerationShot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingRunPod, setIsStartingRunPod] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ jobId: resolvedJobId }) => {
      setJobId(resolvedJobId);
      loadGeneration(resolvedJobId);
    });
  }, [params]);

  const totalExpected = useMemo(
    () => shots.reduce((sum, shot) => sum + shot.variations, 0),
    [shots],
  );

  const totalGenerated = useMemo(
    () => shots.reduce((sum, shot) => sum + shot.generated.length, 0),
    [shots],
  );

  async function loadGeneration(resolvedJobId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, user_id, studio_id, status, progress, error_message, created_at, queued_at, started_at, completed_at")
        .eq("id", resolvedJobId)
        .single();

      if (jobError) {
        throw new Error(jobError.message);
      }

      const currentJob = jobData as Job;
      const activeError =
        currentJob.status === "failed" ? currentJob.error_message : null;

      const [{ data: shotData, error: shotError }, { data: imageData, error: imageError }] =
        await Promise.all([
          supabase
            .from("studio_shots")
            .select(
              "id, studio_id, slug, name, camera_angle, pose, crop, prompt, negative_prompt, variations, sort_order, created_at",
            )
            .eq("studio_id", currentJob.studio_id)
            .order("sort_order", { ascending: true }),
          supabase
            .from("generated_images")
            .select(
              "id, job_id, user_id, studio_shot_id, image_url, seed, variation_index, is_favorite, created_at",
            )
            .eq("job_id", resolvedJobId)
            .order("created_at", { ascending: true }),
        ]);

      if (shotError) {
        throw new Error(shotError.message);
      }

      if (imageError) {
        throw new Error(imageError.message);
      }

      const generated = (imageData ?? []) as GeneratedImage[];
      const nextShots = ((shotData ?? []) as StudioShot[]).map((shot) => ({
        ...translateShot(shot),
        generated: generated.filter((image) => image.studio_shot_id === shot.id),
      }));

      setJob(currentJob);
      setShots(nextShots);
      setError(activeError);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Неизвестная ошибка.");
    } finally {
      setIsLoading(false);
    }
  }

  async function startRunPodGeneration() {
    if (!jobId || isStartingRunPod) return;

    setIsStartingRunPod(true);
    setError(null);
    setMessage("Отправляем задачу в RunPod/ComfyUI. Первый запуск может занять 1-3 минуты.");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Нет активной сессии Supabase. Обновите страницу и попробуйте снова.");
      }

      let isDone = false;

      while (!isDone) {
        const response = await fetch(`/api/jobs/${jobId}/runpod`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = (await response.json()) as RunPodResponse;

        if (!response.ok || data.error) {
          throw new Error(data.error ?? "RunPod вернул ошибку.");
        }

        isDone = Boolean(data.done);
        setMessage(
          data.total
            ? `RunPod сгенерировал ${data.completed ?? 0}/${data.total} изображений.`
            : "RunPod сгенерировал изображение.",
        );
        await loadGeneration(jobId);
      }

      setMessage("Фотосессия готова: все изображения сохранены в Supabase.");
    } catch (runPodError) {
      setError(runPodError instanceof Error ? runPodError.message : "Неизвестная ошибка.");
    } finally {
      setIsStartingRunPod(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          Виртуальная AI Фотостудия
        </Link>
        <div className="status">Очередь генерации для Modern Business Studio</div>
      </header>

      <section className="generation-hero">
        <div>
          <p className="eyebrow">Шаг 3 из 3</p>
          <h1>Генерация фотосессии</h1>
          <p className="lead">
            Фото приняты и заявка поставлена в очередь. На этом экране будет видно
            выполнение AI-генерации и готовые варианты по каждому ракурсу.
          </p>
        </div>

        <aside className="generation-summary">
          <span>Статус</span>
          <strong>{job ? statusLabels[job.status] : "Загрузка..."}</strong>
          <div className="progress-bar">
            <div style={{ width: `${job?.progress ?? 0}%` }} />
          </div>
          <p>{job?.progress ?? 0}% готово</p>
          <small>Job: {jobId || "загрузка..."}</small>
        </aside>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>План генерации</h2>
            <p>
              Будет создано {totalExpected} вариантов: по несколько изображений на каждый
              утверждённый ракурс студии.
            </p>
          </div>
          <button
            className="button button-secondary"
            disabled={isLoading}
            onClick={() => loadGeneration(jobId)}
            type="button"
          >
            Обновить статус
          </button>
          <button
            className="button button-primary"
            disabled={isLoading || isStartingRunPod || !job || !["queued", "running"].includes(job.status)}
            onClick={startRunPodGeneration}
            type="button"
          >
            {isStartingRunPod ? "RunPod генерирует..." : "Запустить RunPod"}
          </button>
        </div>

        {isLoading ? (
          <div className="empty-state">
            <strong>Загружаем очередь</strong>
            <span>Получаем job, ракурсы и будущие результаты из Supabase.</span>
          </div>
        ) : null}

        {error ? <div className="upload-message error">{error}</div> : null}
        {message ? <div className="upload-message success">{message}</div> : null}

        {!isLoading && !error ? (
          <>
            <div className="queue-panel">
              <strong>{totalGenerated}/{totalExpected} изображений готово</strong>
              <span>
                Следующий этап - подключить AI worker, который возьмёт jobs со статусом
                queued, запустит генерацию и запишет результаты в generated_images.
              </span>
            </div>

            <div className="generation-grid">
              {shots.map((shot, shotIndex) => (
                <article className="generation-card" key={shot.id}>
                  <div className="generation-card-top">
                    <span>{shotIndex + 1}</span>
                    <strong>{shot.name}</strong>
                  </div>
                  <p>{shot.pose}</p>
                  <div className="generation-slots">
                    {Array.from({ length: shot.variations }).map((_, index) => {
                      const generatedImage = shot.generated[index];
                      return generatedImage ? (
                        <img
                          alt={`${shot.name} вариант ${index + 1}`}
                          key={generatedImage.id}
                          src={generatedImage.image_url}
                        />
                      ) : (
                        <div className="generation-slot" key={`${shot.id}-${index}`}>
                          Вариант {index + 1}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
