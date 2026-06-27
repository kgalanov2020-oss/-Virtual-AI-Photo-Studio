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

type StripeSession = {
  id: string;
  url: string;
  payment_status?: string;
};

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    const { jobId } = (await request.json()) as { jobId?: string };

    if (!jobId) {
      return NextResponse.json({ error: "Не передан jobId." }, { status: 400 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            "Оплата ещё не настроена: добавьте STRIPE_SECRET_KEY в Render. Можно оставить загрузку и проверку фото, но генерация будет доступна после подключения платежей.",
        },
        { status: 501 },
      );
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
    const session = await createStripeCheckoutSession({
      apiKey: stripeSecretKey,
      origin,
      jobId,
      userId,
    });

    const { error: orderError } = await supabase.from("orders").insert({
      job_id: jobId,
      user_id: userId,
      status: "pending",
      provider: "stripe",
      provider_session_id: session.id,
      checkout_url: session.url,
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
      checkoutUrl: session.url,
      label: formatMoney(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать оплату." },
      { status: 500 },
    );
  }
}

async function createStripeCheckoutSession({
  apiKey,
  origin,
  jobId,
  userId,
}: {
  apiKey: string;
  origin: string;
  jobId: string;
  userId: string;
}) {
  const body = new URLSearchParams();

  body.set("mode", "payment");
  body.set("success_url", `${origin}/checkout/${jobId}?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/checkout/${jobId}?cancelled=1`);
  body.set("client_reference_id", jobId);
  body.set("metadata[job_id]", jobId);
  body.set("metadata[user_id]", userId);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", PAYMENT_CURRENCY);
  body.set("line_items[0][price_data][unit_amount]", String(PHOTO_PACKAGE_AMOUNT_CENTS));
  body.set("line_items[0][price_data][product_data][name]", PHOTO_PACKAGE_NAME);
  body.set("line_items[0][price_data][product_data][description]", PHOTO_PACKAGE_DESCRIPTION);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await response.json()) as StripeSession & { error?: { message?: string } };

  if (!response.ok || !data.url) {
    throw new Error(data.error?.message ?? "Stripe не создал checkout-сессию.");
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
