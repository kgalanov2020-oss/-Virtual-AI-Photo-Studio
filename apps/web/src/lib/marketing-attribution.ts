import {
  normalizeMarketingCampaign,
  normalizeMarketingMedium,
  normalizeMarketingSource,
  normalizeNullableMarketingValue,
} from "@/lib/marketing-attribution-core.mjs";

const STORAGE_KEY = "vaps_marketing_attribution";

export type MarketingAttribution = {
  source: string;
  medium: string;
  campaign: string | null;
  content: string | null;
  term: string | null;
  click_id: string | null;
  landing_page: string;
  referrer: string | null;
  captured_at: string;
};

export type MarketingAttributionStore = {
  first: MarketingAttribution;
  last: MarketingAttribution;
};

export function captureMarketingAttribution(): MarketingAttributionStore | null {
  if (typeof window === "undefined") return null;

  const existing = getStoredMarketingAttribution();
  const url = new URL(window.location.href);
  const referrer = getExternalReferrer();
  const hasCampaignParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "vk_click_id",
    "yclid",
    "click_id",
  ].some((key) => url.searchParams.has(key));

  if (existing && !hasCampaignParams && !referrer) return existing;

  const current: MarketingAttribution = {
    source:
      normalizeMarketingSource(
        url.searchParams.get("utm_source") || getReferrerHost(referrer) || "direct",
      ) ?? "direct",
    medium:
      normalizeMarketingMedium(
        url.searchParams.get("utm_medium") || (referrer ? "referral" : "none"),
      ) ?? "none",
    campaign: normalizeMarketingCampaign(url.searchParams.get("utm_campaign")),
    content: normalizeNullableMarketingValue(url.searchParams.get("utm_content")),
    term: normalizeNullableMarketingValue(url.searchParams.get("utm_term")),
    click_id: normalizeNullableMarketingValue(
      url.searchParams.get("vk_click_id") ||
        url.searchParams.get("yclid") ||
        url.searchParams.get("click_id"),
    ),
    landing_page: `${url.pathname}${url.search}`,
    referrer,
    captured_at: new Date().toISOString(),
  };

  const next = {
    first: existing?.first ?? current,
    last: current,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }

  return next;
}

export function getStoredMarketingAttribution(): MarketingAttributionStore | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as MarketingAttributionStore;
    if (!parsed?.first?.source || !parsed?.last?.source) return null;
    return {
      first: normalizeAttribution(parsed.first),
      last: normalizeAttribution(parsed.last),
    };
  } catch {
    return null;
  }
}

function normalizeAttribution(attribution: MarketingAttribution): MarketingAttribution {
  return {
    ...attribution,
    source: normalizeMarketingSource(attribution.source) ?? "direct",
    medium: normalizeMarketingMedium(attribution.medium) ?? "none",
    campaign: normalizeMarketingCampaign(attribution.campaign),
    content: normalizeNullableMarketingValue(attribution.content),
    term: normalizeNullableMarketingValue(attribution.term),
    click_id: normalizeNullableMarketingValue(attribution.click_id),
  };
}

function getExternalReferrer() {
  if (!document.referrer) return null;

  try {
    const referrerUrl = new URL(document.referrer);
    return referrerUrl.origin === window.location.origin ? null : document.referrer;
  } catch {
    return null;
  }
}

function getReferrerHost(referrer: string | null) {
  if (!referrer) return null;

  try {
    return new URL(referrer).hostname;
  } catch {
    return null;
  }
}
