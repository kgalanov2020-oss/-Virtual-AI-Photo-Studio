import { NextRequest, NextResponse } from "next/server";
import {
  PAYMENT_CURRENCY,
  PHOTO_PACKAGE_AMOUNT_CENTS,
  PHOTO_PACKAGE_CODE,
} from "@/lib/pricing";
import { PAYMENTS_ENABLED } from "@/lib/payments";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const token = readBearerToken(request);
    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, user_id")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: jobError?.message ?? "Job не найден." }, { status: 404 });
    }

    if (job.user_id !== userId) {
      return NextResponse.json({ error: "Нет доступа к этому job." }, { status: 403 });
    }

    const { error: selfiesError } = await supabase
      .from("uploaded_selfies")
      .update({
        is_approved: true,
        rejection_reason: null,
      })
      .eq("job_id", jobId)
      .eq("user_id", userId);

    if (selfiesError) {
      throw new Error(selfiesError.message);
    }

    const now = new Date().toISOString();
    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update({
        status: PAYMENTS_ENABLED ? "awaiting_payment" : "queued",
        payment_status: PAYMENTS_ENABLED ? "unpaid" : "paid",
        paid_at: PAYMENTS_ENABLED ? null : now,
        amount_cents: PHOTO_PACKAGE_AMOUNT_CENTS,
        currency: PAYMENT_CURRENCY,
        product_code: PHOTO_PACKAGE_CODE,
        progress: PAYMENTS_ENABLED ? 0 : 5,
        queued_at: PAYMENTS_ENABLED ? null : now,
        error_message: null,
      })
      .eq("id", jobId)
      .eq("user_id", userId)
      .select("id, status, payment_status")
      .single();

    if (updateError || !updatedJob) {
      throw new Error(updateError?.message ?? "Не удалось обновить job.");
    }

    return NextResponse.json({ ok: true, job: updatedJob });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Неизвестная ошибка." },
      { status: 500 },
    );
  }
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Нет токена пользователя.");
  }

  return token;
}
