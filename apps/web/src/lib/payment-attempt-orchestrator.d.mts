import type { PaymentSettlementResult } from "./payment-settlement";
import type { YooKassaPayment } from "./yookassa-verification.mjs";

export type YooKassaPaymentAttempt = {
  id: string;
  provider_idempotence_key: string;
  provider_session_id: string | null;
  checkout_url: string | null;
};

export function resolveYooKassaPaymentAttempt<TAttempt extends YooKassaPaymentAttempt>(options: {
  reserveAttempt: () => Promise<TAttempt>;
  retrievePayment: (paymentId: string) => Promise<YooKassaPayment>;
  createPayment: (idempotenceKey: string) => Promise<YooKassaPayment>;
  finalizeAttempt: (
    attempt: TAttempt,
    payment: YooKassaPayment,
  ) => Promise<TAttempt>;
  closeAttempt: (
    attempt: TAttempt,
    status: "cancelled" | "failed",
  ) => Promise<void>;
  settlePayment: (
    attempt: TAttempt,
    payment: YooKassaPayment,
  ) => Promise<PaymentSettlementResult>;
  maxAttempts?: number;
}): Promise<
  | {
      kind: "paid";
      providerPaymentId: string;
      settlement: PaymentSettlementResult;
    }
  | { kind: "checkout"; checkoutUrl: string }
>;
