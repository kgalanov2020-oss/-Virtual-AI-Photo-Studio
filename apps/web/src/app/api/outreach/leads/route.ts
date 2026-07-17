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
  const authError = authorize(request);
  if (authError) return authError;

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "1000"), 10000);
  const status = request.nextUrl.searchParams.get("status");
  const emailOnly = request.nextUrl.searchParams.get("emailOnly") !== "false";
  const segment = request.nextUrl.searchParams.get("segment");
  const supabase = createSupabaseAdminClient();
  const leads: OutreachLead[] = [];
  const pageSize = 1000;

  while (leads.length < limit) {
    const from = leads.length;
    const to = Math.min(from + pageSize, limit) - 1;

    let query = supabase
      .from("outreach_leads")
      .select(
        "id,unique_key,studio_name,city,website,email,phone,source,promo_code,status,last_contacted_at,raw,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status && outreachStatuses.includes(status as OutreachLead["status"])) {
      query = query.eq("status", status as OutreachLead["status"]);
    }

    if (emailOnly) {
      query = query.not("email", "is", null).neq("email", "");
    }

    if (segment === "photo_booth_manufacturer" || segment === "photo_studio") {
      query = query.contains("raw", { segment });
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) break;
    leads.push(...data);
    if (data.length < pageSize) break;
  }

  return NextResponse.json({ leads });
}

export async function DELETE(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  const leadId = request.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("outreach_leads").delete().eq("id", leadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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
