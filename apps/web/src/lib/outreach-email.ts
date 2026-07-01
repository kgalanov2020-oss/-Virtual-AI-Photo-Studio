export type OutreachEmailVariables = {
  city: string;
  promo_code: string;
  studio_name: string;
};

export function buildOutreachSubject(variables: OutreachEmailVariables) {
  return `${variables.studio_name}, новый формат AI-фотосессий для ваших клиентов`;
}

export function buildOutreachText(variables: OutreachEmailVariables) {
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

export function buildOutreachHtml(variables: OutreachEmailVariables) {
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
              <img src="https://virtualphotostudio.ru/selfie-guide/01-front-neutral.jpg" alt="Селфи до AI-фотосессии" style="width:100%;border-radius:10px;display:block;">
            </div>
            <div>
              <div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#8b7d70;text-transform:uppercase;margin-bottom:8px;">После</div>
              <img src="https://virtualphotostudio.ru/before-after/after-luxury-garage-01.jpg" alt="Результат AI-фотосессии" style="width:100%;border-radius:10px;display:block;">
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
