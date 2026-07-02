"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { ArticlePublication } from "@/lib/types";

type AdminArticle = {
  slug: string;
  title: string;
};

type PublicationFormState = {
  article_slug: string;
  notes: string;
  platform: string;
  published_at: string;
  status: ArticlePublication["status"];
  url: string;
};

type ArticlePublicationPanelProps = {
  articles: AdminArticle[];
};

const initialForm: PublicationFormState = {
  article_slug: "",
  notes: "",
  platform: "",
  published_at: "",
  status: "published",
  url: "",
};

export function ArticlePublicationPanel({ articles }: ArticlePublicationPanelProps) {
  const [adminToken, setAdminToken] = useState("");
  const [form, setForm] = useState<PublicationFormState>({
    ...initialForm,
    article_slug: articles[0]?.slug ?? "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [publications, setPublications] = useState<ArticlePublication[]>([]);

  const articlePublicationCounts = useMemo(() => {
    return publications.reduce<Record<string, number>>((acc, publication) => {
      acc[publication.article_slug] = (acc[publication.article_slug] ?? 0) + 1;
      return acc;
    }, {});
  }, [publications]);

  useEffect(() => {
    setAdminToken(window.localStorage.getItem("outreach_admin_token") ?? "");
  }, []);

  async function loadPublications() {
    const token = adminToken.trim();
    if (!token) {
      setMessage("Введите админ-токен.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    window.localStorage.setItem("outreach_admin_token", token);

    try {
      const response = await fetch("/api/admin/article-publications", {
        headers: { "x-outreach-token": token },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить публикации.");
      }

      setPublications(payload.publications ?? []);
      setMessage(`Загружено ссылок: ${(payload.publications ?? []).length}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить публикации.");
    } finally {
      setIsLoading(false);
    }
  }

  async function createPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = adminToken.trim();
    if (!token) {
      setMessage("Введите админ-токен.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    window.localStorage.setItem("outreach_admin_token", token);

    try {
      const response = await fetch("/api/admin/article-publications", {
        body: JSON.stringify({
          article_slug: form.article_slug,
          notes: form.notes,
          platform: form.platform,
          published_at: form.published_at || null,
          status: form.status,
          url: form.url,
        }),
        headers: {
          "content-type": "application/json",
          "x-outreach-token": token,
        },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось сохранить ссылку.");
      }

      setPublications((current) => [payload.publication, ...current]);
      setForm((current) => ({
        ...initialForm,
        article_slug: current.article_slug,
      }));
      setMessage("Ссылка на публикацию сохранена.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить ссылку.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePublication(publication: ArticlePublication) {
    const token = adminToken.trim();
    if (!token) {
      setMessage("Введите админ-токен.");
      return;
    }

    const confirmed = window.confirm(`Удалить ссылку ${publication.platform}?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/article-publications?id=${publication.id}`, {
        headers: { "x-outreach-token": token },
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось удалить ссылку.");
      }

      setPublications((current) => current.filter((item) => item.id !== publication.id));
      setMessage("Ссылка удалена.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить ссылку.");
    }
  }

  return (
    <div className="admin-publication-panel">
      <div className="admin-token-inline">
        <label>
          <span>Админ-токен</span>
          <input
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="OUTREACH_ADMIN_TOKEN"
            type="password"
            value={adminToken}
          />
        </label>
        <button className="button button-secondary" disabled={isLoading} onClick={loadPublications}>
          {isLoading ? "Загрузка..." : "Загрузить ссылки"}
        </button>
      </div>

      {message ? <div className="upload-message">{message}</div> : null}

      <form className="admin-publication-form" onSubmit={createPublication}>
        <label className="admin-publication-form-wide">
          <span>Статья</span>
          <select
            onChange={(event) =>
              setForm((current) => ({ ...current, article_slug: event.target.value }))
            }
            value={form.article_slug}
          >
            {articles.map((article) => (
              <option key={article.slug} value={article.slug}>
                {article.title} ({articlePublicationCounts[article.slug] ?? 0})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Площадка</span>
          <input
            onChange={(event) =>
              setForm((current) => ({ ...current, platform: event.target.value }))
            }
            placeholder="Дзен, VC, Telegram..."
            required
            value={form.platform}
          />
        </label>
        <label>
          <span>Статус</span>
          <select
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as ArticlePublication["status"],
              }))
            }
            value={form.status}
          >
            <option value="published">Опубликовано</option>
            <option value="planned">Запланировано</option>
            <option value="archived">Архив</option>
          </select>
        </label>
        <label>
          <span>Дата публикации</span>
          <input
            onChange={(event) =>
              setForm((current) => ({ ...current, published_at: event.target.value }))
            }
            type="datetime-local"
            value={form.published_at}
          />
        </label>
        <label className="admin-publication-form-wide">
          <span>Ссылка</span>
          <input
            onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
            placeholder="https://..."
            required
            type="url"
            value={form.url}
          />
        </label>
        <label className="admin-publication-form-wide">
          <span>Заметка</span>
          <input
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Например: опубликовано от имени основателя"
            value={form.notes}
          />
        </label>
        <button className="button button-primary" disabled={isSaving} type="submit">
          {isSaving ? "Сохраняем..." : "Сохранить ссылку"}
        </button>
      </form>

      <div className="admin-promo-table-wrap">
        <table className="admin-promo-table">
          <thead>
            <tr>
              <th>Статья</th>
              <th>Площадка</th>
              <th>Ссылка</th>
              <th>Дата</th>
              <th>Статус</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {publications.length > 0 ? (
              publications.map((publication) => (
                <tr key={publication.id}>
                  <td>
                    <strong>{publication.article_title}</strong>
                    {publication.notes ? <small>{publication.notes}</small> : null}
                  </td>
                  <td>{publication.platform}</td>
                  <td>
                    <a href={publication.url} rel="noreferrer" target="_blank">
                      Открыть
                    </a>
                  </td>
                  <td>{publication.published_at ? formatDate(publication.published_at) : "-"}</td>
                  <td>
                    <span className={`outreach-status-pill ${getStatusClass(publication.status)}`}>
                      {getStatusLabel(publication.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="outreach-delete-button"
                      onClick={() => deletePublication(publication)}
                      type="button"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>Введите токен и загрузите ссылки публикаций.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getStatusLabel(status: ArticlePublication["status"]) {
  return {
    archived: "Архив",
    planned: "Запланировано",
    published: "Опубликовано",
  }[status];
}

function getStatusClass(status: ArticlePublication["status"]) {
  return {
    archived: "is-stop",
    planned: "is-warning",
    published: "is-auto",
  }[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}
