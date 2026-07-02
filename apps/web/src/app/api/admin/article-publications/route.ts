import { NextRequest, NextResponse } from "next/server";
import { articles } from "@/lib/articles";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { ArticlePublication } from "@/lib/types";

type ArticlePublicationPayload = {
  article_slug?: string;
  notes?: string;
  platform?: string;
  published_at?: string | null;
  status?: ArticlePublication["status"];
  url?: string;
};

const articleBySlug = new Map(articles.map((article) => [article.slug, article]));
const statuses: ArticlePublication["status"][] = ["planned", "published", "archived"];

export async function GET(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("article_publications")
    .select(
      "id,article_slug,article_title,platform,url,status,published_at,notes,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ publications: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  const payload = normalizePayload((await request.json()) as ArticlePublicationPayload);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("article_publications")
    .insert(payload)
    .select(
      "id,article_slug,article_title,platform,url,status,published_at,notes,created_at,updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ publication: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const authError = authorize(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("article_publications").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function normalizePayload(payload: ArticlePublicationPayload):
  | Omit<ArticlePublication, "id" | "created_at" | "updated_at">
  | { error: string } {
  const articleSlug = payload.article_slug?.trim() ?? "";
  const article = articleBySlug.get(articleSlug);
  const platform = payload.platform?.trim() ?? "";
  const rawUrl = payload.url?.trim() ?? "";
  const status = payload.status ?? "published";

  if (!article) {
    return { error: "Выберите статью из списка." };
  }

  if (platform.length < 2 || platform.length > 80) {
    return { error: "Укажите площадку: Дзен, VC, Telegram, сайт партнёра и т.д." };
  }

  if (!statuses.includes(status)) {
    return { error: "Неверный статус публикации." };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: "Введите корректную ссылку, начиная с https://." };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { error: "Ссылка должна начинаться с http:// или https://." };
  }

  return {
    article_slug: article.slug,
    article_title: article.title,
    notes: payload.notes?.trim() || null,
    platform,
    published_at: normalizeDate(payload.published_at),
    status,
    url: url.toString(),
  };
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
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
