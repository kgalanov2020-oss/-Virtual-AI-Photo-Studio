import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type YooKassaWebhook = {
  event?: string;
  object?: {
    id?: string;
    status?: string;
    amount?: {
      value?: string;
      currency?: string;
    };
    metadata?: {
      job_id?: string;
      user_id?: string;
    };
  };
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as YooKassaWebhook;

  if (body.event !== "payment.succeeded") {
    return NextResponse.json({ status: "ignored" });
  }

  const payment = body.object;
  const paymentId = payment?.id;
  const jobId = payment?.metadata?.job_id;
  const userId = payment?.metadata?.user_id;

  if (!paymentId || !jobId || !userId || payment?.status !== "succeeded") {
    return NextResponse.json({ error: "invalid payment payload" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingOrder, error: existingError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("provider_session_id", paymentId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingOrder?.status === "paid") {
    return NextResponse.json({ status: "already_processed" });
  }

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
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

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
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", payment_id: paymentId });
}
