import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeMarketingCampaign,
  normalizeMarketingMedium,
  normalizeMarketingSource,
} from "./marketing-attribution-core.mjs";

const attributionUrl = new URL("./marketing-attribution.ts", import.meta.url);

test("normalizes the supported advertising channel aliases", () => {
  assert.equal(normalizeMarketingSource("VK"), "vk");
  assert.equal(normalizeMarketingSource("vkblogger"), "vk_blogger");
  assert.equal(normalizeMarketingSource("vk-blogger"), "vk_blogger");
  assert.equal(normalizeMarketingSource("yandex_direct"), "yandex");
  assert.equal(normalizeMarketingSource("zen"), "dzen");
});

test("normalizes paid, influencer and article media without losing other values", () => {
  assert.equal(normalizeMarketingMedium("CPC"), "cpc");
  assert.equal(normalizeMarketingMedium("influence"), "influencer");
  assert.equal(normalizeMarketingMedium("article"), "article");
  assert.equal(normalizeMarketingMedium("referral"), "referral");
});

test("uses canonical campaign names while preserving existing campaign IDs", () => {
  assert.equal(normalizeMarketingCampaign("registration-test"), "registration_test");
  assert.equal(normalizeMarketingCampaign("first-post"), "first_post");
  assert.equal(normalizeMarketingCampaign("vkblog03"), "vkblog03");
  assert.equal(normalizeMarketingCampaign("campaign-id-8472"), "campaign-id-8472");
});

test("captures both VK and Yandex click identifiers", async () => {
  const source = await readFile(attributionUrl, "utf8");

  assert.match(source, /"vk_click_id"/);
  assert.match(source, /"yclid"/);
  assert.match(source, /url\.searchParams\.get\("yclid"\)/);
});
