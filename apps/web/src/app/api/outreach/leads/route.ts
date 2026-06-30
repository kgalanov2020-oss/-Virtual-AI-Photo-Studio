import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { OutreachLead } from "@/lib/types";

const outreachStatuses: OutreachLead["status"][] = [
  "new",
  "needs_manual_email",
  "needs_review",
  "approved",
  "sent",
  "replied",
  "stop",
  "bad_email",
  "duplicate",
];

export async function GET(request: NextRequest) {
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

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "300"), 1000);
  const status = request.nextUrl.searchParams.get("status");
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("outreach_leads")
    .select(
      "id,studio_name,city,website,email,phone,source,promo_code,status,last_contacted_at,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && outreachStatuses.includes(status as OutreachLead["status"])) {
    query = query.eq("status", status as OutreachLead["status"]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data ?? [] });
}
