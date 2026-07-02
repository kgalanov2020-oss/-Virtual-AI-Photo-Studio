import nodemailer from "nodemailer";

const supabase = createSupabaseConfig();
const smtp = createSmtpConfig();
const promoCode = process.env.OUTREACH_PROMO_CODE ?? "STUDIO";
const autoSendEnabled = (process.env.OUTREACH_AUTO_SEND_ENABLED ?? "true") === "true";

if (!autoSendEnabled) {
  console.log("Outreach auto send is disabled.");
  process.exit(0);
}

if (!supabase) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

if (!smtp) {
  throw new Error("Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.");
}

const lead = await findNextLead();

if (!lead) {
  console.log("No outreach leads ready for automatic email.");
  process.exit(0);
}

console.log(`Sending outreach email to ${lead.email} (${lead.studio_name})`);

try {
  await sendEmail(lead);
  await updateLead(lead.id, {
    last_contacted_at: new Date().toISOString(),
    status: "sent",
    raw: {
      ...(lead.raw ?? {}),
      last_auto_send_at: new Date().toISOString(),
    },
  });
  console.log(`Sent outreach email to ${lead.email}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown SMTP error.";
  await updateLead(lead.id, {
    status: "needs_review",
    raw: {
      ...(lead.raw ?? {}),
      last_send_error: message,
      last_send_error_at: new Date().toISOString(),
    },
  });
  throw error;
}

async function findNextLead() {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,studio_name,city,website,email,phone,promo_code,status,last_contacted_at,raw,created_at",
  );
  params.set("status", "in.(new,approved)");
  params.append("email", "not.is.null");
  params.append("email", "neq.");
  params.set("order", "last_contacted_at.asc.nullsfirst,created_at.asc");
  params.set("limit", "1");

  const response = await fetch(`${supabase.restUrl}/outreach_leads?${params}`, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Could not load outreach lead: ${await response.text()}`);
  }

  const leads = await response.json();
  return leads?.[0] ?? null;
}

async function sendEmail(lead) {
  const variables = {
    city: lead.city ?? "",
    promo_code: lead.promo_code || promoCode,
    studio_name: lead.studio_name || "коллеги",
  };

  const transporter = nodemailer.createTransport({
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    socketTimeout: 20000,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.verify();
  await transporter.sendMail({
    from: smtp.from,
    html: buildOutreachHtml(variables),
    replyTo: smtp.replyTo,
    subject: buildOutreachSubject(variables),
    text: buildOutreachText(variables),
    to: lead.email,
  });
}

async function updateLead(leadId, patch) {
  const response = await fetch(`${supabase.restUrl}/outreach_leads?id=eq.${leadId}`, {
    body: JSON.stringify(patch),
    headers: {
      ...supabaseHeaders(),
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`Could not update outreach lead ${leadId}: ${await response.text()}`);
  }
}

function createSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    restUrl: `${supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "")}/rest/v1`,
    serviceRoleKey,
  };
}

function supabaseHeaders() {
  return {
    apikey: supabase.serviceRoleKey,
    authorization: `Bearer ${supabase.serviceRoleKey}`,
  };
}

function createSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = normalizeEmailHeader(process.env.SMTP_FROM);
  const secure = (process.env.SMTP_SECURE ?? "true") === "true";

  if (!host || !port || !user || !pass || !from) return null;

  return {
    from,
    host,
    pass,
    port,
    replyTo: normalizeEmailHeader(process.env.SMTP_REPLY_TO) || from,
    secure,
    user,
  };
}

function normalizeEmailHeader(value) {
  return value?.replace(/\s+/g, " ").trim();
}

function buildOutreachSubject(variables) {
  return `${variables.studio_name}, новый формат AI-фотосессий для ваших клиентов`;
}

function buildOutreachText(variables) {
  return `Здравствуйте, ${variables.studio_name}!

Мы сделали Virtual AI Photo Studio - сервис, который превращает обычные селфи клиента в готовую серию портретов в интерьерной фотостудии: с подходящей одеждой, светом, позами и атмосферой локации.

Фотостудия может использовать это как дополнительный продукт: показать клиенту пример "до/после", дать промокод и получать заявки от тех, кто пока не готов бронировать зал или хочет быстро протестировать образ.

Для знакомства даём промокод ${variables.promo_code}. По нему можно бесплатно проверить результат на своих фото.

Если вам интересно, можем подготовить отдельный промокод для клиентов вашей студии, подборку интерьеров под ваш стиль или тестовую серию с вашим залом.

С уважением,
Virtual AI Photo Studio
https://virtualphotostudio.ru

Если предложение неактуально, ответьте "стоп", и мы больше не будем писать.`;
}

function buildOutreachHtml(variables) {
  return `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:0;background:#f2f0ec;font-family:Arial,sans-serif;color:#1f1f1d;">
    <div style="max-width:720px;margin:0 auto;padding:28px 18px;">
      <div style="background:#ffffff;border:1px solid #ded8d0;border-radius:14px;overflow:hidden;">
        <div style="background:#1f1d1a;color:#fff8ed;padding:30px 28px;">
          <div style="color:#cbb9a5;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px;">Virtual AI Photo Studio</div>
          <h1 style="margin:0 0 12px;font-size:30px;line-height:1.05;">AI-фотосессия из обычных селфи клиента</h1>
          <p style="margin:0;color:#eadfce;font-size:16px;line-height:1.5;">Готовый формат для фотостудий: до/после, промокод и быстрый тест без съёмочного дня.</p>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Здравствуйте, ${escapeHtml(variables.studio_name)}!</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Мы сделали <b>Virtual AI Photo Studio</b> - сервис, который превращает обычные селфи клиента в готовую серию портретов в интерьерной фотостудии: с подходящей одеждой, светом, позами и атмосферой локации.</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Фотостудия может использовать это как дополнительный продукт: показать клиенту пример "до/после", дать промокод и получать заявки от тех, кто пока не готов бронировать зал или хочет быстро протестировать образ.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0;">
            <div>
              <div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#8b7d70;text-transform:uppercase;margin-bottom:8px;">До</div>
              <img src="https://virtualphotostudio.ru/selfie-guide/01-front-neutral.webp" alt="Селфи до AI-фотосессии" style="width:100%;border-radius:10px;display:block;">
            </div>
            <div>
              <div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#8b7d70;text-transform:uppercase;margin-bottom:8px;">После</div>
              <img src="https://virtualphotostudio.ru/before-after/after-luxury-garage-01.webp" alt="Результат AI-фотосессии" style="width:100%;border-radius:10px;display:block;">
            </div>
          </div>
          <div style="background:#f3eee8;border:1px solid #e0d6ca;border-radius:12px;margin:0 0 20px;padding:18px;">
            <div style="font-size:13px;color:#74685e;margin-bottom:6px;">Промокод для теста</div>
            <div style="font-size:28px;font-weight:900;letter-spacing:.08em;">${escapeHtml(variables.promo_code)}</div>
          </div>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">По промокоду можно бесплатно проверить результат на своих фото.</p>
          <p style="margin:24px 0;">
            <a href="https://virtualphotostudio.ru/" style="display:inline-block;background:#8a7b6c;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:800;">Посмотреть сервис и пример до/после</a>
          </p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Если вам интересно, можем подготовить отдельный промокод для клиентов вашей студии, подборку интерьеров под ваш стиль или тестовую серию с вашим залом.</p>
          <p style="margin:0;font-size:16px;line-height:1.55;">С уважением,<br>Virtual AI Photo Studio<br>https://virtualphotostudio.ru</p>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.45;color:#6b665f;">Если предложение неактуально, ответьте "стоп", и мы больше не будем писать.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
