export class YooKassaVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "YooKassaVerificationError";
    this.code = code;
  }
}

export function parseYooKassaAmountToCents(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new YooKassaVerificationError(
      "invalid_amount",
      "ЮKassa вернула некорректную сумму платежа.",
    );
  }

  const [rubles, fraction = ""] = value.split(".");
  const cents = Number(rubles) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents)) {
    throw new YooKassaVerificationError(
      "invalid_amount",
      "Сумма платежа ЮKassa выходит за допустимый диапазон.",
    );
  }

  return cents;
}

export function assertYooKassaPaymentMatches(payment, expected) {
  if (!payment || payment.id !== expected.paymentId) {
    throw new YooKassaVerificationError(
      "payment_id_mismatch",
      "Идентификатор платежа ЮKassa не совпадает с заказом.",
    );
  }

  if (payment.status !== "succeeded" || payment.paid !== true) {
    throw new YooKassaVerificationError(
      "payment_not_succeeded",
      "Платёж ещё не подтверждён ЮKassa.",
    );
  }

  if (parseYooKassaAmountToCents(payment.amount?.value) !== expected.amountCents) {
    throw new YooKassaVerificationError(
      "amount_mismatch",
      "Сумма платежа ЮKassa не совпадает с заказом.",
    );
  }

  if (
    typeof payment.amount?.currency !== "string" ||
    payment.amount.currency.toUpperCase() !== expected.currency.toUpperCase()
  ) {
    throw new YooKassaVerificationError(
      "currency_mismatch",
      "Валюта платежа ЮKassa не совпадает с заказом.",
    );
  }

  if (payment.metadata?.job_id !== expected.jobId) {
    throw new YooKassaVerificationError(
      "job_mismatch",
      "Платёж ЮKassa относится к другому заказу.",
    );
  }

  if (payment.metadata?.user_id !== expected.userId) {
    throw new YooKassaVerificationError(
      "user_mismatch",
      "Платёж ЮKassa относится к другому пользователю.",
    );
  }

  if (payment.metadata?.product_code !== expected.productCode) {
    throw new YooKassaVerificationError(
      "product_mismatch",
      "Пакет в платеже ЮKassa не совпадает с заказом.",
    );
  }

  if (payment.metadata?.target_image_count !== String(expected.targetImageCount)) {
    throw new YooKassaVerificationError(
      "image_count_mismatch",
      "Количество фото в платеже ЮKassa не совпадает с заказом.",
    );
  }

  return payment;
}

export async function retrieveYooKassaPayment({
  shopId,
  secretKey,
  paymentId,
  fetchImpl = fetch,
  timeoutMs = 10000,
}) {
  const response = await fetchImpl(
    `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.description ?? data?.error?.message ?? "Не удалось проверить платёж ЮKassa.",
    );
  }

  return data;
}
