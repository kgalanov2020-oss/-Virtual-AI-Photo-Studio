import assert from "node:assert/strict";
import test from "node:test";
import {
  assertYooKassaPaymentMatches,
  parseYooKassaAmountToCents,
  retrieveYooKassaPayment,
  YooKassaVerificationError,
} from "./yookassa-verification.mjs";

const expected = {
  paymentId: "pay-123",
  jobId: "job-123",
  userId: "user-123",
  amountCents: 24900,
  currency: "rub",
  productCode: "studio_5",
  targetImageCount: 5,
};

const validPayment = {
  id: "pay-123",
  status: "succeeded",
  paid: true,
  amount: {
    value: "249.00",
    currency: "RUB",
  },
  metadata: {
    job_id: "job-123",
    user_id: "user-123",
    product_code: "studio_5",
    target_image_count: "5",
  },
};

test("parses YooKassa decimal values without floating point rounding", () => {
  assert.equal(parseYooKassaAmountToCents("249.00"), 24900);
  assert.equal(parseYooKassaAmountToCents("10.5"), 1050);
  assert.equal(parseYooKassaAmountToCents("0"), 0);
  assert.throws(() => parseYooKassaAmountToCents("249.001"), YooKassaVerificationError);
  assert.throws(() => parseYooKassaAmountToCents("not-money"), YooKassaVerificationError);
});

test("accepts a fully matching succeeded and paid payment", () => {
  assert.equal(assertYooKassaPaymentMatches(validPayment, expected), validPayment);
});

const mismatchCases = [
  ["payment id", (payment) => (payment.id = "other"), "payment_id_mismatch"],
  ["status", (payment) => (payment.status = "pending"), "payment_not_succeeded"],
  ["paid flag", (payment) => (payment.paid = false), "payment_not_succeeded"],
  ["amount", (payment) => (payment.amount.value = "250.00"), "amount_mismatch"],
  ["currency", (payment) => (payment.amount.currency = "USD"), "currency_mismatch"],
  ["job metadata", (payment) => (payment.metadata.job_id = "other"), "job_mismatch"],
  ["user metadata", (payment) => (payment.metadata.user_id = "other"), "user_mismatch"],
  ["product metadata", (payment) => (payment.metadata.product_code = "studio_10"), "product_mismatch"],
  ["image count metadata", (payment) => (payment.metadata.target_image_count = "10"), "image_count_mismatch"],
];

for (const [label, mutate, expectedCode] of mismatchCases) {
  test(`rejects mismatched ${label}`, () => {
    const payment = structuredClone(validPayment);
    mutate(payment);

    assert.throws(
      () => assertYooKassaPaymentMatches(payment, expected),
      (error) => error instanceof YooKassaVerificationError && error.code === expectedCode,
    );
  });
}

test("retrieves the payment from YooKassa with Basic authentication", async () => {
  let requestUrl;
  let requestOptions;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return validPayment;
      },
    };
  };

  const payment = await retrieveYooKassaPayment({
    shopId: "shop",
    secretKey: "secret",
    paymentId: "pay/123",
    fetchImpl,
  });

  assert.equal(requestUrl, "https://api.yookassa.ru/v3/payments/pay%2F123");
  assert.equal(
    requestOptions.headers.Authorization,
    `Basic ${Buffer.from("shop:secret").toString("base64")}`,
  );
  assert.equal(requestOptions.cache, "no-store");
  assert.ok(requestOptions.signal instanceof AbortSignal);
  assert.equal(payment, validPayment);
});

test("surfaces a YooKassa API error without trusting a notification payload", async () => {
  const fetchImpl = async () => ({
    ok: false,
    async json() {
      return { description: "payment not found" };
    },
  });

  await assert.rejects(
    retrieveYooKassaPayment({
      shopId: "shop",
      secretKey: "secret",
      paymentId: "missing",
      fetchImpl,
    }),
    /payment not found/,
  );
});
