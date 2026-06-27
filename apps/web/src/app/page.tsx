import { PRODUCT_IMAGES_PER_STUDIO, TARGET_SHOTS_PER_STUDIO } from "@/lib/generation";
import { getActiveStudios } from "@/lib/studios";

export const dynamic = "force-dynamic";

const studioLabels: Record<string, string> = {
  "modern-office": "Деловая серия",
  "premium-gym": "Спортивный lifestyle",
  "boutique-hotel": "Вечерний образ",
  "castle-library": "Классический портрет",
  "hi-tech-lab": "Технологичный стиль",
  "urban-loft": "Editorial mood",
  "luxury-penthouse": "Premium lifestyle",
  "art-gallery": "Арт-портрет",
  "wellness-spa": "Relaxed-серия",
  "executive-boardroom": "Executive portrait",
};

const selfiePreview = [
  "/selfie-guide/01-front-neutral.jpg",
  "/selfie-guide/03-left-three-quarter.jpg",
  "/selfie-guide/05-left-profile.jpg",
  "/selfie-guide/09-daylight.jpg",
];

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
    <main className="atelier-page">
      <header className="atelier-nav">
        <a className="atelier-brand" href="/">
          <span>Atelier</span>
          <em>Studio</em>
        </a>
        <nav aria-label="Главная навигация">
          <a href="#studios">Интерьеры</a>
          <a href="#process">Как работает</a>
          <a href="#selfies">Селфи</a>
        </nav>
        <a className="atelier-nav-cta" href="#studios">
          Выбрать интерьер
        </a>
      </header>

      <section className="atelier-hero">
        <div className="atelier-hero-media" aria-hidden="true" />
        <div className="atelier-hero-copy">
          <p className="atelier-kicker">
            <span />
            Виртуальная фотостудия
          </p>
          <h1>Фотосессия в интерьере, который выглядит как реальная локация</h1>
          <p>
            Выберите готовое пространство, загрузите несколько селфи и получите
            серию профессиональных портретов, снятых так, будто вы действительно
            были там.
          </p>
          <div className="atelier-actions">
            <a className="atelier-button atelier-button-light" href="#studios">
              Выбрать интерьер
            </a>
            <a
              className="atelier-button atelier-button-ghost"
              href={`/upload?studio=${featuredStudio?.slug ?? "modern-office"}`}
            >
              Загрузить селфи
            </a>
          </div>
        </div>
        <div className="atelier-hero-stats" aria-label="Параметры фотосессии">
          <span>
            <strong>{studios.length}</strong>
            интерьеров
          </span>
          <span>
            <strong>{PRODUCT_IMAGES_PER_STUDIO}</strong>
            фото
          </span>
          <span>
            <strong>{TARGET_SHOTS_PER_STUDIO}</strong>
            сцен
          </span>
        </div>
      </section>

      <section className="atelier-section atelier-intro">
        <div>
          <p className="atelier-eyebrow">Не генератор</p>
          <h2>Это каталог виртуальных студий, где каждая локация уже продумана.</h2>
        </div>
        <p>
          У каждого пространства есть свои ракурсы, свет, мебель, настроение,
          одежда и сценарии позирования. Пользователь выбирает не “эффект”, а
          атмосферу будущей съёмки.
        </p>
      </section>

      <section className="atelier-section" id="studios">
        <div className="atelier-section-head">
          <div>
            <p className="atelier-eyebrow">Интерьеры</p>
            <h2>Выберите пространство для фотосессии</h2>
          </div>
          <p>
            Внутри каждого интерьера можно посмотреть 9 ракурсов самой локации и
            начать загрузку селфи.
          </p>
        </div>

        <div className="atelier-studio-grid">
          {studios.map((studio, index) => (
            <article className="atelier-studio-tile" key={studio.id}>
              {studio.preview_url ? <img alt={studio.name} src={studio.preview_url} /> : null}
              <a href={`/studios/${studio.slug}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <em>{studioLabels[studio.slug] ?? "Портретная серия"}</em>
                  <strong>{studio.name}</strong>
                </div>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="atelier-section atelier-process" id="process">
        <div className="atelier-section-head">
          <div>
            <p className="atelier-eyebrow">Процесс</p>
            <h2>Похоже на запись в студию, только без поездки на съёмку.</h2>
          </div>
        </div>
        <div className="atelier-process-grid">
          {[
            ["01", "Выберите интерьер", "Офис, отель, спортзал, галерея, пентхаус, замок или другое пространство."],
            ["02", "Загрузите селфи", "Подойдут обычные фото с телефона при хорошем свете и без сильной ретуши."],
            ["03", "Получите серию", "40 фото в выбранном пространстве: разные позы, планы и дистанции камеры."],
          ].map(([step, title, text]) => (
            <article key={step}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="atelier-section atelier-result">
        <div className="atelier-result-media">
          <img alt="Современный офис" src="/studios/modern-office/master-wide.png" />
          <img alt="Бутик-отель" src="/studios/boutique-hotel/master-wide.png" />
        </div>
        <div className="atelier-result-copy">
          <p className="atelier-eyebrow">Результат</p>
          <h2>{PRODUCT_IMAGES_PER_STUDIO} фотографий в одном выбранном интерьере</h2>
          <p>
            Серия строится как реальная фотосессия: близкий портрет, средний план,
            дальний план и общий кадр. Одежда и позы подбираются под атмосферу
            локации.
          </p>
          <a className="atelier-button atelier-button-dark" href="#studios">
            Смотреть интерьеры
          </a>
        </div>
      </section>

      <section className="atelier-section atelier-selfies" id="selfies">
        <div>
          <p className="atelier-eyebrow">Селфи</p>
          <h2>Обычные фото с телефона, без студийной подготовки.</h2>
          <p>
            Нужны 8-10 ракурсов лица: анфас, полуобороты, профиль и несколько
            вариантов света. Это помогает сохранить похожесть в готовой серии.
          </p>
          <a
            className="atelier-button atelier-button-dark"
            href={`/upload?studio=${featuredStudio?.slug ?? "modern-office"}`}
          >
            Перейти к загрузке
          </a>
        </div>
        <div className="atelier-selfie-strip">
          {selfiePreview.map((src, index) => (
            <img alt={`Пример селфи ${index + 1}`} key={src} src={src} />
          ))}
        </div>
      </section>

      <section className="atelier-final">
        <p>Virtual AI Photo Studio</p>
        <h2>Начните с выбора интерьера.</h2>
        <a className="atelier-button atelier-button-light" href="#studios">
          Открыть каталог
        </a>
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
