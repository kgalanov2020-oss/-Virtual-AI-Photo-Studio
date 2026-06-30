"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthNavAction } from "@/app/auth-nav-action";
import { formatMoney } from "@/lib/pricing";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GeneratedImage, Job, Order, Studio, UserProfile } from "@/lib/types";

type SessionRow = {
  job: Job;
  studio: Studio | null;
  order: Order | null;
  generatedCount: number;
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

const paymentLabels: Record<Job["payment_status"], string> = {
  unpaid: "Не оплачено",
  pending: "Проверяется",
  paid: "Оплачено",
  refunded: "Возврат",
  failed: "Ошибка оплаты",
};

export default function SessionsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingJobId, setIsDownloadingJobId] = useState<string | null>(null);
  const [isDeletingJobId, setIsDeletingJobId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSessions();
  }, []);

  const totalRemaining = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + Math.max(0, row.job.target_image_count - row.generatedCount),
        0,
      ),
    [rows],
  );

  async function loadSessions() {
    setIsLoading(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setIsLoggedIn(false);
        setRows([]);
        setProfile(null);
        return;
      }

      setIsLoggedIn(true);

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      const jobRows = jobs ?? [];
      const studioIds = Array.from(new Set(jobRows.map((job) => job.studio_id)));
      const jobIds = jobRows.map((job) => job.id);

      const [{ data: studios }, { data: orders }, { data: generatedImages }, { data: profileData }] =
        await Promise.all([
          studioIds.length
            ? supabase.from("studios").select("*").in("id", studioIds)
            : Promise.resolve({ data: [] as Studio[] }),
          jobIds.length
            ? supabase.from("orders").select("*").in("job_id", jobIds)
            : Promise.resolve({ data: [] as Order[] }),
          jobIds.length
            ? supabase.from("generated_images").select("job_id").in("job_id", jobIds)
            : Promise.resolve({ data: [] as Pick<GeneratedImage, "job_id">[] }),
          supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        ]);

      const studioById = new Map((studios ?? []).map((studio) => [studio.id, studio]));
      const orderByJobId = new Map((orders ?? []).map((order) => [order.job_id, order]));
      const generatedCountByJobId = new Map<string, number>();

      for (const image of generatedImages ?? []) {
        generatedCountByJobId.set(image.job_id, (generatedCountByJobId.get(image.job_id) ?? 0) + 1);
      }

      setRows(
        jobRows.map((job) => ({
          job,
          studio: studioById.get(job.studio_id) ?? null,
          order: orderByJobId.get(job.id) ?? null,
          generatedCount: generatedCountByJobId.get(job.id) ?? 0,
        })),
      );
      setProfile((profileData as UserProfile | null) ?? null);
    } catch (sessionsError) {
      setError(
        sessionsError instanceof Error
          ? sessionsError.message
          : "Не удалось загрузить фотосессии.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function downloadArchive(row: SessionRow) {
    if (isDownloadingJobId) return;

    setIsDownloadingJobId(row.job.id);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: images, error: imagesError } = await supabase
        .from("generated_images")
        .select("*")
        .eq("job_id", row.job.id)
        .order("created_at", { ascending: true });

      if (imagesError) throw imagesError;
      if (!images?.length) throw new Error("В этой фотосессии пока нет готовых фото.");

      const zip = await createZip(
        images.map((image, index) => ({
          url: image.image_url,
          name: `${String(index + 1).padStart(2, "0")}-${slugify(row.studio?.name ?? "photo")}.${getImageExtension(image.image_url)}`,
        })),
      );
      const link = document.createElement("a");

      link.href = URL.createObjectURL(zip);
      link.download = `virtual-photo-studio-${row.job.id}.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Не удалось скачать архив.",
      );
    } finally {
      setIsDownloadingJobId(null);
    }
  }

  async function deleteSession(row: SessionRow) {
    if (isDeletingJobId) return;

    const confirmed = window.confirm(
      "Удалить эту фотосессию из списка? Загруженные фото и черновик будут очищены.",
    );

    if (!confirmed) return;

    setIsDeletingJobId(row.job.id);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Нет активной сессии Supabase. Обновите страницу и попробуйте снова.");
      }

      const response = await fetch(`/api/jobs/${row.job.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Не удалось удалить фотосессию.");
      }

      setRows((currentRows) => currentRows.filter((currentRow) => currentRow.job.id !== row.job.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить фотосессию.",
      );
    } finally {
      setIsDeletingJobId(null);
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
          <p className="eyebrow">Личный кабинет</p>
          <h1>Мои фотосессии</h1>
          <p>
            История заказов, статусы генераций, оплаты и готовые архивы.
          </p>
        </div>
      </section>

      <section className="section sessions-section">
        {isLoggedIn === false ? (
          <div className="empty-state">
            <strong>Войдите в аккаунт</strong>
            <span>Фотосессии доступны только владельцу после входа.</span>
            <Link className="button button-primary" href="/login?next=/sessions">
              Регистрация/Войти
            </Link>
          </div>
        ) : null}

        {isLoading && isLoggedIn !== false ? (
          <div className="empty-state">
            <strong>Загружаем фотосессии</strong>
            <span>Получаем ваши заказы и статусы.</span>
          </div>
        ) : null}

        {error ? <div className="upload-message error">{error}</div> : null}

        {!isLoading && isLoggedIn && rows.length === 0 ? (
          <div className="empty-state">
            <strong>Фотосессий пока нет</strong>
            <span>Выберите интерьер и загрузите селфи, чтобы создать первую серию.</span>
            <Link className="button button-primary" href="/">
              Выбрать интерьер
            </Link>
          </div>
        ) : null}

        {!isLoading && isLoggedIn && rows.length > 0 ? (
          <>
            <div className="sessions-summary">
              <div>
                <strong>{rows.length}</strong>
                <span>заказов</span>
              </div>
              <div>
                <strong>{rows.reduce((sum, row) => sum + row.generatedCount, 0)}</strong>
                <span>готовых фото</span>
              </div>
              <div>
                <strong>{profile?.free_images_remaining ?? 0}</strong>
                <span>бесплатных фото</span>
              </div>
              <div>
                <strong>{totalRemaining}</strong>
                <span>ожидает генерации</span>
              </div>
            </div>

            <div className="sessions-list">
              {rows.map((row) => (
                <article className="session-card" key={row.job.id}>
                  <div>
                    <span>{formatDate(row.job.created_at)}</span>
                    <strong>{row.studio?.name ?? "Интерьер"}</strong>
                  </div>
                  <div>
                    <span>Статус</span>
                    <strong>{statusLabels[row.job.status]}</strong>
                  </div>
                  <div>
                    <span>Оплата</span>
                    <strong>
                      {paymentLabels[row.job.payment_status]}
                      {row.order ? ` · ${formatMoney(row.order.amount_cents, row.order.currency)}` : ""}
                    </strong>
                  </div>
                  <div>
                    <span>Фото</span>
                    <strong>
                      {row.generatedCount}/{row.job.target_image_count}
                    </strong>
                  </div>
                  <div className="session-actions">
                    <Link className="button button-secondary" href={`/generation/${row.job.id}`}>
                      Открыть
                    </Link>
                    <button
                      className="button button-secondary"
                      disabled={row.generatedCount === 0 || isDownloadingJobId === row.job.id}
                      onClick={() => downloadArchive(row)}
                      type="button"
                    >
                      {isDownloadingJobId === row.job.id ? "Архив..." : "Скачать архив"}
                    </button>
                    <Link
                      className="button button-primary"
                      href={`/upload?studio=${row.studio?.slug ?? ""}`}
                    >
                      Повторить
                    </Link>
                    <button
                      className="button button-danger"
                      disabled={isDeletingJobId === row.job.id}
                      onClick={() => deleteSession(row)}
                      type="button"
                    >
                      {isDeletingJobId === row.job.id ? "Удаляем..." : "Удалить"}
                    </button>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
