import { NextRequest, NextResponse } from "next/server";
import {
  formatMoney,
  PAYMENT_CURRENCY,
  PHOTO_PACKAGE_AMOUNT_CENTS,
  PHOTO_PACKAGE_CODE,
  PHOTO_PACKAGE_DESCRIPTION,
  PHOTO_PACKAGE_NAME,
} from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type YooKassaPayment = {
  id: string;
  status: string;
  confirmation?: {
    confirmation_url?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    const { jobId, email } = (await request.json()) as { jobId?: string; email?: string };

    if (!jobId) {
      return NextResponse.json({ error: "Не передан jobId." }, { status: 400 });
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

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, user_id, status, payment_status")
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

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const payment = await createYooKassaPayment({
      shopId: yookassaShopId,
      secretKey: yookassaSecretKey,
      origin,
      jobId,
      userId,
      email,
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
      amount_cents: PHOTO_PACKAGE_AMOUNT_CENTS,
      currency: PAYMENT_CURRENCY,
      product_code: PHOTO_PACKAGE_CODE,
      product_name: PHOTO_PACKAGE_NAME,
    });

    if (orderError) {
      throw new Error(orderError.message);
    }

    const { error: paymentError } = await supabase
      .from("jobs")
      .update({
        status: "awaiting_payment",
        payment_status: "pending",
        amount_cents: PHOTO_PACKAGE_AMOUNT_CENTS,
        currency: PAYMENT_CURRENCY,
        product_code: PHOTO_PACKAGE_CODE,
      })
      .eq("id", jobId);

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl,
      label: formatMoney(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать оплату." },
      { status: 500 },
    );
  }
}

async function createYooKassaPayment({
  shopId,
  secretKey,
  origin,
  jobId,
  userId,
  email,
}: {
  shopId: string;
  secretKey: string;
  origin: string;
  jobId: string;
  userId: string;
  email: string;
}) {
  const amountValue = (PHOTO_PACKAGE_AMOUNT_CENTS / 100).toFixed(2);
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
      description: PHOTO_PACKAGE_NAME,
      metadata: {
        job_id: jobId,
        user_id: userId,
        product_code: PHOTO_PACKAGE_CODE,
        email,
      },
      receipt: {
        customer: {
          email,
        },
        items: [
          {
            description: PHOTO_PACKAGE_DESCRIPTION,
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

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Нет токена пользователя.");
  }

  return token;
}
