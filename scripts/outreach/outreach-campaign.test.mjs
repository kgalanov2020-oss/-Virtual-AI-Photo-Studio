import assert from "node:assert/strict";
import test from "node:test";
import {
  MIXED_SEGMENT,
  PHOTO_BOOTH_SEGMENT,
  PHOTO_STUDIO_SEGMENT,
  buildOutreachSubject,
  buildOutreachText,
  capSendLimitForMode,
  getPromoCodeForLead,
  normalizeOutreachMode,
  selectNextLeads,
} from "./outreach-campaign.mjs";

const studio = { email: "studio@example.com", id: "studio", status: "new", raw: {} };
const legacyStudio = { email: "legacy@example.com", id: "legacy", status: "approved", raw: null };
const approvedBooth = {
  email: "booth@example.com",
  id: "booth-approved",
  promo_code: "STUDIO",
  status: "approved",
  raw: { segment: PHOTO_BOOTH_SEGMENT },
};
const unreviewedBooth = {
  email: "new-booth@example.com",
  id: "booth-new",
  status: "new",
  raw: { segment: PHOTO_BOOTH_SEGMENT },
};

test("unknown outreach mode remains the legacy photo-studio queue", () => {
  assert.equal(normalizeOutreachMode(undefined), PHOTO_STUDIO_SEGMENT);
  assert.equal(normalizeOutreachMode("unexpected"), PHOTO_STUDIO_SEGMENT);
  assert.equal(normalizeOutreachMode(MIXED_SEGMENT), MIXED_SEGMENT);
});

test("studio and booth queues never mix, and booths require approval", () => {
  const candidates = [studio, approvedBooth, unreviewedBooth, legacyStudio];

  assert.deepEqual(
    selectNextLeads(candidates, PHOTO_STUDIO_SEGMENT, null, 10).map((lead) => lead.id),
    ["studio", "legacy"],
  );
  assert.deepEqual(
    selectNextLeads(candidates, PHOTO_BOOTH_SEGMENT, null, 10).map((lead) => lead.id),
    ["booth-approved"],
  );
});

test("mixed mode alternates with fallback and never selects more than one lead", () => {
  const candidates = [studio, approvedBooth, legacyStudio];

  assert.deepEqual(
    selectNextLeads(candidates, MIXED_SEGMENT, PHOTO_STUDIO_SEGMENT, 50).map(
      (lead) => lead.id,
    ),
    ["booth-approved"],
  );
  assert.deepEqual(
    selectNextLeads(candidates, MIXED_SEGMENT, PHOTO_BOOTH_SEGMENT, 50).map(
      (lead) => lead.id,
    ),
    ["studio"],
  );
  assert.deepEqual(
    selectNextLeads([studio], MIXED_SEGMENT, PHOTO_STUDIO_SEGMENT, 50).map(
      (lead) => lead.id,
    ),
    ["studio"],
  );
  assert.equal(capSendLimitForMode(100, MIXED_SEGMENT), 1);
});

test("booth campaign enforces CABIN and uses its own proposal", () => {
  const promoCode = getPromoCodeForLead(approvedBooth, PHOTO_BOOTH_SEGMENT, {});
  const variables = {
    promo_code: promoCode,
    segment: PHOTO_BOOTH_SEGMENT,
    studio_name: "Photo Booth Co",
  };

  assert.equal(promoCode, "CABIN");
  assert.match(buildOutreachSubject(variables), /модуль для фотокабин/);
  assert.match(buildOutreachText(variables), /промокод CABIN/);
  assert.doesNotMatch(buildOutreachText(variables), /бонус к пакету/);
});
