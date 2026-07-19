import { NextRequest, NextResponse } from "next/server";
import { resolveYooKassaPaymentAttempt } from "@/lib/payment-attempt-orchestrator.mjs";
import { claimPaymentSuccessGoalBestEffort } from "@/lib/payment-conversion";
import { formatMoney, getPhotoPackage, PAYMENT_CURRENCY } from "@/lib/pricing";
import { settleVerifiedYooKassaPayment } from "@/lib/payment-settlement";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { Order } from "@/lib/types";
import {
  retrieveYooKassaPayment,
  type YooKassaPayment,
  YooKassaVerificationError,
} from "@/lib/yookassa-verification.mjs";

export const runtime = "nodejs";

type PaymentAttempt = Pick<
  Order,
  | "id"
  | "job_id"
  | "user_id"
  | "provider"
  | "provider_idempotence_key"
  | "provider_session_id"
  | "checkout_url"
  | "amount_cents"
  | "currency"
  | "product_code"
  | "target_image_count"
> & { created: boolean };

type PhotoBalanceSettlement = {
  status: "balance_settled" | "already_paid" | "provider_attempt_exists";
  free_images_remaining?: number;
  order_id?: string;
  provider_session_id?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    const { jobId, email } = (await request.json()) as { jobId?: string; email?: string };

    if (!jobId) {
      return NextResponse.json({ error: "Не передан jobId." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        "id, user_id, status, payment_status, amount_cents, currency, product_code, target_image_count",
      )
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: jobError?.message ?? "Job не найден." }, { status: 404 });
    }

    if (job.user_id !== userId) {
      return NextResponse.json({ error: "Нет доступа к этому job." }, { status: 403 });
    }

    if (job.payment_status === "paid") {
      return NextResponse.json({ ok: true, paid: true, redirectUrl: `/generation/${jobId}` });
    }

    const selectedPackage = getPhotoPackage(job.product_code);
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("free_images_remaining")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Профиль пользователя не найден." }, { status: 400 });
    }

    if (selectedPackage.isFree && profile.free_images_remaining < selectedPackage.imageCount) {
      return NextResponse.json(
        { error: "Бесплатные фото закончились. Выберите платный пакет или примените промокод." },
        { status: 402 },
      );
    }

    if (profile.free_images_remaining >= selectedPackage.imageCount) {
      const balanceSettlement = await markJobPaidFromPhotoBalance({ supabase, jobId, userId });

      if (balanceSettlement.status !== "provider_attempt_exists") {
        return NextResponse.json({
          ok: true,
          paid: true,
          redirectUrl: `/generation/${jobId}`,
          balancePaid: balanceSettlement.status === "balance_settled",
        });
      }
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) {
      return NextResponse.json(
        {
          error:
            "Оплата ещё не настроена: добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в Render. Можно оставить загрузку и проверку фото, но генерация будет доступна после подключения платежей.",
        },
        { status: 501 },
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Введите email для электронного чека." }, { status: 400 });
    }

    const returnOrigin = getPaymentReturnOrigin();

    // DB reservation plus the persisted provider key makes parallel calls
    // converge on one YooKassa payment.
    const result = await resolveYooKassaPaymentAttempt<PaymentAttempt>({
      reserveAttempt: () =>
        reservePaymentAttempt({
          supabase,
          jobId,
          userId,
          productName: selectedPackage.name,
        }),
      retrievePayment: (paymentId) =>
        retrieveYooKassaPayment({ shopId, secretKey, paymentId }),
      createPayment: (idempotenceKey) =>
        createYooKassaPayment({
          shopId,
          secretKey,
          returnOrigin,
          jobId,
          userId,
          email,
          selectedPackage,
          idempotenceKey,
        }),
      finalizeAttempt: (attempt, payment) =>
        finalizePaymentAttempt({ supabase, attempt, payment }),
      closeAttempt: (attempt, status) =>
        closePaymentAttempt({ supabase, attempt, status }),
      settlePayment: (attempt, payment) =>
        settleVerifiedYooKassaPayment({
          supabase,
          payment,
          order: attempt,
          job,
        }),
    });

    if (result.kind === "paid") {
      const paymentSuccessGoal = await claimPaymentSuccessGoalBestEffort({
        supabase,
        providerPaymentId: result.providerPaymentId,
        jobId,
        userId,
      });

      return NextResponse.json({
        ok: true,
        paid: true,
        redirectUrl: `/generation/${jobId}`,
        duplicatePaymentCredited: result.settlement === "duplicate_payment_credited",
        paymentSuccessGoal,
      });
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl: result.checkoutUrl,
      label: formatMoney(selectedPackage.amountCents),
    });
  } catch (error) {
    const status = error instanceof YooKassaVerificationError ? 409 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать оплату." },
      { status },
    );
  }
}

async function reservePaymentAttempt({
  supabase,
  jobId,
  userId,
  productName,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  jobId: string;
  userId: string;
  productName: string;
}) {
  const { data, error } = await supabase.rpc("reserve_yookassa_payment_attempt", {
    p_job_id: jobId,
    p_user_id: userId,
    p_product_name: productName,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось зарезервировать попытку оплаты.");
  }

  return data as PaymentAttempt;
}

async function finalizePaymentAttempt({
  supabase,
  attempt,
  payment,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  attempt: PaymentAttempt;
  payment: YooKassaPayment;
}) {
  if (!payment.id) {
    throw new Error("ЮKassa не вернула идентификатор платежа.");
  }

  const { data, error } = await supabase.rpc("finalize_yookassa_payment_attempt", {
    p_order_id: attempt.id,
    p_job_id: attempt.job_id,
    p_user_id: attempt.user_id,
    p_provider_idempotence_key: attempt.provider_idempotence_key,
    p_provider_session_id: payment.id,
    p_checkout_url: payment.confirmation?.confirmation_url ?? attempt.checkout_url,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось сохранить попытку оплаты.");
  }

  return data as PaymentAttempt;
}

async function closePaymentAttempt({
  supabase,
  attempt,
  status,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  attempt: PaymentAttempt;
  status: "cancelled" | "failed";
}) {
  const { error } = await supabase
    .from("orders")
    .update({
      status,
      is_active_payment_attempt: false,
      reconciliation_reason: `provider_${status}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .eq("status", "pending")
    .eq("is_active_payment_attempt", true);

  if (error) {
    throw new Error(error.message);
  }
}

async function markJobPaidFromPhotoBalance({
  supabase,
  jobId,
  userId,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  jobId: string;
  userId: string;
}) {
  const { data, error } = await supabase.rpc("settle_job_from_photo_balance", {
    p_job_id: jobId,
    p_user_id: userId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось применить баланс фото.");
  }

  const result = data as PhotoBalanceSettlement;
  if (
    result.status !== "balance_settled" &&
    result.status !== "already_paid" &&
    result.status !== "provider_attempt_exists"
  ) {
    throw new Error("База данных вернула неизвестный результат оплаты балансом.");
  }

  return result;
}

async function createYooKassaPayment({
  shopId,
  secretKey,
  returnOrigin,
  jobId,
  userId,
  email,
  selectedPackage,
  idempotenceKey,
}: {
  shopId: string;
  secretKey: string;
  returnOrigin: string;
  jobId: string;
  userId: string;
  email: string;
  selectedPackage: ReturnType<typeof getPhotoPackage>;
  idempotenceKey: string;
}) {
  const amountValue = (selectedPackage.amountCents / 100).toFixed(2);
  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify({
      amount: {
        value: amountValue,
        currency: PAYMENT_CURRENCY.toUpperCase(),
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: `${returnOrigin}/checkout/${jobId}?payment_return=1`,
      },
      description: selectedPackage.name,
      metadata: {
        job_id: jobId,
        user_id: userId,
        product_code: selectedPackage.code,
        target_image_count: String(selectedPackage.imageCount),
        email,
      },
      receipt: {
        customer: { email },
        items: [
          {
            description: selectedPackage.description,
            quantity: "1.00",
            amount: {
              value: amountValue,
              currency: PAYMENT_CURRENCY.toUpperCase(),
            },
            vat_code: 1,
            payment_subject: "service",
            payment_mode: "full_payment",
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await response.json()) as YooKassaPayment & {
    description?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.description ?? data.error?.message ?? "ЮKassa не создала платёж.");
  }

  return data;
}

function getPaymentReturnOrigin() {
  const configured = process.env.PAYMENT_RETURN_ORIGIN ?? "https://virtualphotostudio.ru";
  const url = new URL(configured);
  const allowedHosts = new Set(["virtualphotostudio.ru", "www.virtualphotostudio.ru"]);

  if (process.env.NODE_ENV !== "production") {
    allowedHosts.add("localhost");
    allowedHosts.add("127.0.0.1");
  }

  if (!(["https:", "http:"].includes(url.protocol)) || !allowedHosts.has(url.hostname)) {
    throw new Error("PAYMENT_RETURN_ORIGIN содержит недопустимый публичный адрес.");
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("PAYMENT_RETURN_ORIGIN в production должен использовать HTTPS.");
  }

  return url.origin;
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
