import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSelfieStoragePath,
  MAX_SELFIE_BYTES,
  resolveSelfieContentType,
  sanitizeSelfieFileName,
} from "./selfie-upload.mjs";

const uploadPageUrl = new URL("../app/upload/page.tsx", import.meta.url);
const uploadRouteUrl = new URL("../app/api/jobs/[jobId]/selfies/route.ts", import.meta.url);

test("normalizes mobile photo names without changing supported extension", () => {
  assert.equal(sanitizeSelfieFileName(" IMG_3354.jpeg "), "img_3354.jpeg");
  assert.equal(sanitizeSelfieFileName("Фото ребёнка (1).HEIC"), "фото-ребёнка-1.heic");
});

test("uses a safe fallback for empty or punctuation-only file names", () => {
  assert.equal(sanitizeSelfieFileName("..."), "photo.jpg");
});

test("accepts supported MIME types and repairs empty iOS MIME types from extension", () => {
  assert.equal(resolveSelfieContentType("IMG_3354.jpeg", "image/jpeg"), "image/jpeg");
  assert.equal(resolveSelfieContentType("IMG_3354.HEIC", ""), "image/heic");
  assert.equal(resolveSelfieContentType("document.pdf", "application/pdf"), null);
  assert.equal(MAX_SELFIE_BYTES, 10_485_760);
});

test("builds deterministic per-slot storage paths and rejects invalid slots", () => {
  assert.equal(
    buildSelfieStoragePath({
      userId: "user-id",
      jobId: "job-id",
      slot: 2,
      fileName: "IMG 3354.jpeg",
    }),
    "user-id/job-id/02-img-3354.jpeg",
  );
  assert.throws(
    () =>
      buildSelfieStoragePath({
        userId: "user-id",
        jobId: "job-id",
        slot: 13,
        fileName: "photo.jpg",
      }),
    /Недопустимый номер фото/,
  );
});

test("browser sends mobile photo bytes through the same-origin API", async () => {
  const source = await readFile(uploadPageUrl, "utf8");

  assert.match(source, /fetch\(`\/api\/jobs\/\$\{jobId\}\/selfies`/);
  assert.doesNotMatch(source, /\.storage\s*\.from\("selfies"\)\s*\.upload/);
  assert.doesNotMatch(source, /\.from\("uploaded_selfies"\)\s*\.insert/);
  assert.match(source, /attempt <= 3/);
  assert.match(source, /Загружаем фото \$\{index \+ 1\} из \$\{selfies\.length\}/);
});

test("server upload route verifies access and enforces image limits", async () => {
  const source = await readFile(uploadRouteUrl, "utf8");

  assert.match(source, /createSupabaseAdminClient/);
  assert.match(source, /job\.user_id !== user\.id/);
  assert.match(source, /job\.status !== "draft"/);
  assert.match(source, /MAX_SELFIE_BYTES/);
  assert.match(source, /resolveSelfieContentType/);
  assert.match(source, /upsert: true/);
  assert.match(source, /storage\.from\("selfies"\)\.remove\(\[filePath\]\)/);
});
