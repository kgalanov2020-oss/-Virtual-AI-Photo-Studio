"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OutreachLead = {
  id: string;
  studio_name: string;
  city: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  promo_code: string;
  status: string;
  last_contacted_at: string | null;
  raw: Record<string, unknown> | null;
  created_at: string;
};

const defaultBody = `Здравствуйте, {{studio_name}}!

Мы сделали Virtual AI Photo Studio - сервис, который превращает обычные селфи клиента в готовую серию портретов в интерьерной фотостудии: с подходящей одеждой, светом, позами и атмосферой локации.

Фотостудия может использовать это как дополнительный продукт: показать клиенту пример "до/после", дать промокод и получать заявки от тех, кто пока не готов бронировать зал или хочет быстро протестировать образ.

Для знакомства даём промокод {{promo_code}}. По нему можно бесплатно проверить результат на своих фото.

Если вам интересно, можем подготовить отдельный промокод для клиентов вашей студии, подборку интерьеров под ваш стиль или тестовую серию с вашим залом.

С уважением,
Virtual AI Photo Studio
https://virtualphotostudio.ru

Если предложение неактуально, ответьте "стоп", и мы больше не будем писать.`;

export default function OutreachPage() {
  const [studioName, setStudioName] = useState("Название студии");
  const [city, setCity] = useState("Москва");
  const [promoCode, setPromoCode] = useState("STUDIO");
  const [subjectTemplate, setSubjectTemplate] = useState(
    "{{studio_name}}, новый формат AI-фотосессий для ваших клиентов",
  );
  const [bodyTemplate, setBodyTemplate] = useState(defaultBody);
  const [copyMessage, setCopyMessage] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [leadsMessage, setLeadsMessage] = useState("");
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [emailOnly, setEmailOnly] = useState(true);
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  const variables = useMemo(
    () => ({
      city,
      promo_code: promoCode.trim().toUpperCase() || "STUDIO",
      studio_name: studioName.trim() || "коллеги",
    }),
    [city, promoCode, studioName],
  );

  const subject = renderTemplate(subjectTemplate, variables);
  const textBody = renderTemplate(bodyTemplate, variables);
  const htmlBody = buildHtmlEmail(textBody, variables.promo_code);

  useEffect(() => {
    setAdminToken(window.localStorage.getItem("outreach_admin_token") ?? "");
  }, []);

  async function copyToClipboard(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopyMessage(`${label} скопирован.`);
    window.setTimeout(() => setCopyMessage(""), 1800);
  }

  async function loadLeads() {
    const token = adminToken.trim();
    if (!token) {
      setLeadsMessage("Введите админ-токен для просмотра лидов.");
      return;
    }

    setIsLoadingLeads(true);
    setLeadsMessage("");
    window.localStorage.setItem("outreach_admin_token", token);

    try {
      const params = new URLSearchParams({
        emailOnly: String(emailOnly),
        limit: "10000",
      });
      const response = await fetch(`/api/outreach/leads?${params}`, {
        headers: {
          "x-outreach-token": token,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить лиды.");
      }

      setLeads(payload.leads ?? []);
      setLeadsMessage(`Загружено студий: ${(payload.leads ?? []).length}.`);
    } catch (error) {
      setLeadsMessage(error instanceof Error ? error.message : "Не удалось загрузить лиды.");
    } finally {
      setIsLoadingLeads(false);
    }
  }

  async function sendLead(lead: OutreachLead) {
    const token = adminToken.trim();
    if (!token) {
      setLeadsMessage("Введите админ-токен перед отправкой.");
      return;
    }

    setSendingLeadId(lead.id);
    setLeadsMessage("");

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 35000);
      const response = await fetch("/api/outreach/send", {
        body: JSON.stringify({ leadId: lead.id }),
        headers: {
          "content-type": "application/json",
          "x-outreach-token": token,
        },
        method: "POST",
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось отправить письмо.");
      }

      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id
            ? {
                ...item,
                last_contacted_at: payload.lead.last_contacted_at,
                raw: payload.lead.raw ?? item.raw,
                status: "sent",
              }
            : item,
        ),
      );
      setLeadsMessage(`Письмо отправлено: ${lead.studio_name}.`);
    } catch (error) {
      setLeadsMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Отправка не ответила за 35 секунд. Проверьте SMTP-пароль и Render Logs web-сервиса."
          : error instanceof Error
            ? error.message
            : "Не удалось отправить письмо.",
      );
    } finally {
      setSendingLeadId(null);
    }
  }

  async function deleteLead(lead: OutreachLead) {
    const token = adminToken.trim();
    if (!token) {
      setLeadsMessage("Введите админ-токен перед удалением.");
      return;
    }

    const confirmed = window.confirm(`Удалить лид "${lead.studio_name}"?`);
    if (!confirmed) return;

    setDeletingLeadId(lead.id);
    setLeadsMessage("");

    try {
      const response = await fetch(`/api/outreach/leads?leadId=${lead.id}`, {
        headers: {
          "x-outreach-token": token,
        },
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось удалить лид.");
      }

      setLeads((current) => current.filter((item) => item.id !== lead.id));
      setLeadsMessage(`Лид удалён: ${lead.studio_name}.`);
    } catch (error) {
      setLeadsMessage(error instanceof Error ? error.message : "Не удалось удалить лид.");
    } finally {
      setDeletingLeadId(null);
    }
  }

  return (
    <main className="page outreach-page">
      <header className="topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
          <Link href="/admin">Админ</Link>
          <Link href="/">Каталог</Link>
          <Link href="/sessions">Мои фотосессии</Link>
        </nav>
      </header>

      <section className="upload-layout">
        <div className="upload-copy">
          <p className="eyebrow">Партнёрская рассылка</p>
          <h1>Письмо для фотостудий</h1>
          <p>
            Подставьте название студии, город и промокод, проверьте текст и
            скопируйте готовое письмо для n8n или ручной отправки.
          </p>
        </div>
      </section>

      <section className="outreach-layout">
        <div className="section outreach-editor">
          <div className="section-header">
            <div>
              <h2>Настройки</h2>
              <p>Переменные автоматически подставляются в тему и текст письма.</p>
            </div>
          </div>

          <div className="outreach-fields">
            <label>
              <span>Название студии</span>
              <input
                onChange={(event) => setStudioName(event.target.value)}
                type="text"
                value={studioName}
              />
            </label>
            <label>
              <span>Город</span>
              <input onChange={(event) => setCity(event.target.value)} type="text" value={city} />
            </label>
            <label>
              <span>Промокод</span>
              <input
                onChange={(event) => setPromoCode(event.target.value)}
                type="text"
                value={promoCode}
              />
            </label>
          </div>

          <label className="outreach-textarea-label">
            <span>Тема</span>
            <input
              onChange={(event) => setSubjectTemplate(event.target.value)}
              type="text"
              value={subjectTemplate}
            />
          </label>

          <label className="outreach-textarea-label">
            <span>Текст письма</span>
            <textarea
              onChange={(event) => setBodyTemplate(event.target.value)}
              rows={17}
              value={bodyTemplate}
            />
          </label>

          <div className="outreach-actions">
            <button
              className="button button-secondary"
              onClick={() => copyToClipboard(subject, "Тема")}
              type="button"
            >
              Копировать тему
            </button>
            <button
              className="button button-secondary"
              onClick={() => copyToClipboard(textBody, "Текст")}
              type="button"
            >
              Копировать текст
            </button>
            <button
              className="button button-primary"
              onClick={() => copyToClipboard(htmlBody, "HTML")}
              type="button"
            >
              Копировать HTML
            </button>
          </div>

          {copyMessage ? <div className="upload-message success">{copyMessage}</div> : null}
        </div>

        <div className="section outreach-preview-section">
          <div className="section-header">
            <div>
              <h2>Предпросмотр</h2>
              <p>Так письмо будет выглядеть с блоком до/после.</p>
            </div>
          </div>

          <div className="outreach-subject">
            <span>Тема</span>
            <strong>{subject}</strong>
          </div>

          <div className="outreach-email-preview" dangerouslySetInnerHTML={{ __html: htmlBody }} />
        </div>
      </section>

      <section className="section outreach-leads-section">
        <div className="section-header">
          <div>
            <h2>Найденные студии</h2>
            <p>Список появляется после запуска сборщика на Render Cron или локально.</p>
          </div>
        </div>

        <div className="outreach-token-row">
          <label>
            <span>Админ-токен</span>
            <input
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="OUTREACH_ADMIN_TOKEN"
              type="password"
              value={adminToken}
            />
          </label>
          <label className="outreach-checkbox-label">
            <input
              checked={emailOnly}
              onChange={(event) => setEmailOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Только с email</span>
          </label>
          <button className="button button-primary" disabled={isLoadingLeads} onClick={loadLeads}>
            {isLoadingLeads ? "Загрузка..." : "Показать студии"}
          </button>
        </div>

        {leadsMessage ? <div className="upload-message">{leadsMessage}</div> : null}

        <div className="outreach-leads-scroll">
          <table className="outreach-leads-table">
            <thead>
              <tr>
                <th>Студия</th>
                <th>Город</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Сайт</th>
                <th>Статус</th>
                <th>Промокод</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {leads.length > 0 ? (
                leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.studio_name}</td>
                    <td>{lead.city ?? "-"}</td>
                    <td>{lead.email ?? "-"}</td>
                    <td>{lead.phone ?? "-"}</td>
                    <td>
                      {lead.website ? (
                        <a href={lead.website} rel="noreferrer" target="_blank">
                          Открыть
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span className={`outreach-status-pill ${getLeadStatusClass(lead)}`}>
                        {getLeadStatusLabel(lead)}
                      </span>
                      {lead.last_contacted_at ? (
                        <small>{formatDateTime(lead.last_contacted_at)}</small>
                      ) : null}
                    </td>
                    <td>{lead.promo_code}</td>
                    <td>
                      <div className="outreach-row-actions">
                        <button
                          className="outreach-send-button"
                          disabled={!lead.email || isLeadSent(lead) || sendingLeadId === lead.id}
                          onClick={() => sendLead(lead)}
                          type="button"
                        >
                          {sendingLeadId === lead.id
                            ? "Отправка..."
                            : isLeadSent(lead)
                              ? "Отправлено"
                              : "Отправить"}
                        </button>
                        <button
                          className="outreach-delete-button"
                          disabled={deletingLeadId === lead.id}
                          onClick={() => deleteLead(lead)}
                          type="button"
                        >
                          {deletingLeadId === lead.id ? "Удаление..." : "Удалить"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>Пока нет загруженных лидов.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
}

function isLeadSent(lead: OutreachLead) {
  return lead.status === "sent";
}

function getLeadStatusLabel(lead: OutreachLead) {
  if (lead.status === "sent" && hasRawDate(lead, "last_auto_send_at")) {
    return "Направлено автоматически";
  }

  if (lead.status === "sent" && hasRawDate(lead, "last_manual_send_at")) {
    return "Отправлено вручную";
  }

  const labels: Record<string, string> = {
    approved: "Одобрен",
    bad_email: "Плохой email",
    duplicate: "Дубликат",
    needs_manual_email: "Нужен email",
    needs_review: "Проверить",
    new: "Новый",
    replied: "Ответили",
    sent: "Отправлено",
    stop: "Стоп",
  };

  return labels[lead.status] ?? lead.status;
}

function getLeadStatusClass(lead: OutreachLead) {
  if (lead.status === "sent" && hasRawDate(lead, "last_auto_send_at")) return "is-auto";
  if (lead.status === "sent" && hasRawDate(lead, "last_manual_send_at")) return "is-manual";
  if (lead.status === "sent") return "is-sent";
  if (lead.status === "needs_review" || lead.status === "bad_email") return "is-warning";
  if (lead.status === "stop") return "is-stop";
  return "";
}

function hasRawDate(lead: OutreachLead, key: string) {
  return typeof lead.raw?.[key] === "string" && Boolean(lead.raw[key]);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function buildHtmlEmail(textBody: string, promoCode: string) {
  const paragraphs = textBody
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");

  return `
    <div class="outreach-email-shell">
      <div class="outreach-email-hero">
        <span>Virtual AI Photo Studio</span>
        <h1>AI-фотосессия из обычных селфи клиента</h1>
        <p>Готовый формат для фотостудий: до/после, промокод и быстрый тест без съёмочного дня.</p>
      </div>
      ${paragraphs}
      <div class="outreach-email-comparison">
        <div>
          <span>До</span>
          <img alt="Селфи до AI-фотосессии" src="https://virtualphotostudio.ru/selfie-guide/01-front-neutral.webp">
        </div>
        <div>
          <span>После</span>
          <img alt="Результат AI-фотосессии" src="https://virtualphotostudio.ru/before-after/after-luxury-garage-01.webp">
        </div>
      </div>
      <a class="outreach-email-button" href="https://virtualphotostudio.ru/">Посмотреть сервис и пример до/после</a>
      <p class="outreach-email-note">Промокод для теста: <strong>${escapeHtml(promoCode)}</strong></p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
