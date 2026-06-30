export type PhotoPackageCode =
  | "free_1"
  | "studio_5"
  | "studio_10"
  | "studio_20"
  | "studio_40";

export type PhotoPackage = {
  code: PhotoPackageCode;
  name: string;
  description: string;
  imageCount: number;
  amountCents: number;
  isFree?: boolean;
};

export const PAYMENT_CURRENCY = (
  process.env.PAYMENT_CURRENCY ?? "rub"
).toLowerCase();

export const PHOTO_PACKAGES: PhotoPackage[] = [
  {
    code: "free_1",
    name: "Пробное фото",
    description: "1 бесплатное фото в выбранном интерьере",
    imageCount: 1,
    amountCents: 0,
    isFree: true,
  },
  {
    code: "studio_5",
    name: "AI-фотосессия 5 фото",
    description: "5 изображений в выбранном интерьере",
    imageCount: 5,
    amountCents: 24900,
  },
  {
    code: "studio_10",
    name: "AI-фотосессия 10 фото",
    description: "10 изображений в выбранном интерьере",
    imageCount: 10,
    amountCents: 49900,
  },
  {
    code: "studio_20",
    name: "AI-фотосессия 20 фото",
    description: "20 изображений в выбранном интерьере",
    imageCount: 20,
    amountCents: 79900,
  },
  {
    code: "studio_40",
    name: "AI-фотосессия 40 фото",
    description: "40 изображений в выбранном интерьере",
    imageCount: 40,
    amountCents: Number(process.env.PAYMENT_AMOUNT_CENTS ?? "99900"),
  },
];

export const DEFAULT_PHOTO_PACKAGE = getPhotoPackage("studio_40");
export const PHOTO_PACKAGE_CODE = DEFAULT_PHOTO_PACKAGE.code;
export const PHOTO_PACKAGE_NAME = DEFAULT_PHOTO_PACKAGE.name;
export const PHOTO_PACKAGE_DESCRIPTION = DEFAULT_PHOTO_PACKAGE.description;
export const PHOTO_PACKAGE_AMOUNT_CENTS = DEFAULT_PHOTO_PACKAGE.amountCents;

export function getPhotoPackage(code?: string | null) {
  return (
    PHOTO_PACKAGES.find((photoPackage) => photoPackage.code === code) ??
    PHOTO_PACKAGES.find((photoPackage) => photoPackage.code === "studio_40") ??
    PHOTO_PACKAGES[PHOTO_PACKAGES.length - 1]
  );
}

export function formatMoney(amountCents = PHOTO_PACKAGE_AMOUNT_CENTS, currency = PAYMENT_CURRENCY) {
  if (amountCents === 0) return "Бесплатно";

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}
