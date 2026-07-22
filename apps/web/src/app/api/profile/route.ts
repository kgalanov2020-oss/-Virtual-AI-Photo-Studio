import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type ConsentPayload = {
  legalTerms?: boolean;
  privacy?: boolean;
  personalData?: boolean;
  photoRights?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      consents?: ConsentPayload;
    };
    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData.user;

    if (userError || !user?.id || !user.email) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const now = new Date().toISOString();
    const hasConsentSubmission = body.consents !== undefined;
    if (
      hasConsentSubmission &&
      (body.consents?.legalTerms !== true ||
        body.consents.privacy !== true ||
        body.consents.personalData !== true ||
        body.consents.photoRights !== true)
    ) {
      return NextResponse.json(
        { error: "Подтвердите каждое обязательное согласие отдельно." },
        { status: 400 },
      );
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("user_profiles")
      .select(
        "legal_terms_accepted_at, privacy_accepted_at, personal_data_accepted_at, photo_rights_accepted_at",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingProfileError) {
      throw new Error(existingProfileError.message);
    }

    const consentFields = hasConsentSubmission
      ? {
          legal_terms_accepted_at: existingProfile?.legal_terms_accepted_at ?? now,
          privacy_accepted_at: existingProfile?.privacy_accepted_at ?? now,
          personal_data_accepted_at: existingProfile?.personal_data_accepted_at ?? now,
          photo_rights_accepted_at: existingProfile?.photo_rights_accepted_at ?? now,
        }
      : {};
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: user.id,
          email: user.email,
          updated_at: now,
          ...consentFields,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (profileError || !profile) {
      throw new Error(profileError?.message ?? "Не удалось сохранить профиль.");
    }

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить профиль." },
      { status: 500 },
    );
  }
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
