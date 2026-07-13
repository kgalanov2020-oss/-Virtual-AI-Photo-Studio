import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type RecoveryRequest = {
  recipients?: string[];
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as RecoveryRequest;
  const recipients = [...new Set((body.recipients ?? []).map(normalizeEmail).filter(Boolean))];

  if (recipients.length === 0 || recipients.length > 20) {
    return NextResponse.json({ error: "Provide between 1 and 20 valid recipients." }, { status: 400 });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) {
    return NextResponse.json({ error: "SMTP is not configured." }, { status: 501 });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: { user, pass },
  });

  const results: Array<{ email: string; sent: boolean; error?: string }> = [];

  for (const email of recipients) {
    try {
      await transporter.sendMail({
        from,
        to: email,
        replyTo: process.env.SMTP_REPLY_TO || from,
        subject: "Мы восстановили ваш доступ к Virtual AI Photo Studio",
        text: buildText(),
        html: buildHtml(),
      });
      results.push({ email, sent: true });
    } catch (error) {
      results.push({
        email,
        sent: false,
        error: error instanceof Error ? error.message : "SMTP send failed.",
      });
    }
  }

  return NextResponse.json({
    sent: results.filter((result) => result.sent).length,
    failed: results.filter((result) => !result.sent).length,
    results,
  });
}

function isAuthorized(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(token && process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeEmail(value: string) {
  const email = String(value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function buildText() {
  return `Добрый день!

Мы увидели, что вы начали регистрацию в Virtual AI Photo Studio, но не смогли завершить её из-за проблемы с письмом подтверждения.

Мы исправили эту проблему и активировали ваш аккаунт. Подтверждать email теперь не нужно. На вашем балансе уже есть 5 приветственных фото.

Войдите с тем же email и паролем, которые указали при регистрации:
https://virtualphotostudio.ru/login?next=%2Fupload

Если вы не помните пароль или возникнет ошибка, ответьте на это письмо — мы поможем.

С уважением,
Virtual AI Photo Studio`;
}

function buildHtml() {
  return buildText()
    .split("\n")
    .map((line) => line ? `<p style="margin:0 0 14px">${line}</p>` : "")
    .join("");
}
