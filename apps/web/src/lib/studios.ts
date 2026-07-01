import { createSupabaseBrowserClient, hasSupabaseEnv } from "./supabase";
import catalog from "./studio-catalog.json";
import type { Studio, StudioShot } from "./types";
import { translateShot, translateStudio } from "./ru";
import { preferWebpAsset } from "./assets";

type CatalogStudio = {
  slug: string;
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
    studios: ((data ?? []) as Studio[]).map(withCatalogMetadata).map(translateStudio),
  };
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

  return {
    ...studio,
    preview_url: preferWebpAsset(studio.preview_url),
    gallery_urls: catalogStudio?.gallery_urls?.map((url) => preferWebpAsset(url) ?? url),
    wardrobe_prompt: catalogStudio?.wardrobe_prompt,
  };
}
