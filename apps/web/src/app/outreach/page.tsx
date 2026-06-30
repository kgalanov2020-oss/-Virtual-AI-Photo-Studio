"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const defaultBody = `Здравствуйте, {{studio_name}}!

Я представляю Virtual AI Photo Studio - сервис, который превращает обычные селфи клиента в готовую серию портретов в выбранном интерьере: с одеждой, светом, позами и атмосферой локации.

Это может быть полезно фотостудиям как дополнительный продукт: клиент выбирает интерьер, загружает 6-10 обычных фото, а получает AI-фотосессию без бронирования зала, визажиста и съёмочного дня.

Для знакомства даём промокод {{promo_code}}: можно бесплатно протестировать результат на своих фото.

Если интересно, можем обсудить партнёрский формат: промокоды для ваших клиентов, отдельные подборки интерьеров или тестовую серию под вашу студию.

С уважением,
Virtual AI Photo Studio
https://virtualphotostudio.ru

Если предложение неактуально, ответьте "стоп", и мы больше не будем писать.`;

export default function OutreachPage() {
  const [studioName, setStudioName] = useState("Название студии");
  const [city, setCity] = useState("Москва");
  const [promoCode, setPromoCode] = useState("WELCOME");
  const [subjectTemplate, setSubjectTemplate] = useState(
    "{{studio_name}}, AI-фотосессии для клиентов вашей студии",
  );
  const [bodyTemplate, setBodyTemplate] = useState(defaultBody);
  const [copyMessage, setCopyMessage] = useState("");

  const variables = useMemo(
    () => ({
      city,
      promo_code: promoCode.trim().toUpperCase() || "WELCOME",
      studio_name: studioName.trim() || "коллеги",
    }),
    [city, promoCode, studioName],
  );

  const subject = renderTemplate(subjectTemplate, variables);
  const textBody = renderTemplate(bodyTemplate, variables);
  const htmlBody = buildHtmlEmail(textBody, variables.promo_code);

  async function copyToClipboard(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopyMessage(`${label} скопирован.`);
    window.setTimeout(() => setCopyMessage(""), 1800);
  }

  return (
    <main className="page outreach-page">
      <header className="topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
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
    </main>
  );
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
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
      ${paragraphs}
      <div class="outreach-email-comparison">
        <div>
          <span>До</span>
          <img alt="Селфи до AI-фотосессии" src="https://virtualphotostudio.ru/selfie-guide/01-front-neutral.jpg">
        </div>
        <div>
          <span>После</span>
          <img alt="Результат AI-фотосессии" src="https://virtualphotostudio.ru/before-after/after-luxury-garage-01.jpg">
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
