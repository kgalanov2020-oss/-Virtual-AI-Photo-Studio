import type { Studio, StudioShot } from "./types";

const studioTranslations: Record<string, Pick<Studio, "name" | "description">> = {
  "modern-business-studio": {
    name: "Modern Business Studio",
    description:
      "Премиальная бизнес-фотосессия в современной офисной студии: чистый интерьер, мягкий дневной свет, аккуратный деловой образ и кадры, готовые для LinkedIn, резюме и личного бренда.",
  },
};

const shotTranslations: Record<
  string,
  Pick<StudioShot, "name" | "camera_angle" | "pose" | "crop">
> = {
  "window-portrait": {
    name: "Портрет у окна",
    camera_angle: "уровень глаз, портретный объектив 85 мм",
    pose: "стоя у большого офисного окна, расслабленные плечи",
    crop: "голова и плечи",
  },
  "executive-desk": {
    name: "За рабочим столом",
    camera_angle: "слегка нижний ракурс, объектив 70 мм",
    pose: "сидя за руководительским столом с ноутбуком, естественное положение рук",
    crop: "поясной портрет",
  },
  "arms-crossed": {
    name: "Скрещенные руки",
    camera_angle: "уровень глаз, объектив 50 мм",
    pose: "стоя со скрещенными руками, уверенная осанка",
    crop: "половина корпуса",
  },
  "startup-founder": {
    name: "Основатель стартапа",
    camera_angle: "ракурс три четверти, объектив 50 мм",
    pose: "лёгкий упор на стол, свободная деловая поза",
    crop: "по пояс",
  },
  "presentation-moment": {
    name: "Момент презентации",
    camera_angle: "боковой ракурс три четверти, объектив 70 мм",
    pose: "стоя рядом с экраном презентации, естественный жест рукой",
    crop: "три четверти корпуса",
  },
  "lounge-chair": {
    name: "В дизайнерском кресле",
    camera_angle: "уровень глаз, объектив 85 мм",
    pose: "сидя в дизайнерском кресле, спокойная уверенная поза",
    crop: "три четверти корпуса",
  },
  "black-background": {
    name: "Тёмный студийный фон",
    camera_angle: "уровень глаз, студийный объектив 85 мм",
    pose: "прямая стойка, спокойное уверенное выражение",
    crop: "голова и плечи",
  },
  "walking-office": {
    name: "Движение в офисе",
    camera_angle: "лёгкий телеобъектив, репортажный editorial-ракурс",
    pose: "идёт по современному офисному коридору, естественное движение",
    crop: "три четверти корпуса",
  },
  "close-up-editorial": {
    name: "Крупный editorial-портрет",
    camera_angle: "крупный план, портретный объектив 100 мм",
    pose: "лёгкий поворот к камере, собранное выражение лица",
    crop: "плотный крупный план",
  },
  "coffee-workspace": {
    name: "Рабочее место с кофе",
    camera_angle: "ракурс три четверти, объектив 50 мм",
    pose: "сидя за рабочим местом с кофе и ноутбуком, естественное положение рук",
    crop: "по пояс",
  },
};

export function translateStudio(studio: Studio): Studio {
  return {
    ...studio,
    ...studioTranslations[studio.slug],
  };
}

export function translateShot(shot: StudioShot): StudioShot {
  return {
    ...shot,
    ...shotTranslations[shot.slug],
  };
}
