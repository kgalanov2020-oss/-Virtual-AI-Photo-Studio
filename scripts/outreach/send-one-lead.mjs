import nodemailer from "nodemailer";
import {
  MIXED_SEGMENT,
  PHOTO_BOOTH_SEGMENT,
  buildOutreachSubject,
  buildOutreachText,
  capSendLimitForMode,
  getLeadSegment,
  getPromoCodeForLead,
  normalizeOutreachMode,
  selectNextLeads,
} from "./outreach-campaign.mjs";

const supabase = createSupabaseConfig();
const smtp = createSmtpConfig();
const outreachMode = normalizeOutreachMode(process.env.OUTREACH_SEGMENT);
const autoSendEnabled = (process.env.OUTREACH_AUTO_SEND_ENABLED ?? "false") === "true";
const sendLimit = capSendLimitForMode(getSendLimit(), outreachMode);

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

const leads = await findNextLeads(sendLimit, outreachMode);

if (leads.length === 0) {
  console.log("No outreach leads ready for automatic email.");
  process.exit(0);
}

console.log(
  `Outreach mode: ${outreachMode}. Send limit for this run: ${sendLimit}. Leads loaded: ${leads.length}.`,
);

for (const lead of leads) {
  const leadSegment = getLeadSegment(lead);
  console.log(`Sending outreach email to ${lead.email} (${lead.studio_name})`);

  try {
    const claimedLead =
      leadSegment === PHOTO_BOOTH_SEGMENT ? await claimApprovedBoothLead(lead) : lead;

    if (!claimedLead) {
      console.log(`Skipped ${lead.email}: the approved booth lead was already claimed.`);
      continue;
    }

    await sendEmail(claimedLead, leadSegment);
    const sentAt = new Date().toISOString();
    await updateLead(claimedLead.id, {
      last_contacted_at: new Date().toISOString(),
      status: "sent",
      raw: {
        ...(claimedLead.raw ?? {}),
        last_auto_send_at: sentAt,
        last_auto_send_segment: leadSegment,
      },
    });
    console.log(`Sent ${leadSegment} outreach email to ${claimedLead.email}`);
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

async function findNextLeads(limit, mode) {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,studio_name,city,website,email,phone,promo_code,status,last_contacted_at,raw,created_at",
  );
  params.set("status", "in.(new,approved)");
  params.append("email", "not.is.null");
  params.append("email", "neq.");
  params.set("order", "last_contacted_at.asc.nullsfirst,created_at.asc");
  // Load enough candidates to keep both isolated queues available even when
  // their creation dates are interleaved in the same table.
  params.set("limit", "10000");

  const response = await fetch(`${supabase.restUrl}/outreach_leads?${params}`, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Could not load outreach lead: ${await response.text()}`);
  }

  const candidates = (await response.json()) ?? [];
  const lastAutoSegment = mode === MIXED_SEGMENT ? await findLastAutoSendSegment() : null;

  return selectNextLeads(candidates, mode, lastAutoSegment, limit);
}

async function findLastAutoSendSegment() {
  const params = new URLSearchParams();
  params.set("select", "raw,last_contacted_at");
  params.set("status", "eq.sent");
  params.append("last_contacted_at", "not.is.null");
  params.set("order", "last_contacted_at.desc");
  params.set("limit", "100");

  const response = await fetch(`${supabase.restUrl}/outreach_leads?${params}`, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Could not load the last outreach send: ${await response.text()}`);
  }

  const recentSentLeads = (await response.json()) ?? [];
  const lastAutomaticLead = recentSentLeads.find((lead) => lead.raw?.last_auto_send_at);
  if (!lastAutomaticLead) return null;

  return getLeadSegment(lastAutomaticLead);
}

async function claimApprovedBoothLead(lead) {
  const claimedAt = new Date().toISOString();
  const params = new URLSearchParams();
  params.set("id", `eq.${lead.id}`);
  params.set("status", "eq.approved");

  const response = await fetch(`${supabase.restUrl}/outreach_leads?${params}`, {
    body: JSON.stringify({
      raw: {
        ...(lead.raw ?? {}),
        auto_send_claimed_at: claimedAt,
        auto_send_claimed_segment: PHOTO_BOOTH_SEGMENT,
      },
      status: "needs_review",
    }),
    headers: {
      ...supabaseHeaders(),
      "content-type": "application/json",
      prefer: "return=representation",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`Could not claim booth lead ${lead.id}: ${await response.text()}`);
  }

  const claimedLeads = (await response.json()) ?? [];
  return claimedLeads[0] ?? null;
}

async function sendEmail(lead, segment) {
  const variables = {
    city: lead.city ?? "",
    promo_code: getPromoCodeForLead(lead, segment),
    segment,
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

function getRejectedStatus(error) {
  const responseCode = typeof error?.responseCode === "number" ? error.responseCode : null;
  const response = typeof error?.response === "string" ? error.response : "";

  if (responseCode === 554 || /spam/i.test(response)) return "rejected_spam";
  if (responseCode === 550 || responseCode === 551 || responseCode === 553) return "bad_email";
  if (responseCode) return `smtp_${responseCode}`;
  return "smtp_error";
}
