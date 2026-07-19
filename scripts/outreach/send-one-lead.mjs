import nodemailer from "nodemailer";

const supabase = createSupabaseConfig();
const smtp = createSmtpConfig();
const promoCode = process.env.OUTREACH_PROMO_CODE ?? "STUDIO";
const autoSendEnabled = (process.env.OUTREACH_AUTO_SEND_ENABLED ?? "false") === "true";
const sendLimit = getSendLimit();

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

const leads = await findNextLeads(sendLimit);

if (leads.length === 0) {
  console.log("No outreach leads ready for automatic email.");
  process.exit(0);
}

console.log(`Outreach send limit for this run: ${sendLimit}. Leads loaded: ${leads.length}.`);

for (const lead of leads) {
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
    const rejectedStatus = getRejectedStatus(error);
    await updateLead(lead.id, {
      status: "needs_review",
      raw: {
        ...(lead.raw ?? {}),
        last_send_error: message,
        last_send_error_at: new Date().toISOString(),
        last_send_rejected_status: rejectedStatus,
      },
    });
    console.error(`Outreach email rejected for ${lead.email}: ${message}`);
    continue;
  }
}

async function findNextLeads(limit) {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,studio_name,city,website,email,phone,promo_code,status,last_contacted_at,raw,created_at",
  );
  params.set("status", "in.(new,approved)");
  params.append("email", "not.is.null");
  params.append("email", "neq.");
  params.set("order", "last_contacted_at.asc.nullsfirst,created_at.asc");
  // Load enough candidates to keep legacy photo-studio leads available even if
  // newer manufacturer leads are interleaved in the same table.
  params.set("limit", "10000");

  const response = await fetch(`${supabase.restUrl}/outreach_leads?${params}`, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Could not load outreach lead: ${await response.text()}`);
  }

  const candidates = (await response.json()) ?? [];

  // Rows created before segmentation have no raw.segment and are photo studios.
  // Manufacturers require a separate, manually reviewed proposal and must never
  // be picked up by the legacy automatic studio campaign.
  return candidates
    .filter((lead) => lead.raw?.segment !== "photo_booth_manufacturer")
    .slice(0, limit);
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

function getSendLimit() {
  const explicitLimit = Number(process.env.OUTREACH_SENDS_PER_RUN ?? "");
  if (Number.isInteger(explicitLimit) && explicitLimit > 0) {
    return Math.min(explicitLimit, getMaxSendLimit());
  }

  const startedAt = Date.parse(process.env.OUTREACH_RAMP_STARTED_AT ?? "");
  const campaignAgeDays = Number.isFinite(startedAt)
    ? Math.floor((Date.now() - startedAt) / 86_400_000)
    : 0;

  const rampStepDays = Math.max(1, Number(process.env.OUTREACH_RAMP_STEP_DAYS ?? "3"));
  const rampStepSize = Math.max(1, Number(process.env.OUTREACH_RAMP_STEP_SIZE ?? "1"));
  const rampBase = Math.max(1, Number(process.env.OUTREACH_RAMP_BASE ?? "1"));
  const rampLimit = rampBase + Math.floor(campaignAgeDays / rampStepDays) * rampStepSize;

  return Math.min(rampLimit, getMaxSendLimit());
}

function getMaxSendLimit() {
  return Math.max(1, Number(process.env.OUTREACH_MAX_SENDS_PER_RUN ?? "3"));
}

function buildOutreachSubject(variables) {
  return `${variables.studio_name}, AI-фотосессии для клиентов`;
}

function buildOutreachText(variables) {
  return `Здравствуйте, ${variables.studio_name}!

Мы сделали Virtual AI Photo Studio - сервис, где клиент загружает обычные селфи, выбирает интерьер и получает серию AI-портретов в готовой локации.

Для фотостудии это может быть простым дополнительным продуктом:
- показать клиенту быстрый пример "до/после";
- дать AI-фотосессию как бонус к пакету;
- предложить недорогой цифровой формат тем, кто пока не готов к полноценной съемке.

Для знакомства даем промокод ${variables.promo_code}. По нему можно бесплатно проверить результат на своих фото.

Сайт: https://virtualphotostudio.ru

Если вам интересно, можем подготовить отдельный промокод для клиентов вашей студии и подобрать интерьеры под ваш стиль.

С уважением,
Virtual AI Photo Studio

Если предложение неактуально, ответьте "стоп", и мы больше не будем писать.`;
}

function getRejectedStatus(error) {
  const responseCode = typeof error?.responseCode === "number" ? error.responseCode : null;
  const response = typeof error?.response === "string" ? error.response : "";

  if (responseCode === 554 || /spam/i.test(response)) return "rejected_spam";
  if (responseCode === 550 || responseCode === 551 || responseCode === 553) return "bad_email";
  if (responseCode) return `smtp_${responseCode}`;
  return "smtp_error";
}
