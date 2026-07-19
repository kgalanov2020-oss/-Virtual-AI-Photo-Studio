import { NextRequest, NextResponse } from "next/server";
import {
  buildSelfieStoragePath,
  MAX_SELFIE_BYTES,
  resolveSelfieContentType,
} from "@/lib/selfie-upload.mjs";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const token = readBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Сначала войдите в аккаунт." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData.user;

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, user_id, status")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Фотосессия не найдена." }, { status: 404 });
    }

    if (job.user_id !== user.id) {
      return NextResponse.json({ error: "Нет доступа к этой фотосессии." }, { status: 403 });
    }

    if (job.status !== "draft") {
      return NextResponse.json(
        { error: "Фото можно добавлять только до проверки качества." },
        { status: 409 },
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_SELFIE_BYTES + 512 * 1024) {
      return NextResponse.json({ error: "Размер одного фото не должен превышать 10 МБ." }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const slot = Number(formData.get("slot"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл фото не передан." }, { status: 400 });
    }

    if (!Number.isInteger(slot) || slot < 1 || slot > 12) {
      return NextResponse.json({ error: "Недопустимый номер фото." }, { status: 400 });
    }

    if (file.size === 0 || file.size > MAX_SELFIE_BYTES) {
      return NextResponse.json({ error: "Размер одного фото должен быть от 1 байта до 10 МБ." }, { status: 413 });
    }

    const contentType = resolveSelfieContentType(file.name, file.type);
    if (!contentType) {
      return NextResponse.json(
        { error: "Поддерживаются JPG, PNG, WEBP, HEIC, HEIF и AVIF." },
        { status: 415 },
      );
    }

    const filePath = buildSelfieStoragePath({
      userId: user.id,
      jobId,
      slot,
      fileName: file.name,
    });

    const { data: existingSelfie, error: existingSelfieError } = await supabase
      .from("uploaded_selfies")
      .select("id, file_url")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("file_url", filePath)
      .maybeSingle();

    if (existingSelfieError) {
      throw new Error(existingSelfieError.message);
    }

    if (existingSelfie) {
      return NextResponse.json({ ok: true, selfie: existingSelfie, reused: true });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: storageError } = await supabase.storage.from("selfies").upload(filePath, bytes, {
      contentType,
      // The deterministic path makes a lost-response retry safe and also
      // repairs an object left behind if the server stopped before the DB insert.
      upsert: true,
    });

    if (storageError) {
      throw new Error(`Хранилище не приняло фото: ${storageError.message}`);
    }

    const { data: selfie, error: selfieError } = await supabase
      .from("uploaded_selfies")
      .insert({
        job_id: jobId,
        user_id: user.id,
        file_url: filePath,
      })
      .select("id, file_url")
      .single();

    if (selfieError || !selfie) {
      await supabase.storage.from("selfies").remove([filePath]);
      throw new Error(selfieError?.message ?? "Не удалось зарегистрировать загруженное фото.");
    }

    return NextResponse.json({ ok: true, selfie }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить фото." },
      { status: 500 },
    );
  }
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
