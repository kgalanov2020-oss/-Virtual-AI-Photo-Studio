export const PHOTO_PACKAGE_CODE = "studio_40";
export const PHOTO_PACKAGE_NAME = "AI-фотосессия 40 фото";
export const PHOTO_PACKAGE_DESCRIPTION = "40 изображений в выбранном интерьере";

export const PAYMENT_CURRENCY = (
  process.env.PAYMENT_CURRENCY ?? "rub"
).toLowerCase();

export const PHOTO_PACKAGE_AMOUNT_CENTS = Number(
  process.env.PAYMENT_AMOUNT_CENTS ?? "99000",
);

export function formatMoney(amountCents = PHOTO_PACKAGE_AMOUNT_CENTS, currency = PAYMENT_CURRENCY) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}
