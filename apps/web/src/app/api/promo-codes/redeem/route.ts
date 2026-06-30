import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type RedeemPromoBody = {
  code?: string;
};

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    const { code } = (await request.json()) as RedeemPromoBody;
    const normalizedCode = normalizePromoCode(code);

    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    if (!normalizedCode) {
      return NextResponse.json({ error: "Введите промокод." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user?.id || !userData.user.email) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    const userId = userData.user.id;
    const email = userData.user.email;
    const now = new Date().toISOString();

    const { data: promoCode, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", normalizedCode)
      .single();

    if (promoError || !promoCode) {
      return NextResponse.json({ error: "Промокод не найден." }, { status: 404 });
    }

    if (!promoCode.is_active) {
      return NextResponse.json({ error: "Промокод уже не активен." }, { status: 400 });
    }

    if (promoCode.starts_at && promoCode.starts_at > now) {
      return NextResponse.json({ error: "Промокод ещё не активен." }, { status: 400 });
    }

    if (promoCode.expires_at && promoCode.expires_at < now) {
      return NextResponse.json({ error: "Срок действия промокода истёк." }, { status: 400 });
    }

    if (
      promoCode.max_redemptions !== null &&
      promoCode.redeemed_count >= promoCode.max_redemptions
    ) {
      return NextResponse.json({ error: "Лимит промокода уже исчерпан." }, { status: 400 });
    }

    const { error: redemptionError } = await supabase.from("promo_redemptions").insert({
      promo_code_id: promoCode.id,
      user_id: userId,
      email,
      credits_granted: promoCode.credit_amount,
    });

    if (redemptionError) {
      if (redemptionError.code === "23505") {
        return NextResponse.json(
          { error: "Вы уже использовали этот промокод." },
          { status: 409 },
        );
      }

      return NextResponse.json({ error: redemptionError.message }, { status: 500 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const currentFreeImages = profile?.free_images_remaining ?? 0;
    const nextFreeImages = currentFreeImages + promoCode.credit_amount;

    const { data: updatedProfile, error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          email,
          free_images_remaining: nextFreeImages,
          updated_at: now,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (profileError || !updatedProfile) {
      return NextResponse.json(
        { error: profileError?.message ?? "Не удалось пополнить баланс." },
        { status: 500 },
      );
    }

    await supabase
      .from("promo_codes")
      .update({
        redeemed_count: promoCode.redeemed_count + 1,
      })
      .eq("id", promoCode.id);

    return NextResponse.json({
      ok: true,
      creditsGranted: promoCode.credit_amount,
      freeImagesRemaining: updatedProfile.free_images_remaining,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Неизвестная ошибка." },
      { status: 500 },
    );
  }
}

function normalizePromoCode(code: string | undefined) {
  return code?.trim().replace(/\s+/g, "").toUpperCase() ?? "";
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}
