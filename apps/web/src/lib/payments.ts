const explicitPaymentFlag = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED;

export const PAYMENTS_ENABLED =
  explicitPaymentFlag === "true" ||
  (explicitPaymentFlag !== "false" &&
    Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY));
