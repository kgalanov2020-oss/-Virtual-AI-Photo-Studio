"use client";

import { publicCdnAssetUrl } from "./static-assets-core.mjs";

export default function cdnImageLoader({ src }: { src: string; width: number; quality?: number }) {
  return publicCdnAssetUrl(src);
}
