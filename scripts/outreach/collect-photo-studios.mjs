import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outputDir = path.join(root, "tmp", "outreach");
const outputPath = path.join(outputDir, "photo-studio-leads.csv");
const defaultCitiesPath = path.join(root, "docs", "outreach", "russia-cities.txt");

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
const cities = readCities();
const baseQueries = splitEnv(
  "OUTREACH_QUERIES",
  "фотостудия,аренда фотостудии,интерьерная фотостудия,photo studio",
);
const leadLimit = Number(process.env.OUTREACH_LIMIT ?? "1000");
const promoCode = process.env.OUTREACH_PROMO_CODE ?? "STUDIO";

if (!apiKey) {
  throw new Error("Set GOOGLE_PLACES_API_KEY before running this script.");
}

fs.mkdirSync(outputDir, { recursive: true });

const seenPlaceIds = new Set();
const leads = [];
const seenLeadKeys = new Set();

if (fs.existsSync(outputPath) && process.env.OUTREACH_RESUME !== "false") {
  for (const lead of parseCsv(fs.readFileSync(outputPath, "utf8"))) {
    const key = lead.email || lead.website || `${lead.studio_name}:${lead.city}:${lead.phone}`;
    if (!key || seenLeadKeys.has(key)) continue;
    seenLeadKeys.add(key);
    leads.push(lead);
  }
}

for (const city of cities) {
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
      const leadKey =
        emails[0] ?? website ?? `${details.name ?? place.name ?? ""}:${city}:${details.formatted_phone_number ?? ""}`;

      if (!leadKey || seenLeadKeys.has(leadKey)) continue;
      seenLeadKeys.add(leadKey);

      leads.push({
        studio_name: details.name ?? place.name ?? "",
        city,
        website,
        email: emails[0] ?? "",
        phone: details.formatted_phone_number ?? "",
        source: "google_places",
        promo_code: promoCode,
        status: emails.length > 0 ? "new" : "needs_manual_email",
        last_contacted_at: "",
      });
      fs.writeFileSync(outputPath, toCsv(leads), "utf8");
      console.log(`${leads.length}/${leadLimit}: ${details.name ?? place.name ?? ""} (${city})`);

      await sleep(350);
    }
  }
}

fs.writeFileSync(outputPath, toCsv(leads), "utf8");
console.log(`Saved ${leads.length} leads to ${outputPath}`);
console.log(`With email: ${leads.filter((lead) => lead.email).length}`);

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
    "studio_name",
    "city",
    "website",
    "email",
    "phone",
    "source",
    "promo_code",
    "status",
    "last_contacted_at",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n");
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
