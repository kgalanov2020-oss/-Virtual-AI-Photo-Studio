"use client";

import { useEffect } from "react";
import { captureMarketingAttribution } from "@/lib/marketing-attribution";

export function MarketingAttributionTracker() {
  useEffect(() => {
    captureMarketingAttribution();
  }, []);

  return null;
}
