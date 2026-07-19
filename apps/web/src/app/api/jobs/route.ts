import { NextRequest, NextResponse } from "next/server";
import { PAYMENT_CURRENCY, PHOTO_PACKAGES } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { GenerationMode } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    const body = (await request.json()) as {
      studioSlug?: string;
      generationMode?: GenerationMode;
      productCode?: string;
    };
    const selectedPackage = PHOTO_PACKAGES.find(
      (photoPackage) => photoPackage.code === body.productCode,
    );

    if (!body.studioSlug || !selectedPackage) {
      return NextResponse.json({ error: "Выберите интерьер и пакет фотосессии." }, { status: 400 });
    }

    if (!body.generationMode || !["standard", "child_safe"].includes(body.generationMode)) {
      return NextResponse.json({ error: "Недопустимый режим генерации." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData.user;
    if (userError || !user?.id) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const [{ data: studio, error: studioError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("studios")
          .select("id")
          .eq("slug", body.studioSlug)
          .eq("is_active", true)
          .single(),
        supabase
          .from("user_profiles")
          .select(
            "free_images_remaining, legal_terms_accepted_at, privacy_accepted_at, personal_data_accepted_at, photo_rights_accepted_at",
          )
          .eq("user_id", user.id)
          .single(),
      ]);

    if (studioError || !studio) {
      return NextResponse.json({ error: studioError?.message ?? "Студия не найдена." }, { status: 404 });
    }

    if (profileError || !profile) {
      return NextResponse.json({ error: "Профиль пользователя не найден." }, { status: 400 });
    }

    if (
      !profile.legal_terms_accepted_at ||
      !profile.privacy_accepted_at ||
      !profile.personal_data_accepted_at ||
      !profile.photo_rights_accepted_at
    ) {
      return NextResponse.json({ error: "Сначала подтвердите согласия." }, { status: 400 });
    }

    if (selectedPackage.isFree && profile.free_images_remaining < selectedPackage.imageCount) {
      return NextResponse.json({ error: "Бесплатные фото закончились." }, { status: 402 });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        studio_id: studio.id,
        generation_mode: body.generationMode,
        status: "draft",
        payment_status: "unpaid",
        amount_cents: selectedPackage.amountCents,
        currency: PAYMENT_CURRENCY,
        product_code: selectedPackage.code,
        target_image_count: selectedPackage.imageCount,
        progress: 0,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message ?? "Не удалось создать фотосессию.");
    }

    return NextResponse.json({ ok: true, job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать фотосессию." },
      { status: 500 },
    );
  }
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
