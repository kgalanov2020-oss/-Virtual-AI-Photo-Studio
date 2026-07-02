import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { PromoCode } from "@/lib/types";

type PromoCodePayload = {
  code?: string;
  credit_amount?: number;
  description?: string;
  expires_at?: string | null;
  is_active?: boolean;
  max_redemptions?: number | null;
  starts_at?: string | null;
};

export async function GET(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select(
      "id,code,credit_amount,description,is_active,starts_at,expires_at,max_redemptions,redeemed_count,created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ promoCodes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  const payload = normalizePayload((await request.json()) as PromoCodePayload);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .insert(payload)
    .select(
      "id,code,credit_amount,description,is_active,starts_at,expires_at,max_redemptions,redeemed_count,created_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ promoCode: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  const body = (await request.json()) as PromoCodePayload & { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const update: Partial<PromoCode> = {};
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;
  if (typeof body.description === "string") update.description = body.description.trim() || null;
  if (typeof body.max_redemptions === "number") update.max_redemptions = body.max_redemptions;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .update(update)
    .eq("id", body.id)
    .select(
      "id,code,credit_amount,description,is_active,starts_at,expires_at,max_redemptions,redeemed_count,created_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ promoCode: data });
}

function normalizePayload(payload: PromoCodePayload):
  | Omit<PromoCode, "id" | "redeemed_count" | "created_at">
  | { error: string } {
  const code = payload.code?.trim().replace(/\s+/g, "").toUpperCase() ?? "";
  const creditAmount = Number(payload.credit_amount);
  const maxRedemptions =
    payload.max_redemptions === null || payload.max_redemptions === undefined
      ? null
      : Number(payload.max_redemptions);

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { error: "Код должен быть 3-32 символа: латиница, цифры, _ или -." };
  }

  if (!Number.isInteger(creditAmount) || creditAmount < 1 || creditAmount > 120) {
    return { error: "Количество фото должно быть целым числом от 1 до 120." };
  }

  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
    return { error: "Лимит применений должен быть пустым или целым числом больше 0." };
  }

  return {
    code,
    credit_amount: creditAmount,
    description: payload.description?.trim() || null,
    expires_at: normalizeDate(payload.expires_at),
    is_active: payload.is_active ?? true,
    max_redemptions: maxRedemptions,
    starts_at: normalizeDate(payload.starts_at),
  };
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function authorize(request: NextRequest) {
  const adminToken = process.env.OUTREACH_ADMIN_TOKEN;

  if (!adminToken) {
    return NextResponse.json(
      { error: "OUTREACH_ADMIN_TOKEN is not configured." },
      { status: 501 },
    );
  }

  const requestToken =
    request.headers.get("x-outreach-token") ?? request.nextUrl.searchParams.get("token");

  if (!requestToken || requestToken !== adminToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
}
