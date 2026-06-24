import { NextRequest, NextResponse } from "next/server";
import { generateBusinessPortrait } from "@/lib/comfy/client";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { Job, StudioShot, UploadedSelfie } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const token = readBearerToken(request);
    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("id, user_id, studio_id, status, progress, error_message, created_at, queued_at, started_at, completed_at")
      .eq("id", jobId)
      .single();

    if (jobError || !jobData) {
      return NextResponse.json({ error: jobError?.message ?? "Job не найден." }, { status: 404 });
    }

    const job = jobData as Job;

    if (job.user_id !== userId) {
      return NextResponse.json({ error: "Нет доступа к этому job." }, { status: 403 });
    }

    if (!["queued", "running", "failed"].includes(job.status)) {
      return NextResponse.json(
        { error: "Job должен быть в статусе queued, running или failed." },
        { status: 409 },
      );
    }

    const [
      { data: selfieData, error: selfieError },
      { data: shotData, error: shotError },
      { data: generatedData, error: generatedError },
    ] =
      await Promise.all([
        supabase
          .from("uploaded_selfies")
          .select("id, job_id, user_id, file_url, quality_score, face_angle, is_approved, rejection_reason, created_at")
          .eq("job_id", jobId)
          .eq("is_approved", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .single(),
        supabase
          .from("studio_shots")
          .select("id, studio_id, slug, name, camera_angle, pose, crop, prompt, negative_prompt, variations, sort_order, created_at")
          .eq("studio_id", job.studio_id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("generated_images")
          .select("id, job_id, user_id, studio_shot_id, image_url, seed, variation_index, is_favorite, created_at")
          .eq("job_id", jobId),
      ]);

    if (selfieError || !selfieData) {
      return NextResponse.json(
        { error: selfieError?.message ?? "Не найдено принятое селфи." },
        { status: 400 },
      );
    }

    if (shotError || !shotData?.length) {
      return NextResponse.json(
        { error: shotError?.message ?? "Не найден ракурс студии." },
        { status: 400 },
      );
    }

    if (generatedError) {
      return NextResponse.json({ error: generatedError.message }, { status: 400 });
    }

    const selfie = selfieData as UploadedSelfie;
    const shots = shotData as StudioShot[];
    const generated = generatedData ?? [];
    const totalExpected = shots.reduce((sum, shot) => sum + shot.variations, 0);
    const completedBefore = generated.length;
    const nextTarget = findNextTarget(shots, generated);

    if (!nextTarget) {
      await supabase
        .from("jobs")
        .update({
          status: "completed",
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({
        ok: true,
        done: true,
        completed: completedBefore,
        total: totalExpected,
      });
    }

    const { shot, variationIndex } = nextTarget;

    await supabase
      .from("jobs")
      .update({
        status: "running",
        progress: calculateProgress(completedBefore, totalExpected),
        started_at: job.started_at ?? new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);

    const { data: selfieBlob, error: downloadError } = await supabase.storage
      .from("selfies")
      .download(selfie.file_url);

    if (downloadError || !selfieBlob) {
      throw new Error(downloadError?.message ?? "Не удалось скачать селфи из Supabase.");
    }

    const result = await generateBusinessPortrait(selfieBlob, {
      prompt: buildPositivePrompt(shot),
      negativePrompt: buildNegativePrompt(shot),
      fileNamePrefix: `ai-photo-studio/${jobId}/${shot.slug}-${variationIndex}`,
    });

    const generatedPath = `${userId}/${jobId}/${shot.slug}-${variationIndex}.png`;
    const { error: uploadError } = await supabase.storage
      .from("generated")
      .upload(generatedPath, result.bytes, {
        contentType: result.contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from("generated")
      .getPublicUrl(generatedPath);

    const { error: imageError } = await supabase.from("generated_images").insert({
      job_id: jobId,
      user_id: userId,
      studio_shot_id: shot.id,
      image_url: publicUrlData.publicUrl,
      seed: null,
      variation_index: variationIndex,
      is_favorite: false,
    });

    if (imageError) {
      throw new Error(imageError.message);
    }

    const completedAfter = completedBefore + 1;
    const isDone = completedAfter >= totalExpected;

    await supabase
      .from("jobs")
      .update({
        status: isDone ? "completed" : "running",
        progress: isDone ? 100 : calculateProgress(completedAfter, totalExpected),
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .eq("id", jobId);

    return NextResponse.json({
      ok: true,
      done: isDone,
      completed: completedAfter,
      total: totalExpected,
      image_url: publicUrlData.publicUrl,
      comfy_file: result.fileName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка.";

    try {
      const supabase = createSupabaseAdminClient();
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          progress: 0,
          error_message: message,
        })
        .eq("id", jobId);
    } catch {
      // Keep the original generation error.
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function findNextTarget(
  shots: StudioShot[],
  generated: Array<{ studio_shot_id: string; variation_index: number }>,
) {
  const completedKeys = new Set(
    generated.map((image) => `${image.studio_shot_id}:${image.variation_index}`),
  );

  for (const shot of shots) {
    for (let variationIndex = 1; variationIndex <= shot.variations; variationIndex += 1) {
      if (!completedKeys.has(`${shot.id}:${variationIndex}`)) {
        return { shot, variationIndex };
      }
    }
  }

  return null;
}

function calculateProgress(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(5, Math.min(99, Math.round((completed / total) * 100)));
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Нет токена пользователя.");
  }

  return token;
}

function buildPositivePrompt(shot: StudioShot) {
  return [
    "professional business portrait photo of the exact same person",
    "preserve facial identity, same gender, same age, same eyes, same nose, same lips",
    "natural skin texture, realistic human face, premium LinkedIn profile photography",
    "modern office studio, clean interiors, soft daylight, polished wardrobe",
    "sharp focus, high detail, 85mm lens, cinematic lighting",
    shot.prompt,
  ].join(", ");
}

function buildNegativePrompt(shot: StudioShot) {
  return [
    "nsfw, nude, naked, porn, erotic",
    "wrong gender, different person, deformed face, bad anatomy, bad eyes",
    "cropped head, cut face, duplicate, mutated, extra limbs, watermark, text, logo",
    "cartoon, anime, cgi, 3d render, oversmoothed skin, blurry, low quality",
    shot.negative_prompt,
  ].join(", ");
}
