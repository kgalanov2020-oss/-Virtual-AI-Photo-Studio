import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const libDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(libDirectory, "../..");
const publicRoot = path.join(webRoot, "public");
const catalogPath = path.join(libDirectory, "studio-catalog.json");
const ratingPath = path.join(libDirectory, "studio-rating.ts");

async function readCatalog() {
  return JSON.parse(await readFile(catalogPath, "utf8"));
}

function publicFilePath(url) {
  assert.match(url, /^\/studios\/[a-z0-9-]+\/[a-z0-9-]+\.png$/);
  return path.join(publicRoot, ...url.slice(1).split("/"));
}

test("studio catalog slugs are unique and every studio has nine gallery views", async () => {
  const catalog = await readCatalog();
  const slugs = catalog.studios.map((studio) => studio.slug);

  assert.equal(new Set(slugs).size, slugs.length);

  for (const studio of catalog.studios) {
    assert.equal(studio.gallery_urls.length, 9, `${studio.slug} must have nine gallery views`);
    assert.match(
      studio.preview_url,
      new RegExp(`^/studios/${studio.slug}/[a-z0-9-]+\\.png$`),
      `${studio.slug} preview must stay inside its own asset directory`,
    );
  }
});

test("rating order contains every catalog studio exactly once", async () => {
  const catalog = await readCatalog();
  const ratingSource = await readFile(ratingPath, "utf8");
  const ratingBlock = ratingSource.match(
    /STUDIO_RATING_ORDER = \[([\s\S]*?)\] as const/,
  )?.[1];

  assert.ok(ratingBlock, "STUDIO_RATING_ORDER must remain a literal array");

  const rankedSlugs = [...ratingBlock.matchAll(/"([a-z0-9-]+)"/g)].map(
    (match) => match[1],
  );
  const catalogSlugs = catalog.studios.map((studio) => studio.slug);

  assert.equal(new Set(rankedSlugs).size, rankedSlugs.length);
  assert.deepEqual([...rankedSlugs].sort(), [...catalogSlugs].sort());
});

test("every catalog PNG has the WebP file served by preferWebpAsset", async () => {
  const catalog = await readCatalog();

  for (const studio of catalog.studios) {
    for (const url of [studio.preview_url, ...studio.gallery_urls]) {
      const pngPath = publicFilePath(url);
      const webpPath = pngPath.replace(/\.png$/, ".webp");

      await assert.doesNotReject(access(pngPath), `Missing catalog image: ${pngPath}`);
      await assert.doesNotReject(access(webpPath), `Missing WebP mirror: ${webpPath}`);
    }
  }
});
