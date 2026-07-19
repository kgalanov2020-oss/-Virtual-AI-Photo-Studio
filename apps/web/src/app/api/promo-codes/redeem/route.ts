import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type RedeemPromoBody = {
  code?: string;
};

type RedeemPromoResult = {
  credits_granted: number;
  free_images_remaining: number;
};

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    const { code } = (await request.json()) as RedeemPromoBody;
    const normalizedCode = normalizePromoCode(code);

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
    const { data, error } = await supabase.rpc("redeem_promo_code", {
      p_code: normalizedCode,
      p_user_id: userId,
      p_email: email,
    });

    if (error) {
      const mappedError = mapPromoRedemptionError(error.message);
      return NextResponse.json({ error: mappedError.message }, { status: mappedError.status });
    }

    if (!data) {
      return NextResponse.json({ error: "Не удалось применить промокод." }, { status: 500 });
    }

    const result = data as RedeemPromoResult;

    return NextResponse.json({
      ok: true,
      creditsGranted: result.credits_granted,
      freeImagesRemaining: result.free_images_remaining,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Неизвестная ошибка." },
      { status: 500 },
    );
  }
}

function mapPromoRedemptionError(message: string) {
  const knownErrors: Array<{ match: string; message: string; status: number }> = [
    { match: "Promo code not found", message: "Промокод не найден.", status: 404 },
    {
      match: "Promo code already redeemed",
      message: "Вы уже использовали этот промокод.",
      status: 409,
    },
    { match: "Promo code is inactive", message: "Промокод уже не активен.", status: 400 },
    { match: "Promo code has not started", message: "Промокод ещё не активен.", status: 400 },
    { match: "Promo code has expired", message: "Срок действия промокода истёк.", status: 400 },
    { match: "Promo code limit reached", message: "Лимит промокода уже исчерпан.", status: 400 },
  ];

  return (
    knownErrors.find((knownError) => message.includes(knownError.match)) ?? {
      message: "Не удалось применить промокод.",
      status: 500,
    }
  );
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
