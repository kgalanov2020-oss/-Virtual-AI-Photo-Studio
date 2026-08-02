import { createSupabaseBrowserClient, hasSupabaseEnv } from "./supabase";
import catalog from "./studio-catalog.json";
import type { Studio, StudioShot } from "./types";
import { translateShot, translateStudio } from "./ru";
import { sortStudiosByRating } from "./studio-rating";
import { preferWebpAsset } from "./assets";
import { versionPublicAsset } from "./static-assets-core.mjs";

type CatalogStudio = {
  slug: string;
  name: string;
  description: string;
  preview_url: string | null;
  gallery_urls?: string[];
  wardrobe_prompt?: string;
};

const catalogBySlug = new Map(
  (catalog.studios as CatalogStudio[]).map((studio) => [studio.slug, studio]),
);

type StudioSessionResult =
  | { status: "ok"; studio: Studio; shots: StudioShot[] }
  | { status: "missing-env" }
  | { status: "error"; message: string };

type StudiosResult =
  | { status: "ok"; studios: Studio[] }
  | { status: "missing-env" }
  | { status: "error"; message: string };

export async function getActiveStudios(): Promise<StudiosResult> {
  if (!hasSupabaseEnv()) {
    return { status: "missing-env" };
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("studios")
    .select("id, slug, name, description, preview_url, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "ok",
    studios: sortStudiosByRating(
      ((data ?? []) as Studio[]).map(withCatalogMetadata).map(translateStudio),
    ),
  };
}

export function getCatalogStudios(): Studio[] {
  return sortStudiosByRating(
    (catalog.studios as CatalogStudio[])
      .map((studio, index) =>
        withCatalogMetadata({
          id: studio.slug,
          slug: studio.slug,
          name: studio.name,
          description: studio.description,
          preview_url: studio.preview_url,
          is_active: true,
          created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        }),
      )
      .map(translateStudio),
  );
}

export async function getStudioSession(
  slug: string,
): Promise<StudioSessionResult> {
  if (!hasSupabaseEnv()) {
    return { status: "missing-env" };
  }

  const supabase = createSupabaseBrowserClient();

  const { data: studioData, error: studioError } = await supabase
    .from("studios")
    .select("id, slug, name, description, preview_url, is_active, created_at")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (studioError) {
    return { status: "error", message: studioError.message };
  }

  if (!studioData) {
    return {
      status: "error",
      message: `No active studio found for slug "${slug}".`,
    };
  }

  const studio = withCatalogMetadata(studioData as Studio);

  const { data: shotsData, error: shotsError } = await supabase
    .from("studio_shots")
    .select(
      "id, studio_id, slug, name, camera_angle, pose, crop, prompt, negative_prompt, variations, sort_order, created_at",
    )
    .eq("studio_id", studio.id)
    .order("sort_order", { ascending: true });

  if (shotsError) {
    return { status: "error", message: shotsError.message };
  }

  return {
    status: "ok",
    studio: translateStudio(studio),
    shots: ((shotsData ?? []) as StudioShot[]).map(translateShot),
  };
}

function withCatalogMetadata(studio: Studio): Studio {
  const catalogStudio = catalogBySlug.get(studio.slug);
  const previewUrl = studio.preview_url ?? catalogStudio?.preview_url ?? null;

  return {
    ...studio,
    preview_url: versionCatalogAsset(previewUrl),
    card_preview_url: versionCatalogAsset(cardPreviewUrl(studio.slug, previewUrl)),
    gallery_urls: catalogStudio?.gallery_urls
      ?.map((url) => versionCatalogAsset(url))
      .filter((url): url is string => Boolean(url)),
    wardrobe_prompt: catalogStudio?.wardrobe_prompt,
  };
}

function versionCatalogAsset(url: string | null | undefined): string | null {
  const webpUrl = preferWebpAsset(url);
  return webpUrl ? versionPublicAsset(webpUrl) : null;
}

function cardPreviewUrl(slug: string, previewUrl: string | null): string | null {
  if (!previewUrl?.startsWith(`/studios/${slug}/`)) {
    return previewUrl;
  }

  return `/studios/${slug}/preview-card.webp`;
}
