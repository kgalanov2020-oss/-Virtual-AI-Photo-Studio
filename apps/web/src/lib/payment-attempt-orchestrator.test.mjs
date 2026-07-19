import assert from "node:assert/strict";
import test from "node:test";
import { resolveYooKassaPaymentAttempt } from "./payment-attempt-orchestrator.mjs";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("parallel checkout calls converge on one reserved attempt and provider payment", async () => {
  let activeAttempt = null;
  let reservationTail = Promise.resolve();
  let orderCount = 0;
  let providerCreateCalls = 0;
  const providerPayments = new Map();

  async function reserveAttempt() {
    const previous = reservationTail;
    let release;
    reservationTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      await wait(3);
      if (!activeAttempt) {
        orderCount += 1;
        activeAttempt = {
          id: `order-${orderCount}`,
          provider_idempotence_key: "persisted-key-1",
          provider_session_id: null,
          checkout_url: null,
        };
      }
      return { ...activeAttempt };
    } finally {
      release();
    }
  }

  async function createPayment(idempotenceKey) {
    providerCreateCalls += 1;
    await wait(5);
    if (!providerPayments.has(idempotenceKey)) {
      providerPayments.set(idempotenceKey, {
        id: "payment-1",
        status: "pending",
        paid: false,
        confirmation: { confirmation_url: "https://pay.test/payment-1" },
      });
    }
    return providerPayments.get(idempotenceKey);
  }

  async function finalizeAttempt(attempt, payment) {
    if (
      activeAttempt.provider_session_id &&
      activeAttempt.provider_session_id !== payment.id
    ) {
      throw new Error("different provider payment");
    }
    activeAttempt = {
      ...activeAttempt,
      provider_session_id: payment.id,
      checkout_url: payment.confirmation.confirmation_url,
    };
    return { ...activeAttempt };
  }

  const options = {
    reserveAttempt,
    retrievePayment: async () => {
      throw new Error("unexpected retrieve");
    },
    createPayment,
    finalizeAttempt,
    closeAttempt: async () => {},
    settlePayment: async () => "processed",
  };
  const [first, second] = await Promise.all([
    resolveYooKassaPaymentAttempt(options),
    resolveYooKassaPaymentAttempt(options),
  ]);

  assert.equal(orderCount, 1);
  assert.equal(providerPayments.size, 1);
  assert.equal(providerCreateCalls, 2, "both requests may call YooKassa safely with the same key");
  assert.deepEqual(first, { kind: "checkout", checkoutUrl: "https://pay.test/payment-1" });
  assert.deepEqual(second, first);
});

test("a canceled attempt is closed before a new attempt is returned", async () => {
  const attempts = [
    {
      id: "old",
      provider_idempotence_key: "old-key",
      provider_session_id: "old-payment",
      checkout_url: "https://pay.test/old",
    },
    {
      id: "new",
      provider_idempotence_key: "new-key",
      provider_session_id: null,
      checkout_url: null,
    },
  ];
  let reserveIndex = 0;
  const closed = [];

  const result = await resolveYooKassaPaymentAttempt({
    reserveAttempt: async () => ({ ...attempts[Math.min(reserveIndex++, 1)] }),
    retrievePayment: async () => ({ id: "old-payment", status: "canceled", paid: false }),
    createPayment: async () => ({
      id: "new-payment",
      status: "pending",
      paid: false,
      confirmation: { confirmation_url: "https://pay.test/new" },
    }),
    finalizeAttempt: async (attempt, payment) => ({
      ...attempt,
      provider_session_id: payment.id,
      checkout_url: payment.confirmation?.confirmation_url ?? null,
    }),
    closeAttempt: async (attempt, status) => closed.push([attempt.id, status]),
    settlePayment: async () => "processed",
  });

  assert.deepEqual(closed, [["old", "cancelled"]]);
  assert.deepEqual(result, { kind: "checkout", checkoutUrl: "https://pay.test/new" });
});

test("duplicate succeeded payments surface the credited reconciliation result", async () => {
  const result = await resolveYooKassaPaymentAttempt({
    reserveAttempt: async () => ({
      id: "duplicate",
      provider_idempotence_key: "duplicate-key",
      provider_session_id: "duplicate-payment",
      checkout_url: null,
    }),
    retrievePayment: async () => ({ id: "duplicate-payment", status: "succeeded", paid: true }),
    createPayment: async () => {
      throw new Error("unexpected create");
    },
    finalizeAttempt: async (attempt) => attempt,
    closeAttempt: async () => {},
    settlePayment: async () => "duplicate_payment_credited",
  });

  assert.deepEqual(result, { kind: "paid", settlement: "duplicate_payment_credited" });
});
