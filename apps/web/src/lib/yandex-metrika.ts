"use client";

import { dispatchYandexGoal } from "@/lib/yandex-metrika-core.mjs";

export type YandexGoalParams = {
  [key: string]: string | number | null | undefined;
  currency?: string | null;
  value?: number;
  order_price?: number;
  product_code?: string | null;
  image_count?: number | null;
  payment_method?: "yookassa";
};

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

const counterId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;

export function trackYandexGoal(goal: string, params: YandexGoalParams = {}) {
  if (typeof window === "undefined") return false;

  return dispatchYandexGoal({
    counterId,
    goal,
    params,
    target: window,
  });
}
