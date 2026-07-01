import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import {
  buildOutreachHtml,
  buildOutreachSubject,
  buildOutreachText,
} from "@/lib/outreach-email";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { OutreachLead } from "@/lib/types";

export async function POST(request: NextRequest) {
  const adminToken = process.env.OUTREACH_ADMIN_TOKEN;

  if (!adminToken) {
    return NextResponse.json(
      { error: "OUTREACH_ADMIN_TOKEN is not configured." },
      { status: 501 },
    );
  }

  const requestToken = request.headers.get("x-outreach-token");
  if (!requestToken || requestToken !== adminToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    return NextResponse.json(
      { error: "SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM." },
      { status: 501 },
    );
  }

  const body = (await request.json()) as { leadId?: string };
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: lead, error } = await supabase
    .from("outreach_leads")
    .select("id,studio_name,city,email,promo_code,status")
    .eq("id", body.leadId)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? "Lead not found." }, { status: 404 });
  }

  if (!lead.email) {
    return NextResponse.json({ error: "Lead has no email." }, { status: 400 });
  }

  if (lead.status === "sent" || lead.status === "stop") {
    return NextResponse.json({ error: `Lead status is ${lead.status}.` }, { status: 409 });
  }

  const variables = {
    city: lead.city ?? "",
    promo_code: lead.promo_code || process.env.OUTREACH_PROMO_CODE || "STUDIO",
    studio_name: lead.studio_name || "коллеги",
  };

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  await transporter.sendMail({
    from: smtpConfig.from,
    html: buildOutreachHtml(variables),
    replyTo: smtpConfig.replyTo,
    subject: buildOutreachSubject(variables),
    text: buildOutreachText(variables),
    to: lead.email,
  });

  const sentAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("outreach_leads")
    .update({
      last_contacted_at: sentAt,
      status: "sent" satisfies OutreachLead["status"],
    })
    .eq("id", lead.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ lead: { ...lead, last_contacted_at: sentAt, status: "sent" } });
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const secure = (process.env.SMTP_SECURE ?? "true") === "true";

  if (!host || !port || !user || !pass || !from) return null;

  return {
    from,
    host,
    pass,
    port,
    replyTo: process.env.SMTP_REPLY_TO || from,
    secure,
    user,
  };
}
