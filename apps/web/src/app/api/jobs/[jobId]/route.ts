import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    const body = (await request.json()) as { generationMode?: "standard" | "child_safe" };
    if (!body.generationMode || !["standard", "child_safe"].includes(body.generationMode)) {
      return NextResponse.json({ error: "Недопустимый режим генерации." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, user_id, status, progress")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: jobError?.message ?? "Фотосессия не найдена." }, { status: 404 });
    }

    if (job.user_id !== userId) {
      return NextResponse.json({ error: "Нет доступа к этой фотосессии." }, { status: 403 });
    }

    const retryFields =
      job.status === "failed"
        ? {
            status: "queued" as const,
            progress: Math.max(job.progress, 5),
            queued_at: new Date().toISOString(),
          }
        : {};
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        generation_mode: body.generationMode,
        error_message: null,
        ...retryFields,
      })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ ok: true, generationMode: body.generationMode });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось изменить режим." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }
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

    const { data: paymentOrders, error: paymentOrdersError } = await supabase
      .from("orders")
      .select("id, status, provider_session_id")
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .limit(1);

    if (paymentOrdersError) {
      throw new Error(paymentOrdersError.message);
    }

    // Payment records are fiscal/audit data. Never cascade-delete a paid job
    // or a job for which any provider attempt has already been recorded.
    if (job.payment_status === "paid" || (paymentOrders?.length ?? 0) > 0) {
      return NextResponse.json(
        { error: "Оплаченную фотосессию или её платёжную историю удалить нельзя." },
        { status: 409 },
      );
    }

    const canDelete = !["running"].includes(job.status);

    if (!canDelete) {
      return NextResponse.json(
        { error: "Фотосессию можно удалить после остановки текущей генерации." },
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

    const { data: deletionResult, error: deleteError } = await supabase.rpc(
      "delete_job_without_payment_history",
      {
        p_job_id: jobId,
        p_user_id: userId,
      },
    );

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (deletionResult === "payment_history") {
      return NextResponse.json(
        { error: "Оплаченную фотосессию или её платёжную историю удалить нельзя." },
        { status: 409 },
      );
    }

    if (deletionResult === "running") {
      return NextResponse.json(
        { error: "Фотосессию можно удалить после остановки текущей генерации." },
        { status: 409 },
      );
    }

    if (deletionResult !== "deleted") {
      return NextResponse.json({ error: "Фотосессия не найдена." }, { status: 404 });
    }

    if (selfiePaths.length > 0) {
      await supabase.storage.from("selfies").remove(selfiePaths);
    }

    if (generatedPaths.length > 0) {
      await supabase.storage.from("generated").remove(generatedPaths);
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
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
