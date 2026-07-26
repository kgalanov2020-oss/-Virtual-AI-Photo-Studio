export const STATIC_ASSET_VERSION: string;
export const STATIC_ASSET_CDN_REVISION: string;
export const STATIC_ASSET_CDN_BASE: string;
export const CACHEABLE_PUBLIC_ASSET_ROUTES: string[];

export type PublicAssetHeader = {
  key: string;
  value: string;
};

export type PublicAssetHeaderRule = {
  source: string;
  has?: Array<{
    type: "query";
    key: string;
    value: string;
  }>;
  headers: PublicAssetHeader[];
};

export function versionPublicAsset(url: string): string;
export function publicCdnAssetUrl(url: string): string;
export function buildPublicAssetHeaderRules(): PublicAssetHeaderRule[];
