import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import {
  CACHEABLE_PUBLIC_ASSET_ROUTES,
  STATIC_ASSET_VERSION,
  buildPublicAssetHeaderRules,
  versionPublicAsset,
} from "./static-assets-core.mjs";

const require = createRequire(import.meta.url);
const { pathToRegexp } = require("next/dist/compiled/path-to-regexp");

test("versions only the public asset namespaces served by this app", () => {
  assert.equal(
    versionPublicAsset("/studios/modern-office/preview.webp"),
    `/studios/modern-office/preview.webp?v=${STATIC_ASSET_VERSION}`,
  );
  assert.equal(
    versionPublicAsset("/selfie-guide/01-front-neutral.webp?size=small"),
    `/selfie-guide/01-front-neutral.webp?size=small&v=${STATIC_ASSET_VERSION}`,
  );
  assert.equal(
    versionPublicAsset(`/before-after/result.webp?v=${STATIC_ASSET_VERSION}`),
    `/before-after/result.webp?v=${STATIC_ASSET_VERSION}`,
  );
  assert.equal(versionPublicAsset("https://cdn.example.com/result.webp"), "https://cdn.example.com/result.webp");
  assert.equal(versionPublicAsset("blob:https://virtualphotostudio.ru/photo"), "blob:https://virtualphotostudio.ru/photo");
});

test("uses bounded edge caching for stable paths and immutable caching only for the current version", () => {
  const rules = buildPublicAssetHeaderRules();

  assert.equal(rules.length, CACHEABLE_PUBLIC_ASSET_ROUTES.length * 2);

  for (const source of CACHEABLE_PUBLIC_ASSET_ROUTES) {
    const sharedRule = rules.find((rule) => rule.source === source && !rule.has);
    const immutableRule = rules.find((rule) => rule.source === source && rule.has);

    assert.ok(sharedRule);
    assert.match(
      sharedRule.headers.find((header) => header.key === "Cache-Control")?.value ?? "",
      /max-age=300.*s-maxage=86400/,
    );

    assert.deepEqual(immutableRule?.has, [
      { type: "query", key: "v", value: STATIC_ASSET_VERSION },
    ]);
    assert.equal(
      immutableRule?.headers.find((header) => header.key === "Cache-Control")?.value,
      "public, max-age=31536000, immutable",
    );
    assert.equal(
      immutableRule?.headers.find((header) => header.key === "Cloudflare-CDN-Cache-Control")?.value,
      "public, max-age=31536000, immutable",
    );
  }
});

test("asset cache routes match media files but never the dynamic studio HTML route", () => {
  const studioRule = CACHEABLE_PUBLIC_ASSET_ROUTES.find((source) => source.startsWith("/studios/"));
  assert.ok(studioRule);

  const matcher = pathToRegexp(studioRule);
  assert.equal(matcher.test("/studios/modern-office"), false);
  assert.equal(matcher.test("/studios/modern-office/preview.webp"), true);
  assert.equal(matcher.test("/studios/modern-office/angle-01.jpg"), true);
  assert.equal(matcher.test("/studios/modern-office/notes.txt"), false);
});

test("CSS background assets use the same immutable version as the cache rule", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const backgroundUrl = `/studios/modern-office/master-wide.webp?v=${STATIC_ASSET_VERSION}`;

  assert.ok(css.includes(backgroundUrl));
  assert.equal(css.includes('/studios/modern-office/master-wide.webp")'), false);
});
