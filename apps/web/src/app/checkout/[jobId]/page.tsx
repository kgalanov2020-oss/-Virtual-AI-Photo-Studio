"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  getPhotoPackage,
} from "@/lib/pricing";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Job } from "@/lib/types";

type CheckoutResponse = {
  ok?: boolean;
  paid?: boolean;
  checkoutUrl?: string;
  redirectUrl?: string;
  error?: string;
};

export default function CheckoutPage() {
  const params = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const jobId = params.jobId;
  const sessionId = searchParams.get("session_id");
  const paymentReturn = searchParams.get("payment_return");
  const cancelled = searchParams.get("cancelled");
  const [job, setJob] = useState<Job | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activePackage = useMemo(() => getPhotoPackage(job?.product_code), [job?.product_code]);
  const price = useMemo(
    () => formatMoney(activePackage.amountCents, job?.currency),
    [job?.currency, activePackage.amountCents],
  );

  useEffect(() => {
    loadCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (sessionId) {
      confirmPayment(sessionId);
    } else if (paymentReturn) {
      confirmLatestPendingPayment();
    } else if (cancelled) {
      setMessage("Оплата отменена. Можно попробовать ещё раз.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, paymentReturn, cancelled]);

  async function loadCheckout() {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmail = sessionData.session?.user.email;
      const { data, error: jobError } = await supabase
        .from("jobs")
        .select("id, user_id, studio_id, generation_mode, status, payment_status, paid_at, amount_cents, currency, product_code, target_image_count, progress, error_message, created_at, queued_at, started_at, completed_at")
        .eq("id", jobId)
        .single();

      if (jobError) {
        throw new Error(jobError.message);
      }

      setJob(data as Job);
      if (sessionEmail) {
        setCustomerEmail(sessionEmail);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить заказ.");
    } finally {
      setIsLoading(false);
    }
  }

  async function startPayment() {
    if (isPaying) return;

    setIsPaying(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Нет активной сессии Supabase. Обновите страницу и попробуйте снова.");
      }

      const response = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId, email: customerEmail.trim() }),
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Не удалось создать оплату.");
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (!data.checkoutUrl) {
        throw new Error("Платёжная система не вернула ссылку на оплату.");
      }

      window.location.href = data.checkoutUrl;
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Ошибка оплаты.");
      setIsPaying(false);
    }
  }

  async function confirmLatestPendingPayment() {
    setIsPaying(true);
    setError(null);
    setMessage("Проверяем платёж...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: orders, error: orderError } = await supabase
        .from("orders")
        .select("provider_session_id")
        .eq("job_id", jobId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (orderError) {
        throw new Error(orderError.message);
      }

      const paymentId = orders?.[0]?.provider_session_id;
      if (!paymentId) {
        throw new Error("Не найден ожидающий платёж для этого заказа.");
      }

      await confirmPayment(paymentId);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Ошибка подтверждения оплаты.");
      setIsPaying(false);
    }
  }

  async function confirmPayment(activeSessionId: string) {
    setIsPaying(true);
    setError(null);
    setMessage("Проверяем оплату...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Нет активной сессии Supabase. Обновите страницу и попробуйте снова.");
      }

      const response = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId, sessionId: activeSessionId }),
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Не удалось подтвердить оплату.");
      }

      setMessage("Оплата подтверждена. Переходим к генерации.");
      window.location.href = data.redirectUrl ?? `/generation/${jobId}`;
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Ошибка подтверждения оплаты.");
    } finally {
      setIsPaying(false);
      await loadCheckout();
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          Виртуальная AI Фотостудия
        </Link>
        <div className="status">Оплата фотосессии</div>
      </header>

      <section className="checkout-layout">
        <div>
          <p className="eyebrow">Шаг оплаты</p>
          <h1>Оплатите генерацию</h1>
          <p className="lead">
            Фото уже загружены и приняты. После оплаты заказ перейдёт в очередь, и
            можно будет запустить AI-генерацию.
          </p>
        </div>

        <aside className="checkout-card">
          <span>Пакет</span>
          <strong>{activePackage.name}</strong>
          <p>{activePackage.description}</p>
          <div className="checkout-price">{price}</div>
          <label className="checkout-field">
            <span>Email для чека</span>
            <input
              autoComplete="email"
              disabled={isLoading || isPaying || job?.payment_status === "paid"}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={customerEmail}
            />
          </label>
          <div className={job?.payment_status === "paid" ? "badge ok" : "badge pending"}>
            {job?.payment_status === "paid" ? "Оплачено" : "Ожидает оплату"}
          </div>
          <button
            className="button button-primary"
            disabled={isLoading || isPaying || job?.payment_status === "paid"}
            onClick={startPayment}
            type="button"
          >
            {isPaying ? "Переходим к оплате..." : "Оплатить и продолжить"}
          </button>
          {job?.payment_status === "paid" ? (
            <Link className="button button-secondary" href={`/generation/${jobId}`}>
              Перейти к генерации
            </Link>
          ) : null}
        </aside>
      </section>

      <section className="section">
        <div className="empty-state">
          <strong>Что входит</strong>
          <span>
            40 фото в выбранном интерьере: 10 профессионально поставленных сцен и 4
            дистанции камеры для каждой сцены.
          </span>
        </div>
        {error ? <div className="upload-message error">{error}</div> : null}
        {message ? <div className="upload-message success">{message}</div> : null}
      </section>
    </main>
  );
}
