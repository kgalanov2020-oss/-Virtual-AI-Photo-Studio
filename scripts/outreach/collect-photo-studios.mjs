import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outputDir = path.join(root, "tmp", "outreach");
const segment = normalizeSegment(process.env.OUTREACH_SEGMENT);
const outputPath = path.join(
  outputDir,
  segment === "photo_booth_manufacturer" ? "photo-booth-manufacturers.csv" : "photo-studio-leads.csv",
);
const defaultCitiesPath = path.join(root, "docs", "outreach", "russia-cities.txt");

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
const cities = readCities();
const baseQueries = splitEnv(
  "OUTREACH_QUERIES",
  segment === "photo_booth_manufacturer"
    ? "производитель фотокабин,производство фотобудок,интерактивные фотостойки,фототерминалы производство,photo booth manufacturer"
    : "фотостудия,аренда фотостудии,интерьерная фотостудия,photo studio",
);
const seedUrls = splitEnv(
  "OUTREACH_SEED_URLS",
  segment === "photo_booth_manufacturer"
    ? "https://photostarpro.ru/,https://videochef.ru/proizvodstvo/klassika,https://artkamera.ru/proizvodstvo,https://fotobudkasale.ru/lprice_1,https://www.interactive-photo.ru/,https://expressvend.ru/fotobooth/"
    : "",
);
const leadLimit = Number(process.env.OUTREACH_LIMIT ?? "1000");
const promoCode =
  process.env.OUTREACH_PROMO_CODE ?? (segment === "photo_booth_manufacturer" ? "CABIN" : "STUDIO");
const supabase = createSupabaseConfig();

if (!apiKey && seedUrls.length === 0) {
  throw new Error("Set GOOGLE_PLACES_API_KEY or OUTREACH_SEED_URLS before running this script.");
}

fs.mkdirSync(outputDir, { recursive: true });

const seenPlaceIds = new Set();
const leads = [];
const seenLeadKeys = new Set();

if (fs.existsSync(outputPath) && process.env.OUTREACH_RESUME !== "false") {
  for (const lead of parseCsv(fs.readFileSync(outputPath, "utf8"))) {
    const key = lead.unique_key || buildLeadKey(lead);
    if (!key || seenLeadKeys.has(key)) continue;
    seenLeadKeys.add(key);
    leads.push(lead);
  }
}

await preloadSupabaseKeys();

for (const website of seedUrls) {
  if (leads.length >= leadLimit) break;
  const lead = await buildSeedLead(website);
  const leadKey = buildLeadKey(lead);
  if (!leadKey || seenLeadKeys.has(leadKey)) continue;
  seenLeadKeys.add(leadKey);
  leads.push({ ...lead, raw: JSON.stringify(lead.raw), unique_key: leadKey });
  await upsertSupabaseLead(lead, leadKey);
  fs.writeFileSync(outputPath, toCsv(leads), "utf8");
  console.log(`${leads.length}/${leadLimit}: ${lead.studio_name} (seed)`);
}

for (const city of apiKey ? cities : []) {
  for (const baseQuery of baseQueries) {
    if (leads.length >= leadLimit) break;
    const query = `${baseQuery} ${city}`;
    const places = await searchPlaces(query, leadLimit - leads.length);

    for (const place of places) {
      if (leads.length >= leadLimit) break;
      if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);

      const details = await getPlaceDetails(place.place_id);
      const website = details.website ?? "";
      const emails = website ? await findEmailsOnWebsite(website) : [];
      const lead = {
        studio_name: details.name ?? place.name ?? "",
        city,
        website,
        email: emails[0] ?? "",
        phone: details.formatted_phone_number ?? "",
        source: "google_places",
        promo_code: promoCode,
        status:
          emails.length > 0
            ? segment === "photo_booth_manufacturer"
              ? "needs_review"
              : "new"
            : "needs_manual_email",
        last_contacted_at: "",
        raw: {
          google_place_id: place.place_id,
          google_query: query,
          email_count: emails.length,
          segment,
        },
      };
      const leadKey = buildLeadKey(lead);

      if (!leadKey || seenLeadKeys.has(leadKey)) continue;
      seenLeadKeys.add(leadKey);

      const csvLead = { ...lead, raw: JSON.stringify(lead.raw), unique_key: leadKey };
      leads.push(csvLead);
      await upsertSupabaseLead(lead, leadKey);
      fs.writeFileSync(outputPath, toCsv(leads), "utf8");
      console.log(`${leads.length}/${leadLimit}: ${details.name ?? place.name ?? ""} (${city})`);

      await sleep(350);
    }
  }
}

async function buildSeedLead(website) {
  const normalizedWebsite = new URL(website).toString();
  const page = await fetchWebsitePage(normalizedWebsite);
  const emails = page ? extractEmails(page.html) : [];
  const title = page ? extractCompanyName(page.html, page.url) : new URL(website).hostname;

  return {
    studio_name: title,
    city: "",
    website: normalizedWebsite,
    email: emails[0] ?? "",
    phone: page ? extractPhone(page.html) : "",
    source: "seed_website",
    promo_code: promoCode,
    status: emails.length > 0 ? "needs_review" : "needs_manual_email",
    last_contacted_at: "",
    raw: { segment, seed_url: normalizedWebsite, email_count: emails.length },
  };
}

async function fetchWebsitePage(website) {
  for (const url of buildContactUrls(website)) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "VirtualAIPhotoStudio partner research" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      return { html: await response.text(), url };
    } catch {
      continue;
    }
  }
  return null;
}

function extractCompanyName(html, url) {
  const ogTitle = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)?.[1];
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return decodeHtml(ogTitle || title || new URL(url).hostname).split(/[|—–]/)[0].trim();
}

function extractPhone(html) {
  return html.match(/(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/)?.[0] ?? "";
}

function decodeHtml(value) {
  return value.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&nbsp;", " ");
}

fs.writeFileSync(outputPath, toCsv(leads), "utf8");
console.log(`Saved ${leads.length} leads to ${outputPath}`);
console.log(`With email: ${leads.filter((lead) => lead.email).length}`);

function createSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("Supabase env is missing. Leads will be saved only to CSV.");
    return null;
  }

  return {
    restUrl: `${supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "")}/rest/v1`,
    serviceRoleKey,
  };
}

async function preloadSupabaseKeys() {
  if (!supabase) return;

  const response = await fetch(`${supabase.restUrl}/outreach_leads?select=unique_key&limit=10000`, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    console.warn(`Could not preload Supabase outreach keys: ${await response.text()}`);
    return;
  }

  const data = await response.json();
  for (const lead of data ?? []) {
    if (lead.unique_key) seenLeadKeys.add(lead.unique_key);
  }
}

async function upsertSupabaseLead(lead, uniqueKey) {
  if (!supabase) return;

  const response = await fetch(`${supabase.restUrl}/outreach_leads?on_conflict=unique_key`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      unique_key: uniqueKey,
      studio_name: lead.studio_name,
      city: lead.city || null,
      website: lead.website || null,
      email: lead.email || null,
      phone: lead.phone || null,
      source: lead.source,
      promo_code: lead.promo_code,
      status: lead.status,
      last_contacted_at: lead.last_contacted_at || null,
      raw: lead.raw ?? {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase outreach_leads upsert failed: ${await response.text()}`);
  }
}

function supabaseHeaders() {
  return {
    apikey: supabase.serviceRoleKey,
    authorization: `Bearer ${supabase.serviceRoleKey}`,
  };
}

async function searchPlaces(query, limit) {
  const places = [];
  let pageToken = "";

  while (places.length < limit) {
    const params = new URLSearchParams({
      query,
      key: apiKey,
      language: "ru",
    });

    if (pageToken) {
      params.set("pagetoken", pageToken);
      await sleep(2200);
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
    );
    const payload = await response.json();

    if (payload.status && !["OK", "ZERO_RESULTS"].includes(payload.status)) {
      console.warn(`Google Places status for "${query}": ${payload.status}`);
      break;
    }

    places.push(...(payload.results ?? []));
    pageToken = payload.next_page_token ?? "";
    if (!pageToken || payload.status === "ZERO_RESULTS") break;
  }

  return places.slice(0, limit);
}

async function getPlaceDetails(placeId) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "name,website,formatted_phone_number",
    key: apiKey,
    language: "ru",
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
  );
  const payload = await response.json();
  return payload.result ?? {};
}

async function findEmailsOnWebsite(website) {
  const urls = buildContactUrls(website);
  const emails = new Set();

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(url, {
        headers: {
          "user-agent": "VirtualAIPhotoStudio outreach contact lookup",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) continue;
      const html = await response.text();
      for (const email of extractEmails(html)) {
        emails.add(email);
      }
    } catch {
      continue;
    }

    if (emails.size > 0) break;
    await sleep(250);
  }

  return [...emails];
}

function buildContactUrls(website) {
  const url = new URL(website);
  const origin = url.origin;

  return [
    website,
    `${origin}/contacts`,
    `${origin}/contact`,
    `${origin}/kontakty`,
    `${origin}/kontakti`,
    `${origin}/o-nas`,
    `${origin}/about`,
  ];
}

function extractEmails(html) {
  const decoded = html
    .replaceAll("[at]", "@")
    .replaceAll("(at)", "@")
    .replaceAll("&#64;", "@")
    .replaceAll("%40", "@");
  const matches = decoded.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];

  return matches
    .map((email) => email.toLowerCase())
    .filter((email) => !email.includes("example."))
    .filter((email) => !email.includes("sentry."))
    .filter((email) => !email.includes("wixpress."))
    .filter((email) => !/\.(png|jpg|jpeg|gif|webp)$/i.test(email));
}

function toCsv(rows) {
  const headers = [
    "unique_key",
    "studio_name",
    "city",
    "website",
    "email",
    "phone",
    "source",
    "promo_code",
    "status",
    "last_contacted_at",
    "raw",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n");
}

function buildLeadKey(lead) {
  const email = String(lead.email ?? "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const website = String(lead.website ?? "").trim().toLowerCase();
  if (website) {
    try {
      return `site:${new URL(website).hostname.replace(/^www\./, "")}`;
    } catch {
      return `site:${website}`;
    }
  }

  const phone = String(lead.phone ?? "").replace(/\D/g, "");
  if (phone) return `phone:${phone}`;

  return `name:${String(lead.studio_name ?? "").trim().toLowerCase()}:${String(lead.city ?? "")
    .trim()
    .toLowerCase()}`;
}

function csvCell(value) {
  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function splitEnv(name, fallback) {
  return (process.env[name] ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSegment(value) {
  return value === "photo_booth_manufacturer" ? value : "photo_studio";
}

function readCities() {
  const citiesFile = process.env.OUTREACH_CITIES_FILE ?? defaultCitiesPath;
  if (process.env.OUTREACH_CITIES) return splitEnv("OUTREACH_CITIES", "");
  if (fs.existsSync(citiesFile)) {
    return fs
      .readFileSync(citiesFile, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"));
  }

  return ["Москва", "Санкт-Петербург"];
}

function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
