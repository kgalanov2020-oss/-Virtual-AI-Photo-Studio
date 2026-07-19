import type { Job, Order } from "@/lib/types";
import {
  assertYooKassaPaymentMatches,
  type YooKassaPayment,
} from "@/lib/yookassa-verification.mjs";
import { createSupabaseAdminClient } from "@/lib/supabase";

type SettlementOrder = Pick<
  Order,
  | "job_id"
  | "user_id"
  | "provider"
  | "provider_session_id"
  | "amount_cents"
  | "currency"
  | "product_code"
  | "target_image_count"
>;

type SettlementJob = Pick<
  Job,
  | "id"
  | "user_id"
  | "payment_status"
  | "amount_cents"
  | "currency"
  | "product_code"
  | "target_image_count"
>;

export type PaymentSettlementResult =
  | "processed"
  | "already_processed"
  | "duplicate_payment_credited";

export async function settleVerifiedYooKassaPayment({
  supabase,
  payment,
  order,
  job,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  payment: YooKassaPayment;
  order: SettlementOrder;
  job: SettlementJob;
}): Promise<PaymentSettlementResult> {
  if (!order.provider_session_id) {
    throw new Error("У заказа отсутствует идентификатор платежа ЮKassa.");
  }

  if (
    order.provider !== "yookassa" ||
    order.job_id !== job.id ||
    order.user_id !== job.user_id
  ) {
    throw new Error("Заказ и задание содержат несовпадающие параметры оплаты.");
  }

  const jobMatchesOrder =
    order.amount_cents === job.amount_cents &&
    order.currency.toUpperCase() === job.currency.toUpperCase() &&
    order.product_code === job.product_code &&
    order.target_image_count === job.target_image_count;

  // A paid job can carry the zero-price balance snapshot while an older,
  // immutable provider order is still capable of succeeding. In that case the
  // order (plus the retrieved provider object below) remains authoritative.
  if (job.payment_status !== "paid" && !jobMatchesOrder) {
    throw new Error("Заказ и задание содержат несовпадающие параметры оплаты.");
  }

  assertYooKassaPaymentMatches(payment, {
    paymentId: order.provider_session_id,
    jobId: order.job_id,
    userId: order.user_id,
    amountCents: order.amount_cents,
    currency: order.currency,
    productCode: order.product_code,
    targetImageCount: order.target_image_count,
  });

  const { data, error } = await supabase.rpc("settle_yookassa_payment", {
    p_provider_session_id: order.provider_session_id,
    p_provider_payment_id: payment.id,
    p_job_id: order.job_id,
    p_user_id: order.user_id,
    p_amount_cents: order.amount_cents,
    p_currency: order.currency,
    p_product_code: order.product_code,
    p_target_image_count: order.target_image_count,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (
    data !== "processed" &&
    data !== "already_processed" &&
    data !== "duplicate_payment_credited"
  ) {
    throw new Error("База данных вернула неизвестный результат подтверждения платежа.");
  }

  return data;
}
