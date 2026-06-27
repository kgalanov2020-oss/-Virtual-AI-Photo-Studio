import { PRODUCT_IMAGES_PER_STUDIO, TARGET_SHOTS_PER_STUDIO } from "@/lib/generation";
import { getActiveStudios, getStudioSession } from "@/lib/studios";

export const dynamic = "force-dynamic";

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
  const featuredResult = featuredStudio
    ? await getStudioSession(featuredStudio.slug)
    : null;
  const shots = featuredResult?.status === "ok" ? featuredResult.shots : [];

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">Виртуальная AI Фотостудия</div>
        <div className="status">Каталог интерьеров подключён к Supabase</div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Выберите интерьер для фотосессии</p>
          <h1>AI-фотосессия в выбранном пространстве</h1>
          <p className="lead">
            Пользователь выбирает интерьер: офис, студия, отель, замок, hi-tech и
            другие пространства. Затем загружает селфи и получает полную серию из
            {` ${PRODUCT_IMAGES_PER_STUDIO} `}фото в единой визуальной среде.
          </p>
          <div className="actions">
            <a className="button button-primary" href={`/upload?studio=${featuredStudio?.slug ?? "modern-office"}`}>
              Загрузить селфи
            </a>
            <a className="button button-secondary" href="#studios">
              Все интерьеры
            </a>
          </div>
        </div>

        <div className="studio-preview" aria-label="Превью современного офисного интерьера">
          <div className="preview-card">
            <strong>{PRODUCT_IMAGES_PER_STUDIO} фото в финальной серии</strong>
            <span>
              {TARGET_SHOTS_PER_STUDIO} разных кадров: 10 позиций и по 4 дистанции
              для каждой позиции.
            </span>
          </div>
        </div>
      </section>

      <section className="section" id="studios">
        <div className="section-header">
          <div>
            <h2>Интерьеры</h2>
            <p>Каждый интерьер хранит собственные 40 кадров для фотосессии.</p>
          </div>
          <div className="count-pill">{studios.length} студий</div>
        </div>

        <div className="studio-grid">
          {studios.map((studio) => (
            <article className="studio-card" key={studio.id}>
              {studio.preview_url ? (
                <img alt={studio.name} src={studio.preview_url} />
              ) : (
                <div className="studio-card-placeholder">{studio.name}</div>
              )}
              <div>
                <h3>{studio.name}</h3>
                <p>{studio.description}</p>
                <a className="button button-secondary" href={`/studios/${studio.slug}`}>
                  Смотреть интерьер
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="modern-office-preview">
        <div className="section-header">
          <div>
            <h2>Modern Office preview</h2>
            <p>9 изображений офиса для лендинга и визуального направления студии.</p>
          </div>
        </div>
        <div className="office-mosaic">
          {[
            "master-wide",
            "lounge-corner",
            "executive-desk",
            "window-zone",
            "presentation-corner",
            "corridor-walk",
            "dark-portrait-corner",
            "detail-shot",
            "alternate-wide",
          ].map((name) => (
            <img
              alt={`Modern Office ${name}`}
              key={name}
              src={`/studios/modern-office/${name}.png`}
            />
          ))}
        </div>
      </section>

      {shots.length > 0 ? (
        <section className="section" id="shots">
          <div className="section-header">
            <div>
              <h2>Сцены Modern Office</h2>
              <p>
                {PRODUCT_IMAGES_PER_STUDIO} кадров: 10 разных поз и 4 дистанции
                камеры для каждой позы.
              </p>
            </div>
          </div>

          <div className="shot-grid">
            {shots.slice(0, TARGET_SHOTS_PER_STUDIO).map((shot) => (
              <article className="shot-card" key={shot.id}>
                <h3>{shot.name}</h3>
                <div className="meta-list">
                  <div className="meta-item">
                    <span>Поза</span>
                    {shot.pose}
                  </div>
                  <div className="meta-item">
                    <span>Камера</span>
                    {shot.camera_angle}
                  </div>
                  <div className="meta-item">
                    <span>Кадрирование</span>
                    {shot.crop}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section" id="upload-guide">
        <div className="section-header">
          <div>
            <h2>Гайд по селфи</h2>
            <p>Следующий шаг: превратить этот блок в загрузку фотографий.</p>
          </div>
        </div>
        <div className="shot-grid">
          {[
            "Анфас с нейтральным выражением лица",
            "Анфас с лёгкой улыбкой",
            "Левый полуоборот",
            "Правый полуоборот",
            "Левый профиль",
            "Правый профиль",
            "Фото немного сверху",
            "Фото немного снизу",
            "Фото при дневном свете",
            "Без солнцезащитных очков и сильных теней",
          ].map((item, index) => (
            <article className="shot-card" key={item}>
              <h3>{String(index + 1).padStart(2, "0")}</h3>
              <div className="meta-item">{item}</div>
            </article>
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
        <h1>Не удалось загрузить студию</h1>
        <p className="lead">{message}</p>
      </section>
    </main>
  );
}
