import { NextRequest, NextResponse } from "next/server";
import catalog from "@/lib/studio-catalog.json";
import { getBodyBuildPrompt } from "@/lib/body-profile";
import { generateBusinessPortrait } from "@/lib/comfy/client";
import { getTargetShots, getTargetVariationCount, isTargetVariation } from "@/lib/generation";
import { generateGeminiStudioPhoto } from "@/lib/gemini/client";
import { PAYMENTS_ENABLED } from "@/lib/payments";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { BodyBuild, BodyProfile } from "@/lib/body-profile";
import type { GenerationMode, Job, StudioShot, UploadedSelfie } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

type CatalogStudio = {
  slug: string;
  wardrobe_prompt?: string;
};

const wardrobeByStudioSlug = new Map(
  (catalog.studios as CatalogStudio[]).map((studio) => [studio.slug, studio.wardrobe_prompt]),
);

export async function POST(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;
  let lastKnownCompleted = 0;
  let lastKnownTotal = 0;
  let activeGenerationMode: GenerationMode = "standard";
  const requestBody = await readRequestBody(request);
  const bodyBuildOverride = requestBody.bodyProfile?.bodyBuild ?? null;

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
      .select("id, user_id, studio_id, generation_mode, status, payment_status, paid_at, amount_cents, currency, product_code, target_image_count, progress, error_message, created_at, queued_at, started_at, completed_at")
      .eq("id", jobId)
      .single();

    if (jobError || !jobData) {
      return NextResponse.json({ error: jobError?.message ?? "Job не найден." }, { status: 404 });
    }

    const job = jobData as Job;

    if (job.user_id !== userId) {
      return NextResponse.json({ error: "Нет доступа к этому job." }, { status: 403 });
    }

    if (PAYMENTS_ENABLED && job.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Генерация доступна только после оплаты фотосессии." },
        { status: 402 },
      );
    }

    const shouldDebitPhotoBalance = true;

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
      { data: studioData, error: studioError },
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
        supabase
          .from("studios")
          .select("slug")
          .eq("id", job.studio_id)
          .single(),
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

    if (studioError || !studioData) {
      return NextResponse.json(
        { error: studioError?.message ?? "Не найдена студия для job." },
        { status: 400 },
      );
    }

    const selfie = selfieData as UploadedSelfie;
    const shots = shotData as StudioShot[];
    const studioSlug = (studioData as { slug: string }).slug;
    const wardrobePrompt = wardrobeByStudioSlug.get(studioSlug);
    const targetShots = getTargetShots(shots);
    const limitedTargets = getLimitedGenerationTargets(targetShots, job.target_image_count);
    const generated = generatedData ?? [];
    const targetGenerated = generated.filter((image) => isTargetVariation(image.variation_index));
    const targetKeys = new Set(
      limitedTargets.map(({ shot, variationIndex }) => `${shot.id}:${variationIndex}`),
    );
    const totalExpected = limitedTargets.length;
    const completedBefore = new Set(
      targetGenerated
        .map((image) => `${image.studio_shot_id}:${image.variation_index}`)
        .filter((key) => targetKeys.has(key)),
    ).size;
    lastKnownCompleted = completedBefore;
    lastKnownTotal = totalExpected;
    const nextTarget = findNextTarget(limitedTargets, targetGenerated);

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

    if (shouldDebitPhotoBalance && completedBefore < totalExpected) {
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("free_images_remaining")
        .eq("user_id", userId)
        .single();

      if (profileError || !profile) {
        return NextResponse.json(
          { error: "Профиль пользователя не найден." },
          { status: 400 },
        );
      }

      if (profile.free_images_remaining < 1) {
        return NextResponse.json(
          { error: "Бесплатные фото закончились. Выберите платный пакет." },
          { status: 402 },
        );
      }
    }

    const { shot, variationIndex } = nextTarget;
    const generationMode = job.generation_mode ?? "standard";
    activeGenerationMode = generationMode;

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

    const generationPrompt = {
      prompt: buildPositivePrompt(
        shot,
        variationIndex,
        generationMode,
        wardrobePrompt,
        bodyBuildOverride,
      ),
      negativePrompt: buildNegativePrompt(shot, generationMode),
      fileNamePrefix: `ai-photo-studio/${jobId}/${shot.slug}-${variationIndex}`,
      ...buildGenerationSettings(shot, generationMode),
    };
    const provider = getImageProvider();
    const result =
      provider === "gemini"
        ? await generateGeminiStudioPhoto(selfieBlob, generationPrompt)
        : await generateBusinessPortrait(selfieBlob, generationPrompt);

    const generatedExtension = provider === "gemini" ? "jpg" : "png";
    const generatedContentType = provider === "gemini" ? "image/jpeg" : result.contentType;
    const generatedPath = `${userId}/${jobId}/${shot.slug}-${variationIndex}.${generatedExtension}`;
    const { error: uploadError } = await supabase.storage
      .from("generated")
      .upload(generatedPath, result.bytes, {
        contentType: generatedContentType,
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
    lastKnownCompleted = completedAfter;

    await supabase
      .from("jobs")
      .update({
        status: isDone ? "completed" : "running",
        progress: isDone ? 100 : calculateProgress(completedAfter, totalExpected),
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .eq("id", jobId);

    if (shouldDebitPhotoBalance) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("free_images_remaining")
        .eq("user_id", userId)
        .single();

      const freeImagesRemaining = Math.max(0, (profile?.free_images_remaining ?? 0) - 1);

      await supabase
        .from("user_profiles")
        .update({
          free_images_remaining: freeImagesRemaining,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    return NextResponse.json({
      ok: true,
      done: isDone,
      completed: completedAfter,
      total: totalExpected,
      image_url: publicUrlData.publicUrl,
      provider,
      comfy_file: result.fileName,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Неизвестная ошибка.";
    const message = normalizeGenerationError(rawMessage, error, activeGenerationMode);
    const retryableError = isRetryableGenerationError(message);

    try {
      const supabase = createSupabaseAdminClient();
      await supabase
        .from("jobs")
        .update({
          status: lastKnownCompleted > 0 || retryableError ? "running" : "failed",
          progress:
            lastKnownTotal > 0 ? calculateProgress(lastKnownCompleted, lastKnownTotal) : 0,
          error_message: message,
          completed_at: null,
        })
        .eq("id", jobId);
    } catch {
      // Keep the original generation error.
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getImageProvider() {
  const provider = (process.env.AI_IMAGE_PROVIDER ?? process.env.IMAGE_PROVIDER ?? "runpod")
    .trim()
    .toLowerCase();

  return provider === "gemini" || provider === "nano-banana" ? "gemini" : "runpod";
}

function isGeminiPolicyBlock(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return /Input blocked|Prohibited Use policy|invalid_request/i.test(message);
}

function getLimitedGenerationTargets(shots: StudioShot[], targetImageCount: number) {
  const targets: Array<{ shot: StudioShot; variationIndex: number }> = [];

  for (const shot of shots) {
    for (let variationIndex = 1; variationIndex <= getTargetVariationCount(shot); variationIndex += 1) {
      targets.push({ shot, variationIndex });
    }
  }

  return targets.slice(0, Math.max(1, Math.min(40, targetImageCount)));
}

function findNextTarget(
  targets: Array<{ shot: StudioShot; variationIndex: number }>,
  generated: Array<{ studio_shot_id: string; variation_index: number }>,
) {
  const completedKeys = new Set(
    generated.map((image) => `${image.studio_shot_id}:${image.variation_index}`),
  );

  for (const target of targets) {
    if (!completedKeys.has(`${target.shot.id}:${target.variationIndex}`)) {
      return target;
    }
  }

  return null;
}

function calculateProgress(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(5, Math.min(99, Math.round((completed / total) * 100)));
}

function isRetryableGenerationError(message: string) {
  return /Gemini не вернул изображение|Gemini did not return an image|Deadline expired|UNAVAILABLE|503|429|quota|too_many_requests/i.test(
    message,
  );
}

function normalizeGenerationError(
  rawMessage: string,
  error: unknown,
  generationMode: GenerationMode,
) {
  if (/429|quota|too_many_requests|not have enough quota/i.test(rawMessage)) {
    return [
      "Gemini временно не может создать фото: закончилась или превышена квота запросов.",
      "Попробуйте позже или подключите новый ключ/платный лимит Gemini.",
    ].join(" ");
  }

  if (generationMode === "child_safe" && isGeminiPolicyBlock(error)) {
    return [
      "Gemini заблокировал исходное фото по правилам безопасности Google.",
      "Детский безопасный режим уже использует безопасный возрастной промпт, но этот блок происходит до генерации, на проверке входного изображения.",
      "Попробуйте другое обычное фото ребёнка: полностью одетый портрет, без пляжа/купальника/нижнего белья, без оголённого торса, без посторонних взрослых и без двусмысленной позы.",
    ].join(" ");
  }

  return rawMessage;
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Нет токена пользователя.");
  }

  return token;
}

async function readRequestBody(request: NextRequest): Promise<{ bodyProfile: BodyProfile | null }> {
  try {
    const body = (await request.json()) as { bodyProfile?: Partial<BodyProfile> | null };
    const bodyBuild = body.bodyProfile?.bodyBuild;

    if (!isKnownBodyBuild(bodyBuild)) {
      return { bodyProfile: null };
    }

    return {
      bodyProfile: {
        heightCm: Number(body.bodyProfile?.heightCm),
        weightKg: Number(body.bodyProfile?.weightKg),
        bmi: Number(body.bodyProfile?.bmi),
        bodyBuild,
      },
    };
  } catch {
    return { bodyProfile: null };
  }
}

function isKnownBodyBuild(value: unknown): value is BodyBuild {
  return (
    value === "very_thin" ||
    value === "thin" ||
    value === "fitness" ||
    value === "normal" ||
    value === "athletic" ||
    value === "solid" ||
    value === "large" ||
    value === "full" ||
    value === "very_full"
  );
}

function buildPositivePrompt(
  shot: StudioShot,
  variationIndex: number,
  generationMode: GenerationMode,
  wardrobePrompt?: string,
  bodyBuild?: BodyBuild | null,
) {
  if (generationMode === "child_safe") {
    return buildChildSafePositivePrompt(shot, variationIndex, wardrobePrompt, bodyBuild);
  }

  const scene = buildScenePrompt(shot);
  const framing = buildFramingPrompt(shot, variationIndex);
  const gaze = buildGazePrompt(shot, variationIndex);
  const bodyBuildPrompt = getBodyBuildPrompt(bodyBuild);

  return [
    "raw natural realistic premium photo of the exact same person from the reference selfie",
    "preserve facial identity, same gender, same age, same eyes, same nose, same lips, normal human face",
    bodyBuildPrompt
      ? `body silhouette must match the selected body profile: ${bodyBuildPrompt}`
      : "",
    "real DSLR photo, premium editorial lifestyle photography, not a render, not AI-looking, not cartoon",
    "natural skin texture, realistic pores, clean skin without stains, believable human expression",
    "real furniture and architecture from the selected interior, visible environment, believable daylight, soft shadows, stylish fashionable wardrobe",
    isSceneShot(shot)
      ? "compose as a real environmental scene, face likeness is secondary to believable body pose, hands, objects and place, do not make a passport headshot"
      : "natural premium portrait, realistic face and expression, not overprocessed",
    framing,
    gaze,
    `scene must match exactly: ${scene}`,
    `pose and action: ${shot.pose}`,
    wardrobePrompt ? `wardrobe must match the selected interior: ${wardrobePrompt}` : "",
    `camera and crop: ${shot.camera_angle}, ${shot.crop}`,
    shot.prompt,
  ].filter(Boolean).join(", ");
}

function buildNegativePrompt(shot: StudioShot, generationMode: GenerationMode) {
  const baseNegative = [
    "nsfw, nude, naked, porn, erotic",
    "sexualized child, seductive pose, adult romantic context, revealing clothes, underwear, bare torso, exposed chest, exposed belly",
    "wrong gender, different person, deformed face, bad anatomy, bad eyes, cross eye",
    "red spots on face, colored stains, paint marks, skin blemish artifacts, dirt on face, face noise, random colored marks",
    "jpeg artifacts, digital noise, oversharpened, harsh HDR, crunchy contrast, blown highlights, crushed shadows, unreal contrast, orange skin, oily skin",
    "cropped head, cut face, duplicate person, mutated body, extra limbs, extra fingers, missing hands, broken hands",
    "watermark, text, logo, cartoon, anime, cgi, 3d render, plastic skin, waxy skin, airbrushed skin, video game character, low quality",
    isSceneShot(shot)
      ? "tight headshot, passport photo, only face visible, face-only portrait, cropped shoulders, missing hands, missing arms, static ID photo"
      : "full body, distorted shoulders",
    shot.negative_prompt,
  ];

  if (generationMode === "child_safe") {
    return [
      ...baseNegative,
      "adult business executive, mature professional, corporate leader, CEO, founder, office romance, nightlife, glamour, makeup-heavy look",
      "formal suit that makes the child look adult, high heels, luxury adult styling, provocative expression, revealing swimwear, underwear",
    ].join(", ");
  }

  return baseNegative.join(", ");
}

function buildGenerationSettings(shot: StudioShot, generationMode: GenerationMode) {
  if (generationMode === "child_safe") {
    return {
      width: 768,
      height: 1024,
      identityWeight: 0.55,
      steps: 24,
      cfg: 3.8,
    };
  }

  if (shot.slug.endsWith("-wide") || shot.slug.endsWith("-three-quarter")) {
    return {
      width: 1024,
      height: 768,
      identityWeight: 0.42,
      steps: 26,
      cfg: 4.0,
    };
  }

  return {
    width: 768,
    height: 1024,
    identityWeight: 0.68,
    steps: 24,
    cfg: 4.3,
  };
}

function buildChildSafePositivePrompt(
  shot: StudioShot,
  variationIndex: number,
  wardrobePrompt?: string,
  bodyBuild?: BodyBuild | null,
) {
  const scene = buildScenePrompt(shot);
  const framing = buildChildSafeFramingPrompt(shot, variationIndex);
  const bodyBuildPrompt = getBodyBuildPrompt(bodyBuild);

  return [
    "safe age-appropriate portrait of the exact same child from the reference photo",
    "preserve child identity, same age range, same face shape, same eyes, same hair, natural child expression",
    bodyBuildPrompt
      ? `child body silhouette must match the selected body profile: ${bodyBuildPrompt}`
      : "",
    "fully clothed child, modest age-appropriate clothes, no exposed torso, no revealing clothing",
    "safe kids editorial portrait, natural daylight, warm friendly expression",
    "the selected location is mandatory and must not be replaced by a school, classroom, home, office or generic studio unless that is the selected location",
    "realistic DSLR photo, natural skin texture, believable child face, not cartoon, not CGI",
    framing,
    `safe scene must match: ${scene}`,
    `selected location details must stay visible: ${shot.prompt}`,
    wardrobePrompt
      ? `child-safe wardrobe must match the selected location: adapt this wardrobe direction for a modest age-appropriate child outfit, ${wardrobePrompt}`
      : "",
    "pose must be natural for a child: relaxed, calm, friendly, playful but not exaggerated",
    "do not make the child look like an adult professional, executive, founder, model, romantic subject or glamour portrait",
  ].filter(Boolean).join(", ");
}

function buildChildSafeFramingPrompt(shot: StudioShot, variationIndex: number) {
  if (shot.slug === "close-up-editorial") {
    return "close but modest portrait, shoulders and upper chest covered, no tight crop on body";
  }

  if (variationIndex % 2 === 0) {
    return "medium portrait, upper body visible, hands visible when natural, camera at child eye level";
  }

  return "natural child portrait, camera pulled back enough to show modest clothing and safe context";
}

function isSceneShot(shot: StudioShot) {
  return !["window-portrait", "close-up-editorial"].includes(shot.slug);
}

function buildFramingPrompt(shot: StudioShot, variationIndex: number) {
  const variationFraming: Record<string, string[]> = {
    "window-portrait": [
      "upper-body portrait, not too tight, shoulders and part of torso visible, real office window context",
      "waist-up photo near the window, camera pulled back, hands relaxed near the body, candid moment",
      "three-quarter side angle by the window, looking outside, upper body visible",
      "candid editorial portrait near the glass, slight turn away from camera, office context visible",
    ],
    "executive-desk": [
      "wide horizontal photo from across the desk, desk surface in foreground, laptop, keyboard, papers, coffee and both hands clearly visible",
      "three-quarter side view, seated at the desk in half-turn, one hand on laptop, one hand resting on the table, torso visible",
      "medium environmental portrait, camera pulled back, chair, desk, laptop, notebook and hands visible, not a headshot",
      "candid meeting-like photo, looking at the laptop screen, torso, forearms and desk visible, not looking at camera",
    ],
    "arms-crossed": [
      "half-body portrait from hips up with crossed arms fully visible from elbows to hands",
      "three-quarter body standing pose, crossed arms clearly visible, camera pulled back, waist visible",
      "full-body business portrait, crossed arms visible, legs and shoes visible, office floor visible",
      "side three-quarter angle, crossed arms and torso visible, confident posture, not a headshot",
    ],
    "startup-founder": [
      "wide candid founder photo leaning on a real desk, hands on desk, laptop and office objects visible, active work moment",
      "three-quarter body environmental portrait, standing beside a team table, hands visible, relaxed action, looking to a colleague",
      "candid startup workspace photo, looking at laptop or colleague off camera, body turned half-side, not posed",
      "full-body or knee-up founder photo in office, one hand on table, one hand gesturing naturally, legs visible",
    ],
    "presentation-moment": [
      "wide full-body photo beside a visible presentation screen, one hand pointing at the screen, legs visible, meeting room visible",
      "waist-up side view while presenting, looking at the slide, hand gesture visible, screen content behind",
      "three-quarter body in a meeting room, presentation screen with abstract charts behind, not looking at camera, audience perspective",
      "candid presentation moment, walking slightly near the screen, open hand gesture, body and screen visible",
    ],
    "lounge-chair": [
      "three-quarter body seated in a designer chair, chair shape, arms, torso and legs partly visible",
      "side angle from a distance, seated in lounge chair, one leg visible, hands relaxed on armrests",
      "environmental office lounge photo, full chair visible, body turned half-side, looking away",
      "waist-up candid conversation pose in chair, hands visible, premium lounge environment visible",
    ],
    "black-background": [
      "upper-body studio portrait, shoulders and upper torso visible, serious natural expression",
      "half-body dark studio portrait, hands lightly clasped or relaxed, not only face",
      "side three-quarter studio portrait, looking slightly away from camera, torso visible",
      "dramatic editorial portrait with different angle, natural skin, no harsh artificial marks",
    ],
    "walking-office": [
      "wide full-body walking photo in office corridor, legs and shoes visible, natural step motion, camera pulled back",
      "three-quarter body walking while holding a folder or phone, one hand moving naturally, corridor depth visible",
      "candid side view walking past glass walls, looking forward, arms in natural motion, not facing the camera",
      "environmental office corridor photo, body in motion, motion in arms and jacket, not posed headshot, visible floor",
    ],
    "close-up-editorial": [
      "natural close editorial portrait, slight turn, realistic skin, shoulders visible",
      "tight but realistic magazine portrait, looking off camera, not passport style",
      "upper-body editorial crop, thoughtful expression, soft background",
      "close portrait with side light, subtle head turn, natural expression",
    ],
    "coffee-workspace": [
      "wide lifestyle office photo, coffee cup, laptop, desk and both hands visible, natural conversation moment",
      "side view at workspace, holding coffee while looking at laptop, torso and arms visible, desk visible",
      "candid conversation at desk with coffee, one hand gesturing, looking off camera, body turned half-side",
      "three-quarter body sitting or standing near desk, coffee and laptop visible, hands and part of legs visible",
    ],
  };

  return (
    variationFraming[shot.slug]?.[variationIndex - 1] ??
    "natural premium editorial photo, camera distance follows the requested crop, body language and selected interior environment visible"
  );
}

function buildGazePrompt(shot: StudioShot, variationIndex: number) {
  const gazes = [
    "natural gaze, not forced, may look slightly away from the camera",
    "looking at the object in the scene, not directly at the lens",
    "candid expression as if in a real conversation or work moment",
    "natural off-camera gaze, relaxed live business moment",
  ];

  if (shot.slug === "window-portrait") {
    return variationIndex === 1 ? "looking calmly toward camera" : "looking toward the window or outside";
  }

  if (shot.slug === "presentation-moment") {
    return "looking at the presentation screen or toward an audience, not necessarily at camera";
  }

  if (shot.slug === "executive-desk" || shot.slug === "coffee-workspace") {
    return variationIndex % 2 === 0
      ? "looking at laptop screen or coffee, candid work moment"
      : "looking slightly off camera as if speaking to a colleague";
  }

  return gazes[(variationIndex - 1) % gazes.length];
}

function buildScenePrompt(shot: StudioShot) {
  const scenes: Record<string, string> = {
    "window-portrait":
      "standing beside a large office window, window frame visible, bright modern office behind, relaxed shoulders, real daylight",
    "executive-desk":
      "sitting at an executive desk, desk surface must be visible, laptop must be visible, both hands naturally resting near the laptop, real office objects",
    "arms-crossed":
      "standing with both arms crossed clearly visible, full forearms and hands visible, confident posture, modern office background",
    "startup-founder":
      "leaning lightly on a desk in a startup workspace, laptop and desk visible, hands on the desk, relaxed business posture, candid founder moment",
    "presentation-moment":
      "standing next to a visible presentation screen in a meeting room, one hand pointing or gesturing naturally, screen and body visible",
    "lounge-chair":
      "sitting in a designer lounge chair, full chair visible, arms and legs partly visible, calm confident posture, premium office lounge background",
    "black-background":
      "dark charcoal studio background, controlled softbox lighting, formal executive photo with varied angles and natural expression",
    "walking-office":
      "walking through a modern office corridor, glass walls and corridor depth visible, natural movement in legs and arms, body in motion",
    "close-up-editorial":
      "close editorial business portrait, slight turn toward camera, neutral premium background",
    "coffee-workspace":
      "sitting or standing at a clean workspace, coffee cup and laptop visible, hands visible, candid work conversation, real desk environment",
  };

  return scenes[shot.slug] ?? shot.prompt;
}
