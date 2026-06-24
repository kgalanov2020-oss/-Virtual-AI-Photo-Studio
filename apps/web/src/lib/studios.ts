import { createSupabaseBrowserClient, hasSupabaseEnv } from "./supabase";
import type { Studio, StudioShot } from "./types";

type StudioSessionResult =
  | { status: "ok"; studio: Studio; shots: StudioShot[] }
  | { status: "missing-env" }
  | { status: "error"; message: string };

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

  const studio = studioData as Studio;

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

  return { status: "ok", studio, shots: (shotsData ?? []) as StudioShot[] };
}
