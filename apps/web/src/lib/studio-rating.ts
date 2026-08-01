import type { Studio } from "./types";

/**
 * Catalog order as of 2026-07-26.
 *
 * New editorial releases receive an initial launch rating so visitors can
 * discover them. Established studios follow the anonymised production
 * popularity snapshot: completed sessions first, then paid sessions and jobs.
 * Unknown studios stay visible at the end in their original order.
 */
export const STUDIO_RATING_ORDER = [
  "old-moscow",
  "cliffside-coast",
  "red-carpet-premiere",
  "alpine-chalet",
  "tropical-conservatory",
  "joki-joya-moscow",
  "podcast-studio",
  "white-cyclorama-studio",
  "modern-office",
  "yacht-marina",
  "black-photo-studio",
  "private-jet",
  "pit-lane-racing",
  "beach-club",
  "luxury-penthouse",
  "powder-blue-studio",
  "art-gallery",
  "cyprus-villa",
  "desert-dunes",
  "fine-dining-restaurant",
  "music-recording-studio",
  "premium-gym",
  "paris-street",
  "moroccan-riad",
  "luxury-garage",
  "italian-villa-garden",
  "tokyo-neon-night",
  "city-rooftop",
  "metropolis-streets",
  "urban-loft",
  "golf-club",
  "pink-pastel-studio",
  "vip-airport-terminal",
  "new-york-editorial-street",
  "boutique-hotel",
  "castle-library",
  "hi-tech-lab",
  "executive-boardroom",
  "fashion-boutique",
  "wellness-spa",
] as const;

const studioRatingRank = new Map<string, number>(
  STUDIO_RATING_ORDER.map((slug, index) => [slug, index]),
);

export function sortStudiosByRating(studios: Studio[]): Studio[] {
  return studios
    .map((studio, originalIndex) => ({ studio, originalIndex }))
    .sort((left, right) => {
      const leftRank =
        studioRatingRank.get(left.studio.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightRank =
        studioRatingRank.get(right.studio.slug) ?? Number.MAX_SAFE_INTEGER;

      return leftRank - rightRank || left.originalIndex - right.originalIndex;
    })
    .map(({ studio }) => studio);
}
