import { NextRequest, NextResponse } from "next/server";
import { settleVerifiedYooKassaPayment } from "@/lib/payment-settlement";
import { createSupabaseAdminClient } from "@/lib/supabase";
import {
  retrieveYooKassaPayment,
  YooKassaVerificationError,
} from "@/lib/yookassa-verification.mjs";

export const runtime = "nodejs";

type YooKassaWebhook = {
  event?: string;
  object?: {
    id?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as YooKassaWebhook;

    if (body.event !== "payment.succeeded") {
      return NextResponse.json({ status: "ignored" });
    }

    const paymentId = body.object?.id;
    if (!paymentId) {
      return NextResponse.json({ status: "rejected", error: "invalid payment payload" });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) {
      return NextResponse.json(
        { error: "YOOKASSA_SHOP_ID или YOOKASSA_SECRET_KEY не настроены." },
        { status: 501 },
      );
    }

    // The notification body is untrusted. YooKassa is the source of truth.
    const payment = await retrieveYooKassaPayment({
      shopId,
      secretKey,
      paymentId,
    });

    const supabase = createSupabaseAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "job_id, user_id, provider, provider_session_id, amount_cents, currency, product_code, target_image_count",
      )
      .eq("provider_session_id", paymentId)
      .maybeSingle();

    if (orderError) {
      throw new Error(orderError.message);
    }

    if (!order) {
      return NextResponse.json({ error: "Платёжный заказ не найден." }, { status: 404 });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        "id, user_id, payment_status, amount_cents, currency, product_code, target_image_count",
      )
      .eq("id", order.job_id)
      .eq("user_id", order.user_id)
      .maybeSingle();

    if (jobError) {
      throw new Error(jobError.message);
    }

    if (!job) {
      return NextResponse.json({ error: "Задание платежа не найдено." }, { status: 404 });
    }

    const result = await settleVerifiedYooKassaPayment({
      supabase,
      payment,
      order,
      job,
    });

    return NextResponse.json({
      status:
        result === "processed"
          ? "success"
          : result === "duplicate_payment_credited"
            ? "duplicate_payment_credited"
            : "already_processed",
      payment_id: paymentId,
    });
  } catch (error) {
    if (
      error instanceof YooKassaVerificationError &&
      error.code !== "payment_not_succeeded"
    ) {
      // A verified provider payment that permanently fails our invariants will
      // not become valid on retry. Acknowledge it to stop a 24-hour retry loop.
      return NextResponse.json({ status: "rejected", error: error.message });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось обработать уведомление ЮKassa." },
      { status: 500 },
    );
  }
}
