const sourceAliases = new Map([
  ["vkads", "vk"],
  ["vk_ads", "vk"],
  ["vkontakte", "vk"],
  ["yandex-direct", "yandex"],
  ["yandex_direct", "yandex"],
  ["vk-blogger", "vk_blogger"],
  ["vkblogger", "vk_blogger"],
  ["yandex_zen", "dzen"],
  ["zen", "dzen"],
]);

const mediumAliases = new Map([
  ["influence", "influencer"],
  ["influencer_marketing", "influencer"],
  ["paid-social", "cpc"],
  ["paid_social", "cpc"],
  ["ppc", "cpc"],
]);

const campaignAliases = new Map([
  ["registration-test", "registration_test"],
  ["registrationtest", "registration_test"],
  ["first-post", "first_post"],
]);

export function normalizeMarketingSource(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  return sourceAliases.get(normalized) ?? normalized;
}

export function normalizeMarketingMedium(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  return mediumAliases.get(normalized) ?? normalized;
}

export function normalizeMarketingCampaign(value) {
  const normalized = normalizeNullableValue(value);
  if (!normalized) return null;

  const alias = campaignAliases.get(normalized.toLowerCase());
  return alias ?? normalized;
}

export function normalizeNullableMarketingValue(value) {
  return normalizeNullableValue(value);
}

function normalizeToken(value) {
  const normalized = normalizeNullableValue(value);
  return normalized?.toLowerCase() ?? null;
}

function normalizeNullableValue(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}
