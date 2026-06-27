"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getTargetShots, getTargetVariationCount, isTargetVariation } from "@/lib/generation";
import { translateShot } from "@/lib/ru";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GeneratedImage, GenerationMode, Job, StudioShot } from "@/lib/types";

type GenerationPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

type GenerationShot = StudioShot & {
  generated: GeneratedImage[];
};

type GenerationResponse = {
  ok?: boolean;
  done?: boolean;
  completed?: number;
  total?: number;
  error?: string;
  provider?: string;
};

const statusLabels: Record<Job["status"], string> = {
  draft: "Черновик",
  awaiting_payment: "Ожидает оплату",
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
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard");
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ jobId: resolvedJobId }) => {
      setJobId(resolvedJobId);
      loadGeneration(resolvedJobId);
    });
  }, [params]);

  const totalExpected = useMemo(
    () => getTargetShots(shots).reduce((sum, shot) => sum + getTargetVariationCount(shot), 0),
    [shots],
  );

  const totalGenerated = useMemo(
    () => getTargetShots(shots).reduce((sum, shot) => sum + shot.generated.length, 0),
    [shots],
  );

  async function loadGeneration(resolvedJobId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, user_id, studio_id, generation_mode, status, payment_status, paid_at, amount_cents, currency, product_code, progress, error_message, created_at, queued_at, started_at, completed_at")
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
        generated: generated.filter(
          (image) => image.studio_shot_id === shot.id && isTargetVariation(image.variation_index),
        ),
      }));

      setJob(currentJob);
      setGenerationMode(currentJob.generation_mode ?? "standard");
      setShots(nextShots);
      setError(activeError);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Неизвестная ошибка.");
    } finally {
      setIsLoading(false);
    }
  }

  async function startGeneration() {
    if (!jobId || isStartingGeneration) return;

    setIsStartingGeneration(true);
    setError(null);
    setMessage("Отправляем задачу в AI-генератор. Первый запуск может занять несколько минут.");

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

        const data = (await response.json()) as GenerationResponse;

        if (!response.ok || data.error) {
          throw new Error(data.error ?? "AI-генератор вернул ошибку.");
        }

        isDone = Boolean(data.done);
        setMessage(
          data.total
            ? `AI-генератор создал ${data.completed ?? 0}/${data.total} изображений.`
            : "AI-генератор создал изображение.",
        );
        await loadGeneration(jobId);
      }

      setMessage("Фотосессия готова: все изображения сохранены в Supabase.");
    } catch (runPodError) {
      setError(runPodError instanceof Error ? runPodError.message : "Неизвестная ошибка.");
    } finally {
      setIsStartingGeneration(false);
    }
  }

  async function toggleChildSafeMode() {
    if (!jobId || isUpdatingMode) return;

    const nextMode: GenerationMode = generationMode === "child_safe" ? "standard" : "child_safe";

    setIsUpdatingMode(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const updatePayload: Partial<Job> = {
        generation_mode: nextMode,
        error_message: null,
      };

      if (job?.status === "failed") {
        updatePayload.status = "queued";
        updatePayload.progress = Math.max(job.progress, 5);
        updatePayload.queued_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("jobs")
        .update(updatePayload)
        .eq("id", jobId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setGenerationMode(nextMode);
      setMessage(
        nextMode === "child_safe"
          ? "Детский безопасный режим включён для этой фотосессии."
          : "Стандартный режим включён для этой фотосессии.",
      );
      await loadGeneration(jobId);
    } catch (modeError) {
      setError(modeError instanceof Error ? modeError.message : "Не удалось изменить режим.");
    } finally {
      setIsUpdatingMode(false);
    }
  }

  async function downloadAllImages() {
    if (!totalGenerated || isDownloadingAll) return;

    setIsDownloadingAll(true);
    setError(null);

    try {
      const files = shots.flatMap((shot, shotIndex) =>
        shot.generated.map((image, imageIndex) => ({
          url: image.image_url,
          name: `${String(shotIndex + 1).padStart(2, "0")}-${slugify(shot.name)}-${imageIndex + 1}.${getImageExtension(image.image_url)}`,
        })),
      );
      const zip = await createZip(files);
      const link = document.createElement("a");

      link.href = URL.createObjectURL(zip);
      link.download = `ai-photo-studio-${jobId}.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Не удалось скачать изображения.",
      );
    } finally {
      setIsDownloadingAll(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          Виртуальная AI Фотостудия
        </Link>
        <div className="status">Очередь генерации фотосессии</div>
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
          <p>{job?.payment_status === "paid" ? "Оплачено" : "Оплата не подтверждена"}</p>
          <p>{generationMode === "child_safe" ? "Детский безопасный режим" : "Стандартный режим"}</p>
          <small>Job: {jobId || "загрузка..."}</small>
        </aside>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>План генерации</h2>
            <p>
              Будет создано {totalExpected} фото: 10 разных позиций и 4 дистанции
              камеры для каждой позиции.
            </p>
          </div>
          <button
            className="button button-secondary"
            disabled={isLoading}
            onClick={() => loadGeneration(jobId)}
            type="button"
          >
            Проверить статус
          </button>
          <button
            className="button button-secondary"
            disabled={isLoading || isUpdatingMode || isStartingGeneration}
            onClick={toggleChildSafeMode}
            type="button"
          >
            {generationMode === "child_safe" ? "Стандартный режим" : "Детский режим"}
          </button>
          <Link className="button button-secondary" href="/upload">
            Новая фотосессия
          </Link>
          <button
            className="button button-secondary"
            disabled={isLoading || isDownloadingAll || totalGenerated === 0}
            onClick={downloadAllImages}
            type="button"
          >
            {isDownloadingAll ? "Готовим архив..." : "Скачать все"}
          </button>
          <button
            className="button button-primary"
            disabled={isLoading || isStartingGeneration || !job || job.payment_status !== "paid" || !["queued", "running"].includes(job.status)}
            onClick={startGeneration}
            type="button"
          >
            {isStartingGeneration ? "Идёт генерация..." : "Запустить генерацию"}
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
                {job?.payment_status !== "paid"
                  ? "Для запуска генерации нужно оплатить пакет фотосессии."
                  : job?.status === "completed"
                  ? "Фотосессия готова. Можно скачать отдельные фото или весь архив."
                  : totalGenerated > 0
                    ? "Генерация идёт. Нажмите «Проверить статус», чтобы подтянуть новые варианты."
                    : "Нажмите «Запустить генерацию», чтобы создать фотосессию."}
              </span>
              {job?.payment_status !== "paid" ? (
                <Link className="button button-primary" href={`/checkout/${jobId}`}>
                  Перейти к оплате
                </Link>
              ) : null}
            </div>

            <div className="generation-grid">
              {getTargetShots(shots).map((shot, shotIndex) => (
                <article className="generation-card" key={shot.id}>
                  <div className="generation-card-top">
                    <span>{shotIndex + 1}</span>
                    <strong>{shot.name}</strong>
                  </div>
                  <p>{shot.pose}</p>
                  <div className="generation-slots">
                    {Array.from({ length: getTargetVariationCount(shot) }).map((_, index) => {
                      const generatedImage = shot.generated[index];
                      return generatedImage ? (
                        <div className="generated-thumb" key={generatedImage.id}>
                          <img
                            alt={`${shot.name} вариант ${index + 1}`}
                            src={generatedImage.image_url}
                          />
                          <a
                            download={`${slugify(shot.name)}-${index + 1}.${getImageExtension(generatedImage.image_url)}`}
                            href={generatedImage.image_url}
                          >
                            Скачать
                          </a>
                        </div>
                      ) : (
                        <div className="generation-slot" key={`${shot.id}-${index}`}>
                          Фото
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function getImageExtension(url: string) {
  const path = url.split("?")[0] ?? "";
  const extension = path.split(".").pop()?.toLowerCase();

  return extension && ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
}

async function createZip(files: Array<{ url: string; name: string }>) {
  const entries = await Promise.all(
    files.map(async (file) => {
      const response = await fetch(file.url);

      if (!response.ok) {
        throw new Error(`Не удалось скачать файл ${file.name}.`);
      }

      return {
        name: file.name,
        bytes: new Uint8Array(await response.arrayBuffer()),
      };
    }),
  );

  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const localHeader = new Uint8Array(30 + fileName.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.bytes.length, true);
    localView.setUint32(22, entry.bytes.length, true);
    localView.setUint16(26, fileName.length, true);
    localHeader.set(fileName, 30);

    localParts.push(localHeader, entry.bytes);

    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.bytes.length, true);
    centralView.setUint32(24, entry.bytes.length, true);
    centralView.setUint16(28, fileName.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(fileName, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + entry.bytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const blobParts = [...localParts, ...centralParts, endHeader].map((part) => {
    const copy = new Uint8Array(part.byteLength);

    copy.set(part);
    return copy.buffer;
  });

  return new Blob(blobParts, { type: "application/zip" });
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
