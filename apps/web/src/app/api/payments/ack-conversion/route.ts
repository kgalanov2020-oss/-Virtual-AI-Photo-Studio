import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    const { conversionId, jobId } = (await request.json()) as {
      conversionId?: string;
      jobId?: string;
    };
    if (!conversionId || !jobId) {
      return NextResponse.json({ error: "Не переданы данные конверсии." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("ack_payment_success_conversion", {
      p_conversion_id: conversionId,
      p_job_id: jobId,
      p_user_id: userData.user.id,
    });
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: data === true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось подтвердить конверсию." },
      { status: 500 },
    );
  }
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
