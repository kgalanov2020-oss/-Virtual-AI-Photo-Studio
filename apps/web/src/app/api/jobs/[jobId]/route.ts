import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const token = readBearerToken(request);
    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, user_id, status, payment_status")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: jobError?.message ?? "Фотосессия не найдена." }, { status: 404 });
    }

    if (job.user_id !== userId) {
      return NextResponse.json({ error: "Нет доступа к этой фотосессии." }, { status: 403 });
    }

    const canDelete =
      job.payment_status !== "paid" &&
      ["draft", "awaiting_payment", "failed", "cancelled"].includes(job.status);

    if (!canDelete) {
      return NextResponse.json(
        { error: "Можно удалить только черновики, неоплаченные или ошибочные фотосессии." },
        { status: 409 },
      );
    }

    const [{ data: selfies }, { data: generatedImages }] = await Promise.all([
      supabase
        .from("uploaded_selfies")
        .select("file_url")
        .eq("job_id", jobId)
        .eq("user_id", userId),
      supabase
        .from("generated_images")
        .select("image_url")
        .eq("job_id", jobId)
        .eq("user_id", userId),
    ]);

    const selfiePaths = (selfies ?? [])
      .map((selfie) => selfie.file_url)
      .filter(Boolean);
    const generatedPaths = (generatedImages ?? [])
      .map((image) => getStoragePathFromPublicUrl(image.image_url))
      .filter((path): path is string => Boolean(path));

    if (selfiePaths.length > 0) {
      await supabase.storage.from("selfies").remove(selfiePaths);
    }

    if (generatedPaths.length > 0) {
      await supabase.storage.from("generated").remove(generatedPaths);
    }

    const { error: deleteError } = await supabase
      .from("jobs")
      .delete()
      .eq("id", jobId)
      .eq("user_id", userId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось удалить фотосессию." },
      { status: 500 },
    );
  }
}

function getStoragePathFromPublicUrl(url: string) {
  const marker = "/storage/v1/object/public/generated/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length).split("?")[0] ?? "");
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Нет токена пользователя.");
  }

  return token;
}
