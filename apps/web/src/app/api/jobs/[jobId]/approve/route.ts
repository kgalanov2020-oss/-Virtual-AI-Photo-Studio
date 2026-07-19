import { NextRequest, NextResponse } from "next/server";
import {
  getPhotoPackage,
  PAYMENT_CURRENCY,
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
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
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

    if (job.payment_status === "paid" || (job.status !== "draft" && job.status !== "failed")) {
      return NextResponse.json({
        ok: true,
        job: {
          id: job.id,
          status: job.status,
          payment_status: job.payment_status,
        },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("free_images_remaining, legal_terms_accepted_at, privacy_accepted_at, personal_data_accepted_at, photo_rights_accepted_at")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Профиль пользователя не найден." }, { status: 400 });
    }

    const hasConsents =
      profile.legal_terms_accepted_at &&
      profile.privacy_accepted_at &&
      profile.personal_data_accepted_at &&
      profile.photo_rights_accepted_at;

    if (!hasConsents) {
      return NextResponse.json({ error: "Сначала подтвердите согласия." }, { status: 400 });
    }

    const selectedPackage = getPhotoPackage(job.product_code);
    const isFreePackage = selectedPackage.isFree;
    const canUsePhotoBalance = profile.free_images_remaining >= selectedPackage.imageCount;

    if (isFreePackage && !canUsePhotoBalance) {
      return NextResponse.json(
        { error: "Бесплатные фото закончились. Выберите платный пакет." },
        { status: 402 },
      );
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
    const shouldPay = PAYMENTS_ENABLED && !canUsePhotoBalance;

    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update({
        status: shouldPay ? "awaiting_payment" : "queued",
        payment_status: shouldPay ? "unpaid" : "paid",
        paid_at: shouldPay ? null : now,
        amount_cents: shouldPay ? selectedPackage.amountCents : 0,
        currency: PAYMENT_CURRENCY,
        product_code: selectedPackage.code,
        target_image_count: selectedPackage.imageCount,
        progress: shouldPay ? 0 : 5,
        queued_at: shouldPay ? null : now,
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
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
