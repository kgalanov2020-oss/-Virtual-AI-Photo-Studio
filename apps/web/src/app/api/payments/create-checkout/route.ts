import { NextRequest, NextResponse } from "next/server";
import {
  formatMoney,
  getPhotoPackage,
  PAYMENT_CURRENCY,
} from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type YooKassaPayment = {
  id: string;
  status: string;
  confirmation?: {
    confirmation_url?: string;
  };
  metadata?: {
    job_id?: string;
    user_id?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
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
      .select("id, user_id, status, payment_status, product_code, target_image_count")
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
      await markJobPaidFromPhotoBalance({
        supabase,
        jobId,
        userId,
        selectedPackage,
      });

      return NextResponse.json({
        ok: true,
        paid: true,
        redirectUrl: `/generation/${jobId}`,
        balancePaid: true,
      });
    }

    const yookassaShopId = process.env.YOOKASSA_SHOP_ID;
    const yookassaSecretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!yookassaShopId || !yookassaSecretKey) {
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

    const { data: pendingOrders, error: pendingOrderError } = await supabase
      .from("orders")
      .select("provider_session_id, checkout_url")
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    if (pendingOrderError) {
      throw new Error(pendingOrderError.message);
    }

    for (const pendingOrder of pendingOrders ?? []) {
      if (!pendingOrder.provider_session_id) {
        continue;
      }

      const existingPayment = await retrieveYooKassaPayment(
        yookassaShopId,
        yookassaSecretKey,
        pendingOrder.provider_session_id,
      );

      if (existingPayment.status === "succeeded") {
        await markPaymentPaid({
          supabase,
          jobId,
          userId,
          paymentId: existingPayment.id,
          selectedPackage,
        });

        return NextResponse.json({ ok: true, paid: true, redirectUrl: `/generation/${jobId}` });
      }

      if (pendingOrder.checkout_url && !["canceled", "failed"].includes(existingPayment.status)) {
        return NextResponse.json({
          ok: true,
          checkoutUrl: pendingOrder.checkout_url,
          label: formatMoney(selectedPackage.amountCents),
        });
      }
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const payment = await createYooKassaPayment({
      shopId: yookassaShopId,
      secretKey: yookassaSecretKey,
      origin,
      jobId,
      userId,
      email,
      selectedPackage,
    });
    const checkoutUrl = payment.confirmation?.confirmation_url;

    if (!checkoutUrl) {
      throw new Error("ЮKassa не вернула ссылку на оплату.");
    }

    const { error: orderError } = await supabase.from("orders").insert({
      job_id: jobId,
      user_id: userId,
      status: "pending",
      provider: "yookassa",
      provider_session_id: payment.id,
      checkout_url: checkoutUrl,
      amount_cents: selectedPackage.amountCents,
      currency: PAYMENT_CURRENCY,
      product_code: selectedPackage.code,
      product_name: selectedPackage.name,
      target_image_count: selectedPackage.imageCount,
    });

    if (orderError) {
      throw new Error(orderError.message);
    }

    const { error: paymentError } = await supabase
      .from("jobs")
      .update({
        status: "awaiting_payment",
        payment_status: "pending",
        amount_cents: selectedPackage.amountCents,
        currency: PAYMENT_CURRENCY,
        product_code: selectedPackage.code,
        target_image_count: selectedPackage.imageCount,
      })
      .eq("id", jobId);

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl,
      label: formatMoney(selectedPackage.amountCents),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать оплату." },
      { status: 500 },
    );
  }
}

async function markJobPaidFromPhotoBalance({
  supabase,
  jobId,
  userId,
  selectedPackage,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  jobId: string;
  userId: string;
  selectedPackage: ReturnType<typeof getPhotoPackage>;
}) {
  const paidAt = new Date().toISOString();
  const { error: jobError } = await supabase
    .from("jobs")
    .update({
      status: "queued",
      payment_status: "paid",
      paid_at: paidAt,
      amount_cents: 0,
      currency: PAYMENT_CURRENCY,
      product_code: selectedPackage.code,
      target_image_count: selectedPackage.imageCount,
      progress: 5,
      queued_at: paidAt,
      error_message: null,
    })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (jobError) {
    throw new Error(jobError.message);
  }
}

async function markPaymentPaid({
  supabase,
  jobId,
  userId,
  paymentId,
  selectedPackage,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  jobId: string;
  userId: string;
  paymentId: string;
  selectedPackage: ReturnType<typeof getPhotoPackage>;
}) {
  const paidAt = new Date().toISOString();
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      provider_payment_id: paymentId,
      paid_at: paidAt,
      updated_at: paidAt,
    })
    .eq("provider_session_id", paymentId)
    .eq("job_id", jobId)
    .eq("user_id", userId);

  if (orderError) {
    throw new Error(orderError.message);
  }

  await addPhotoBalance({
    supabase,
    userId,
    imageCount: selectedPackage.imageCount,
  });

  const { error: jobError } = await supabase
    .from("jobs")
    .update({
      status: "queued",
      payment_status: "paid",
      paid_at: paidAt,
      progress: 5,
      queued_at: paidAt,
      error_message: null,
    })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (jobError) {
    throw new Error(jobError.message);
  }
}

async function addPhotoBalance({
  supabase,
  userId,
  imageCount,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  imageCount: number;
}) {
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("free_images_remaining")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "Профиль пользователя не найден.");
  }

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({
      free_images_remaining: profile.free_images_remaining + imageCount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function createYooKassaPayment({
  shopId,
  secretKey,
  origin,
  jobId,
  userId,
  email,
  selectedPackage,
}: {
  shopId: string;
  secretKey: string;
  origin: string;
  jobId: string;
  userId: string;
  email: string;
  selectedPackage: ReturnType<typeof getPhotoPackage>;
}) {
  const amountValue = (selectedPackage.amountCents / 100).toFixed(2);
  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotence-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      amount: {
        value: amountValue,
        currency: PAYMENT_CURRENCY.toUpperCase(),
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: `${origin}/checkout/${jobId}?payment_return=1`,
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
        customer: {
          email,
        },
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

async function retrieveYooKassaPayment(shopId: string, secretKey: string, paymentId: string) {
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
    },
  });
  const data = (await response.json()) as YooKassaPayment & {
    description?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.description ?? data.error?.message ?? "Не удалось проверить платёж ЮKassa.");
  }

  return data;
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Нет токена пользователя.");
  }

  return token;
}
