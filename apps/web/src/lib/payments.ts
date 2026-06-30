const explicitPaymentFlag = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED;

export const PAYMENTS_ENABLED =
  explicitPaymentFlag === "true";
