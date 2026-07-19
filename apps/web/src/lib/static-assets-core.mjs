export const STATIC_ASSET_VERSION = "2026-07-19-mobile-images-1";

const PUBLIC_ASSET_EXTENSION_PATTERN =
  "avif|gif|heic|heif|jpeg|jpg|mp4|png|svg|webm|webp";

export const CACHEABLE_PUBLIC_ASSET_ROUTES = [
  `/before-after/:path*\\.:extension(${PUBLIC_ASSET_EXTENSION_PATTERN})`,
  `/selfie-guide/:path*\\.:extension(${PUBLIC_ASSET_EXTENSION_PATTERN})`,
  `/studios/:path*\\.:extension(${PUBLIC_ASSET_EXTENSION_PATTERN})`,
  `/avatar-showcase/:path*\\.:extension(${PUBLIC_ASSET_EXTENSION_PATTERN})`,
];

const CACHEABLE_PUBLIC_ASSET_PREFIXES = [
  "/before-after/",
  "/selfie-guide/",
  "/studios/",
  "/avatar-showcase/",
];

const EDGE_CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";
const VERSIONED_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function versionPublicAsset(url) {
  if (
    typeof url !== "string" ||
    !CACHEABLE_PUBLIC_ASSET_PREFIXES.some((prefix) => url.startsWith(prefix))
  ) {
    return url;
  }

  const [urlWithoutHash, hash = ""] = url.split("#", 2);
  const [pathname, search = ""] = urlWithoutHash.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("v", STATIC_ASSET_VERSION);

  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

export function buildPublicAssetHeaderRules() {
  const sharedEdgeHeaders = [
    { key: "Cache-Control", value: EDGE_CACHE_CONTROL },
    {
      key: "Cloudflare-CDN-Cache-Control",
      value: "public, max-age=86400, stale-while-revalidate=604800",
    },
  ];
  const versionedHeaders = [
    { key: "Cache-Control", value: VERSIONED_CACHE_CONTROL },
    { key: "Cloudflare-CDN-Cache-Control", value: VERSIONED_CACHE_CONTROL },
  ];

  return CACHEABLE_PUBLIC_ASSET_ROUTES.flatMap((source) => [
    {
      source,
      headers: sharedEdgeHeaders,
    },
    {
      source,
      has: [
        {
          type: "query",
          key: "v",
          value: STATIC_ASSET_VERSION,
        },
      ],
      headers: versionedHeaders,
    },
  ]);
}
