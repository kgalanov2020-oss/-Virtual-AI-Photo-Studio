export type PaymentConfirmationResult =
  | { kind: "confirmed" }
  | { kind: "pending" }
  | { kind: "fatal"; error: string }
  | { kind: "aborted" };

export type PaymentReturnPollResult =
  | PaymentConfirmationResult
  | { kind: "timeout" };

export const PAYMENT_RETURN_DELAYS_MS: readonly number[];

export function pollPaymentReturn(options: {
  confirm: (context: {
    attempt: number;
    signal?: AbortSignal;
  }) => Promise<PaymentConfirmationResult>;
  signal?: AbortSignal;
  delaysMs?: readonly number[];
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}): Promise<PaymentReturnPollResult>;

export function waitForPaymentDelay(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void>;
