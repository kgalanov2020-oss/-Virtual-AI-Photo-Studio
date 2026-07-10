"use client";

const VK_PIXEL_ID = "3777361";

type VkPixelEventParams = {
  value?: number;
  product_code?: string | null;
  image_count?: number | null;
  studio_slug?: string | null;
  generation_mode?: string | null;
  payment_method?: "balance" | "yookassa";
};

declare global {
  interface Window {
    _tmr?: Array<Record<string, unknown>>;
  }
}

export function trackVkGoal(goal: string, params: VkPixelEventParams = {}) {
  if (typeof window === "undefined") return;

  window._tmr = window._tmr || [];
  window._tmr.push({
    id: VK_PIXEL_ID,
    type: "reachGoal",
    goal,
    ...compactParams(params),
  });
}

function compactParams(params: VkPixelEventParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
  );
}
