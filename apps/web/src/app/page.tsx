import { PRODUCT_IMAGES_PER_STUDIO, TARGET_SHOTS_PER_STUDIO } from "@/lib/generation";
import { getActiveStudios } from "@/lib/studios";

export const dynamic = "force-dynamic";

const scenarioLabels: Record<string, string> = {
  "modern-office": "Для личного бренда и делового образа",
  "premium-gym": "Для спортивного lifestyle-контента",
  "boutique-hotel": "Для элегантной вечерней серии",
  "castle-library": "Для классического статусного портрета",
  "hi-tech-lab": "Для технологичного и современного образа",
  "urban-loft": "Для смелой editorial-съёмки",
  "luxury-penthouse": "Для премиального lifestyle",
  "art-gallery": "Для творческого и модного портрета",
  "wellness-spa": "Для спокойной relaxed-серии",
  "executive-boardroom": "Для строгого executive-портрета",
};

export default async function Home() {
  const studiosResult = await getActiveStudios();

  if (studiosResult.status === "missing-env") {
    return <SetupPanel />;
  }

  if (studiosResult.status === "error") {
    return <ErrorPanel message={studiosResult.message} />;
  }

  const studios = studiosResult.studios;
  const featuredStudio = studios.find((studio) => studio.slug === "modern-office") ?? studios[0];

  return (
    <main className="page">
      <header className="topbar landing-topbar">
        <div className="brand">Виртуальная AI Фотостудия</div>
        <nav className="landing-nav" aria-label="Главная навигация">
          <a href="#studios">Интерьеры</a>
          <a href="#process">Как работает</a>
          <a href="#result">Что получите</a>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="eyebrow">Виртуальная фотостудия</p>
          <h1>Фотосессия в интерьере, который выглядит как реальная локация.</h1>
          <p className="lead">
            Вы выбираете готовое пространство, загружаете селфи и получаете серию
            портретов с продуманной одеждой, позами, светом и дистанциями камеры.
          </p>
          <div className="actions">
            <a className="button button-primary" href="#studios">
              Выбрать интерьер
            </a>
            <a className="button button-secondary button-on-hero" href={`/upload?studio=${featuredStudio?.slug ?? "modern-office"}`}>
              Загрузить селфи
            </a>
          </div>
          <div className="hero-facts" aria-label="Параметры фотосессии">
            <span>
              <strong>{studios.length}</strong>
              интерьеров
            </span>
            <span>
              <strong>{PRODUCT_IMAGES_PER_STUDIO}</strong>
              фото в серии
            </span>
            <span>
              <strong>10</strong>
              сцен съёмки
            </span>
          </div>
        </div>
      </section>

      <section className="section landing-intro">
        <div>
          <p className="eyebrow">Сначала пространство</p>
          <h2>Пользователь выбирает не фильтр, а место будущей съёмки.</h2>
        </div>
        <p>
          Каждый интерьер работает как отдельная фотостудия: у него есть 9 ракурсов
          пространства, свой свет, настроение, гардероб и сценарии позирования.
        </p>
      </section>

      <section className="section" id="studios">
        <div className="section-header">
          <div>
            <h2>Готовые интерьеры</h2>
            <p>Откройте пространство, посмотрите ракурсы и выберите атмосферу будущей серии.</p>
          </div>
          <div className="count-pill">{studios.length} пространств</div>
        </div>

        <div className="landing-studio-grid">
          {studios.map((studio) => (
            <article className="landing-studio-card" key={studio.id}>
              {studio.preview_url ? (
                <img alt={studio.name} src={studio.preview_url} />
              ) : (
                <div className="studio-card-placeholder">{studio.name}</div>
              )}
              <div>
                <span>{scenarioLabels[studio.slug] ?? "Для профессиональной фотосессии"}</span>
                <h3>{studio.name}</h3>
                <p>{studio.description}</p>
                <div className="studio-card-actions">
                  <a className="button button-secondary" href={`/studios/${studio.slug}`}>
                    Смотреть интерьер
                  </a>
                  <a className="button button-primary" href={`/upload?studio=${studio.slug}`}>
                    Выбрать
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section process-section" id="process">
        <div className="section-header">
          <div>
            <h2>Как проходит съёмка</h2>
            <p>Путь должен ощущаться как запись в студию, а не как работа с техническим инструментом.</p>
          </div>
        </div>
        <div className="process-grid">
          {[
            ["01", "Выберите интерьер", "Откройте офис, спортзал, отель, галерею или другое пространство и посмотрите его ракурсы."],
            ["02", "Загрузите селфи", "Подойдут обычные фото с телефона: JPG, PNG, WEBP, HEIC, HEIF или AVIF."],
            ["03", "Получите серию", "Сервис создаёт фотографии с разными позами, планами и одеждой под выбранную атмосферу."],
          ].map(([step, title, text]) => (
            <article className="process-item" key={step}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section result-section" id="result">
        <div className="result-copy">
          <p className="eyebrow">Финальный результат</p>
          <h2>{PRODUCT_IMAGES_PER_STUDIO} фото в одном выбранном пространстве</h2>
          <p>
            В серии используется {TARGET_SHOTS_PER_STUDIO} постановочных сцен. Для
            каждой сцены создаются разные дистанции камеры: ближе к объективу,
            чуть дальше, ещё дальше и общий план. Позы не повторяются механически:
            часть кадров сидячие, часть стоячие, часть в движении или relaxed.
          </p>
          <a className="button button-primary" href="#studios">
            Начать с выбора интерьера
          </a>
        </div>
        <div className="result-mosaic">
          {[
            "/studios/modern-office/master-wide.png",
            "/studios/boutique-hotel/master-wide.png",
            "/studios/premium-gym/master-wide.png",
            "/studios/art-gallery/master-wide.png",
          ].map((url) => (
            <img alt="Пример интерьера фотостудии" key={url} src={url} />
          ))}
        </div>
      </section>
    </main>
  );
}

function SetupPanel() {
  return (
    <main className="page">
      <section className="setup-panel">
        <p className="eyebrow">Нужна настройка Supabase</p>
        <h1>Добавьте переменные окружения для frontend</h1>
        <p className="lead">
          Web-приложение готово, но ему нужны URL проекта и publishable key,
          чтобы читать таблицы `studios` и `studio_shots`.
        </p>
        <code className="code">
          NEXT_PUBLIC_SUPABASE_URL=https://vplhgizzyonpwqjdzvwg.supabase.co{"\n"}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=ваш-publishable-key
        </code>
      </section>
    </main>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="page">
      <section className="error-panel">
        <p className="eyebrow">Ошибка запроса Supabase</p>
        <h1>Не удалось загрузить студии</h1>
        <p className="lead">{message}</p>
      </section>
    </main>
  );
}
