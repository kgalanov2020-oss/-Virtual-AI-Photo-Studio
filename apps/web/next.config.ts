import type { NextConfig } from "next";
import path from "node:path";
import {
  buildPublicAssetHeaderRules,
  STATIC_ASSET_VERSION,
} from "./src/lib/static-assets-core.mjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    localPatterns: [
      {
        pathname: "/studios/**",
        search: `?v=${STATIC_ASSET_VERSION}`,
      },
    ],
    minimumCacheTTL: 86_400,
  },
  async headers() {
    return buildPublicAssetHeaderRules();
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
