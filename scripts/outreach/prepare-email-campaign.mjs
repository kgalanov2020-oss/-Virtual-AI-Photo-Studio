import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const inputPath =
  process.env.OUTREACH_LEADS_CSV ?? path.join(root, "tmp", "outreach", "photo-studio-leads.csv");
const outputPath = path.join(root, "tmp", "outreach", "photo-studio-email-campaign.csv");
const textTemplatePath = path.join(root, "docs", "outreach", "email-template.txt");
const htmlTemplatePath = path.join(root, "docs", "outreach", "email-template.html");

if (!fs.existsSync(inputPath)) {
  throw new Error(`Leads CSV not found: ${inputPath}`);
}

const leads = parseCsv(fs.readFileSync(inputPath, "utf8"));
const textTemplate = fs.readFileSync(textTemplatePath, "utf8");
const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf8");

const rows = leads
  .filter((lead) => lead.email && lead.status !== "sent" && lead.status !== "stop")
  .map((lead) => {
    const values = {
      studio_name: lead.studio_name || "коллеги",
      city: lead.city || "",
      promo_code: lead.promo_code || "STUDIO",
    };
    const text = renderTemplate(textTemplate, values);
    const html = renderTemplate(htmlTemplate, values);

    return {
      email: lead.email,
      studio_name: lead.studio_name,
      city: lead.city,
      promo_code: values.promo_code,
      subject: `${values.studio_name}, новый формат AI-фотосессий для ваших клиентов`,
      text,
      html,
    };
  });

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, toCsv(rows), "utf8");
console.log(`Prepared ${rows.length} campaign rows: ${outputPath}`);

function renderTemplate(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
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

function toCsv(rows) {
  const headers = ["email", "studio_name", "city", "promo_code", "subject", "text", "html"];
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
