export async function resolveYooKassaPaymentAttempt({
  reserveAttempt,
  retrievePayment,
  createPayment,
  finalizeAttempt,
  closeAttempt,
  settlePayment,
  maxAttempts = 3,
}) {
  for (let attemptNumber = 0; attemptNumber < maxAttempts; attemptNumber += 1) {
    let attempt = await reserveAttempt();
    const payment = attempt.provider_session_id
      ? await retrievePayment(attempt.provider_session_id)
      : await createPayment(attempt.provider_idempotence_key);

    if (!attempt.provider_session_id) {
      attempt = await finalizeAttempt(attempt, payment);
    }

    if (payment.status === "succeeded" && payment.paid === true) {
      return {
        kind: "paid",
        providerPaymentId: payment.id,
        settlement: await settlePayment(attempt, payment),
      };
    }

    if (["canceled", "failed"].includes(payment.status ?? "")) {
      await closeAttempt(attempt, payment.status === "failed" ? "failed" : "cancelled");
      continue;
    }

    const checkoutUrl = payment.confirmation?.confirmation_url ?? attempt.checkout_url;
    if (!attempt.provider_session_id || attempt.checkout_url !== checkoutUrl) {
      attempt = await finalizeAttempt(attempt, payment);
    }

    if (!checkoutUrl) {
      throw new Error("ЮKassa не вернула ссылку на оплату.");
    }

    return { kind: "checkout", checkoutUrl };
  }

  throw new Error("Не удалось создать активную попытку оплаты. Обновите страницу и повторите.");
}
