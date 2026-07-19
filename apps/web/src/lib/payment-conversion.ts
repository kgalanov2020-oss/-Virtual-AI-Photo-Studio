import { createSupabaseAdminClient } from "@/lib/supabase";

export type PaymentSuccessGoalPayload = {
  conversionId: string;
  value: number;
  currency: string;
  productCode: string;
  imageCount: number;
  paymentMethod: "yookassa";
};

type ClaimResult =
  | { should_track: false }
  | {
      should_track: true;
      conversion_id: string;
      amount_cents: number;
      currency: string;
      product_code: string;
      target_image_count: number;
    };

export async function claimPaymentSuccessGoal({
  supabase,
  providerPaymentId,
  jobId,
  userId,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  providerPaymentId: string;
  jobId: string;
  userId: string;
}): Promise<PaymentSuccessGoalPayload | null> {
  const { data, error } = await supabase.rpc("claim_payment_success_conversion", {
    p_provider_payment_id: providerPaymentId,
    p_job_id: jobId,
    p_user_id: userId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось зафиксировать конверсию оплаты.");
  }

  const claim = data as ClaimResult;
  if (claim.should_track !== true) {
    return null;
  }

  if (
    !claim.conversion_id ||
    !Number.isSafeInteger(claim.amount_cents) ||
    claim.amount_cents <= 0 ||
    !claim.currency ||
    !claim.product_code ||
    !Number.isSafeInteger(claim.target_image_count) ||
    claim.target_image_count <= 0
  ) {
    throw new Error("База данных вернула некорректную конверсию оплаты.");
  }

  return {
    conversionId: claim.conversion_id,
    value: claim.amount_cents / 100,
    currency: claim.currency.toUpperCase(),
    productCode: claim.product_code,
    imageCount: claim.target_image_count,
    paymentMethod: "yookassa",
  };
}

export async function claimPaymentSuccessGoalBestEffort(
  options: Parameters<typeof claimPaymentSuccessGoal>[0],
): Promise<PaymentSuccessGoalPayload | null> {
  try {
    return await claimPaymentSuccessGoal(options);
  } catch (error) {
    console.error("payment_success_conversion_claim_failed", {
      error: error instanceof Error ? error.message : String(error),
      jobId: options.jobId,
    });
    return null;
  }
}
