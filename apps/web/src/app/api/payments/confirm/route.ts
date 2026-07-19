import { NextRequest, NextResponse } from "next/server";
import { settleVerifiedYooKassaPayment } from "@/lib/payment-settlement";
import { createSupabaseAdminClient } from "@/lib/supabase";
import {
  retrieveYooKassaPayment,
  type YooKassaPayment,
  YooKassaVerificationError,
} from "@/lib/yookassa-verification.mjs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }
    const { jobId, sessionId } = (await request.json()) as {
      jobId?: string;
      sessionId?: string;
    };

    if (!jobId) {
      return NextResponse.json({ error: "Не передан jobId." }, { status: 400 });
    }

    const yookassaShopId = process.env.YOOKASSA_SHOP_ID;
    const yookassaSecretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!yookassaShopId || !yookassaSecretKey) {
      return NextResponse.json(
        { error: "YOOKASSA_SHOP_ID или YOOKASSA_SECRET_KEY не настроены." },
        { status: 501 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data: job, error: jobLookupError } = await supabase
      .from("jobs")
      .select(
        "id, user_id, payment_status, amount_cents, currency, product_code, target_image_count",
      )
      .eq("id", jobId)
      .single();

    if (jobLookupError || !job) {
      return NextResponse.json(
        { error: jobLookupError?.message ?? "Job не найден." },
        { status: 404 },
      );
    }

    if (job.user_id !== userId) {
      return NextResponse.json({ error: "Нет доступа к этому job." }, { status: 403 });
    }

    const { data: orders, error: orderLookupError } = await supabase
      .from("orders")
      .select(
        "job_id, user_id, provider, provider_session_id, amount_cents, currency, product_code, target_image_count, status, created_at",
      )
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (orderLookupError) {
      throw new Error(orderLookupError.message);
    }

    const paymentOrders = (orders ?? []).filter((order) => order.provider_session_id);
    if (paymentOrders.length === 0) {
      if (job.payment_status === "paid") {
        return NextResponse.json({ ok: true, redirectUrl: `/generation/${jobId}` });
      }

      return NextResponse.json(
        { error: "Не найден ожидающий платёж для этого заказа." },
        { status: 404 },
      );
    }

    if (sessionId && !paymentOrders.some((order) => order.provider_session_id === sessionId)) {
      return NextResponse.json(
        { error: "Платёж не относится к этому заказу." },
        { status: 404 },
      );
    }

    const orderedCandidates = sessionId
      ? [
          ...paymentOrders.filter((order) => order.provider_session_id === sessionId),
          ...paymentOrders.filter((order) => order.provider_session_id !== sessionId),
        ]
      : paymentOrders;

    let lastCheckedPayment: YooKassaPayment | null = null;

    for (const order of orderedCandidates) {
      const paymentId = order.provider_session_id;
      if (!paymentId) continue;

      const payment = await retrieveYooKassaPayment({
        shopId: yookassaShopId,
        secretKey: yookassaSecretKey,
        paymentId,
      });
      lastCheckedPayment = payment;

      if (payment.status !== "succeeded" || payment.paid !== true) {
        continue;
      }

      const settlement = await settleVerifiedYooKassaPayment({
        supabase,
        payment,
        order,
        job,
      });

      return NextResponse.json({
        ok: true,
        redirectUrl: `/generation/${jobId}`,
        duplicatePaymentCredited: settlement === "duplicate_payment_credited",
      });
    }

    if (job.payment_status === "paid") {
      return NextResponse.json({ ok: true, redirectUrl: `/generation/${jobId}` });
    }

    return NextResponse.json(
      {
        error:
          lastCheckedPayment?.status === "canceled"
            ? "Платёж отменён платёжной системой."
            : "Платёж ещё не подтверждён платёжной системой.",
      },
      { status: 409 },
    );
  } catch (error) {
    const status = error instanceof YooKassaVerificationError ? 409 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось подтвердить оплату." },
      { status },
    );
  }
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
