import type { NextConfig } from "next";
import path from "node:path";
import { buildPublicAssetHeaderRules } from "./src/lib/static-assets-core.mjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cdn-image-loader.ts",
  },
  async headers() {
    return buildPublicAssetHeaderRules();
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
