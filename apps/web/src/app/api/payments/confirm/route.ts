import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type YooKassaPayment = {
  id: string;
  status?: string;
  metadata?: {
    job_id?: string;
    user_id?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    const { jobId, sessionId } = (await request.json()) as {
      jobId?: string;
      sessionId?: string;
    };

    if (!jobId) {
      return NextResponse.json({ error: "Не передан jobId." }, { status: 400 });
    }

    const yookassaShopId = process.env.YOOKASSA_SHOP_ID;
    const yookassaSecretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!yookassaShopId || !yookassaSecretKey) {
      return NextResponse.json({ error: "YOOKASSA_SHOP_ID или YOOKASSA_SECRET_KEY не настроены." }, { status: 501 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Не удалось проверить пользователя." }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data: job, error: jobLookupError } = await supabase
      .from("jobs")
      .select("id, user_id, payment_status")
      .eq("id", jobId)
      .single();

    if (jobLookupError || !job) {
      return NextResponse.json({ error: jobLookupError?.message ?? "Job не найден." }, { status: 404 });
    }

    if (job.user_id !== userId) {
      return NextResponse.json({ error: "Нет доступа к этому job." }, { status: 403 });
    }

    if (job.payment_status === "paid") {
      return NextResponse.json({ ok: true, redirectUrl: `/generation/${jobId}` });
    }

    const sessionIdsToCheck: string[] = [];
    if (sessionId) {
      sessionIdsToCheck.push(sessionId);
    }

    const { data: pendingOrders, error: orderLookupError } = await supabase
        .from("orders")
        .select("provider_session_id, target_image_count")
        .eq("job_id", jobId)
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);

    if (orderLookupError) {
      throw new Error(orderLookupError.message);
    }

    for (const order of pendingOrders ?? []) {
      if (order.provider_session_id && !sessionIdsToCheck.includes(order.provider_session_id)) {
        sessionIdsToCheck.push(order.provider_session_id);
      }
    }

    if (sessionIdsToCheck.length === 0) {
      return NextResponse.json({ error: "Не найден ожидающий платёж для этого заказа." }, { status: 404 });
    }

    let paidSession: YooKassaPayment | null = null;
    let lastCheckedSession: YooKassaPayment | null = null;
    let paidTargetImageCount = 0;

    for (const activeSessionId of sessionIdsToCheck) {
      const session = await retrieveYooKassaPayment(yookassaShopId, yookassaSecretKey, activeSessionId);
      lastCheckedSession = session;

      if (session.metadata?.job_id !== jobId || session.metadata?.user_id !== userId) {
        continue;
      }

      if (session.status === "succeeded") {
        paidSession = session;
        paidTargetImageCount =
          pendingOrders?.find((order) => order.provider_session_id === activeSessionId)
            ?.target_image_count ?? 0;
        break;
      }
    }

    if (!paidSession) {
      return NextResponse.json(
        {
          error:
            lastCheckedSession?.metadata?.job_id === jobId
              ? "Платёж ещё не подтверждён платёжной системой."
              : "Оплата не относится к этому заказу.",
        },
        { status: 409 },
      );
    }

    const paidAt = new Date().toISOString();
    const { error: orderError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        provider_payment_id: paidSession.id,
        paid_at: paidAt,
        updated_at: paidAt,
      })
      .eq("provider_session_id", paidSession.id)
      .eq("job_id", jobId)
      .eq("user_id", userId);

    if (orderError) {
      throw new Error(orderError.message);
    }

    if (paidTargetImageCount > 0) {
      await addPhotoBalance({
        supabase,
        userId,
        imageCount: paidTargetImageCount,
      });
    }

    const { error: jobUpdateError } = await supabase
      .from("jobs")
      .update({
        status: "queued",
        payment_status: "paid",
        paid_at: paidAt,
        progress: 5,
        queued_at: paidAt,
        error_message: null,
      })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (jobUpdateError) {
      throw new Error(jobUpdateError.message);
    }

    return NextResponse.json({ ok: true, redirectUrl: `/generation/${jobId}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось подтвердить оплату." },
      { status: 500 },
    );
  }
}

async function retrieveYooKassaPayment(shopId: string, secretKey: string, paymentId: string) {
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
    },
  });
  const data = (await response.json()) as YooKassaPayment & { description?: string; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.description ?? data.error?.message ?? "Не удалось проверить платёж ЮKassa.");
  }

  return data;
}

async function addPhotoBalance({
  supabase,
  userId,
  imageCount,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  imageCount: number;
}) {
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("free_images_remaining")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "Профиль пользователя не найден.");
  }

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({
      free_images_remaining: profile.free_images_remaining + imageCount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Нет токена пользователя.");
  }

  return token;
}
