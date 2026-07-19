"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PaymentSuccessGoalPayload } from "@/lib/payment-conversion";
import { pollPaymentReturn } from "@/lib/payment-return-polling.mjs";
import {
  formatMoney,
  getPhotoPackage,
} from "@/lib/pricing";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Job } from "@/lib/types";
import { trackVkGoal } from "@/lib/vk-pixel";
import { trackYandexGoal } from "@/lib/yandex-metrika";

type CheckoutResponse = {
  ok?: boolean;
  paid?: boolean;
  checkoutUrl?: string;
  redirectUrl?: string;
  balancePaid?: boolean;
  paymentSuccessGoal?: PaymentSuccessGoalPayload | null;
  code?: "PAYMENT_PENDING" | "PAYMENT_CANCELED";
  error?: string;
};

type ConfirmationResult =
  | { kind: "confirmed" }
  | { kind: "pending" }
  | { kind: "fatal"; error: string }
  | { kind: "aborted" };

const trackedCheckoutGoals = new Set<string>();

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
  const [photoBalance, setPhotoBalance] = useState(0);

  const activePackage = useMemo(() => getPhotoPackage(job?.product_code), [job?.product_code]);
  const canUsePhotoBalance = photoBalance >= activePackage.imageCount;
  const price = useMemo(
    () => (canUsePhotoBalance ? "С баланса" : formatMoney(activePackage.amountCents, job?.currency)),
    [job?.currency, activePackage.amountCents, canUsePhotoBalance],
  );

  useEffect(() => {
    loadCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (cancelled) {
      setMessage("Оплата отменена. Можно попробовать ещё раз.");
      return;
    }

    if (!sessionId && !paymentReturn) {
      return;
    }

    const controller = new AbortController();
    setIsPaying(true);
    setError(null);
    setMessage("Проверяем оплату...");

    void pollPaymentReturn({
      signal: controller.signal,
      confirm: () =>
        confirmPayment(sessionId ?? undefined, {
          polling: true,
          signal: controller.signal,
          silent: true,
        }),
    })
      .then(async (result) => {
        if (controller.signal.aborted || result.kind === "confirmed") return;

        setIsPaying(false);
        await loadCheckout();
        if (controller.signal.aborted) return;

        if (result.kind === "timeout") {
          setMessage(null);
          setError(
            "Платёж ещё обрабатывается. Нажмите «Проверить оплату» через минуту — повторно платить не нужно.",
          );
        } else if (result.kind === "fatal") {
          setMessage(null);
          setError(result.error);
        }
      })
      .catch((pollError) => {
        if (controller.signal.aborted) return;
        setIsPaying(false);
        setMessage(null);
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Не удалось проверить оплату. Повторно платить не нужно.",
        );
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, paymentReturn, cancelled, jobId]);

  async function loadCheckout() {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmail = sessionData.session?.user.email;
      const [{ data, error: jobError }, { data: profileData }] = await Promise.all([
        supabase
        .from("jobs")
        .select("id, user_id, studio_id, generation_mode, status, payment_status, paid_at, amount_cents, currency, product_code, target_image_count, progress, error_message, created_at, queued_at, started_at, completed_at")
        .eq("id", jobId)
          .single(),
        supabase
          .from("user_profiles")
          .select("free_images_remaining")
          .maybeSingle(),
      ]);

      if (jobError) {
        throw new Error(jobError.message);
      }

      setJob(data as Job);
      setPhotoBalance(profileData?.free_images_remaining ?? 0);
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

      if (data.balancePaid) {
        setMessage("Заказ оплачен с баланса фото. Переходим к генерации.");
        trackCheckoutGoalOnce("purchase", "balance", {
          product_code: activePackage.code,
          image_count: activePackage.imageCount,
          payment_method: "balance",
          value: 0,
        });
        trackCheckoutGoalOnce("generation_started", "balance", {
          product_code: activePackage.code,
          image_count: activePackage.imageCount,
          payment_method: "balance",
        });
      }

      if (data.paymentSuccessGoal) {
        await trackConfirmedPaymentGoals(data.paymentSuccessGoal, token);
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (!data.checkoutUrl) {
        throw new Error("Платёжная система не вернула ссылку на оплату.");
      }

      trackCheckoutGoalOnce("payment_started", "yookassa", {
        product_code: activePackage.code,
        image_count: activePackage.imageCount,
        payment_method: "yookassa",
        value: activePackage.amountCents / 100,
      });

      window.location.href = data.checkoutUrl;
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Ошибка оплаты.");
      setIsPaying(false);
    }
  }

  async function confirmLatestPendingPayment(options: { silent?: boolean } = {}) {
    await confirmPayment(undefined, options);
  }

  async function confirmPayment(
    activeSessionId?: string,
    options: {
      polling?: boolean;
      signal?: AbortSignal;
      silent?: boolean;
    } = {},
  ): Promise<ConfirmationResult> {
    if (!options.silent) {
      setIsPaying(true);
      setError(null);
      setMessage("Проверяем оплату...");
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Нет активной сессии Supabase. Обновите страницу и попробуйте снова.");
      }

      const response = await fetch("/api/payments/confirm", {
        method: "POST",
        signal: options.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId, sessionId: activeSessionId }),
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || data.error) {
        if (
          options.polling &&
          response.status === 409 &&
          data.code === "PAYMENT_PENDING"
        ) {
          return { kind: "pending" };
        }
        throw new Error(data.error ?? "Не удалось подтвердить оплату.");
      }

      if (data.paymentSuccessGoal) {
        await trackConfirmedPaymentGoals(data.paymentSuccessGoal, token);
      }

      setMessage("Оплата подтверждена. Переходим к генерации.");
      window.location.href = data.redirectUrl ?? `/generation/${jobId}`;
      return { kind: "confirmed" };
    } catch (confirmError) {
      if (options.signal?.aborted || isAbortError(confirmError)) {
        return { kind: "aborted" };
      }

      const errorMessage =
        confirmError instanceof Error ? confirmError.message : "Ошибка подтверждения оплаты.";

      if (!options.silent) {
        setMessage(null);
        setError(errorMessage);
      }
      return { kind: "fatal", error: errorMessage };
    } finally {
      if (!options.silent && !options.signal?.aborted) {
        setIsPaying(false);
      }
    }
  }

  async function trackConfirmedPaymentGoals(
    goal: PaymentSuccessGoalPayload,
    token: string,
  ) {
    trackCheckoutGoalOnce("purchase", goal.conversionId, {
      product_code: goal.productCode,
      image_count: goal.imageCount,
      payment_method: "yookassa",
      value: goal.value,
    });

    const storageKey = `yandex-goal:payment_success:${goal.conversionId}`;
    let alreadyTracked = false;

    try {
      alreadyTracked = window.localStorage.getItem(storageKey) === "1";
    } catch {
      // Analytics storage must never affect the paid user flow.
    }

    if (alreadyTracked) {
      await acknowledgePaymentSuccessGoal(goal.conversionId, token);
      return;
    }

    let dispatched = false;
    try {
      dispatched = trackYandexGoal("payment_success", {
        currency: goal.currency,
        image_count: goal.imageCount,
        order_price: goal.value,
        payment_method: "yookassa",
        product_code: goal.productCode,
        value: goal.value,
      });
    } catch {
      // Analytics must never affect the paid user flow.
    }

    if (!dispatched) return;

    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // The goal was dispatched; do not retry it in this call.
    }

    await acknowledgePaymentSuccessGoal(goal.conversionId, token);
  }

  async function acknowledgePaymentSuccessGoal(conversionId: string, token: string) {
    try {
      await fetch("/api/payments/ack-conversion", {
        method: "POST",
        keepalive: true,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversionId, jobId }),
      });
    } catch {
      // The outbox remains undelivered and can be retried safely later.
    }
  }

  function trackCheckoutGoalOnce(
    goal: string,
    marker: string,
    params: Parameters<typeof trackVkGoal>[1],
  ) {
    const key = `vk-goal:${goal}:${jobId}:${marker}`;
    if (trackedCheckoutGoals.has(key)) return;

    try {
      if (window.localStorage.getItem(key)) {
        trackedCheckoutGoals.add(key);
        return;
      }
    } catch {
      // Fall back to the in-memory guard below.
    }

    try {
      trackVkGoal(goal, params);
    } catch {
      return;
    }

    trackedCheckoutGoals.add(key);
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Analytics storage must never affect navigation.
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
          <h1>{canUsePhotoBalance ? "Запустите генерацию" : "Оплатите генерацию"}</h1>
          <p className="lead">
            Фото уже загружены и приняты. Если на балансе хватает фото, заказ
            перейдёт в очередь без оплаты. Если не хватает, покупка пополнит баланс.
          </p>
        </div>

        <aside className="checkout-card">
          <span>Пакет</span>
          <strong>{activePackage.name}</strong>
          <p>{activePackage.description}</p>
          <div className="checkout-price">{price}</div>
          {job?.payment_status !== "paid" && canUsePhotoBalance ? (
            <div className="upload-message muted">
              На балансе {photoBalance} фото. Этот пакет можно запустить без оплаты.
            </div>
          ) : null}
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
            {isPaying
              ? canUsePhotoBalance
                ? "Запускаем с баланса..."
                : "Переходим к оплате..."
              : canUsePhotoBalance
                ? "Запустить с баланса"
                : "Купить пакет и продолжить"}
          </button>
          {job?.payment_status === "paid" ? (
            <Link className="button button-secondary" href={`/generation/${jobId}`}>
              Перейти к генерации
            </Link>
          ) : canUsePhotoBalance ? null : (
            <button
              className="button button-secondary"
              disabled={isLoading || isPaying}
              onClick={() => confirmLatestPendingPayment()}
              type="button"
            >
              Проверить оплату
            </button>
          )}
        </aside>
      </section>

      <section className="section">
        <div className="empty-state">
          <strong>Что входит</strong>
          <span>
            {activePackage.imageCount} фото в выбранном интерьере: профессионально
            поставленные сцены и разные дистанции камеры.
          </span>
        </div>
        {error ? <div className="upload-message error">{error}</div> : null}
        {message ? <div className="upload-message success">{message}</div> : null}
      </section>
    </main>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
