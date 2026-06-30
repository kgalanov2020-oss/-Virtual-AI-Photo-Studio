import { PRODUCT_IMAGES_PER_STUDIO, TARGET_SHOTS_PER_STUDIO } from "@/lib/generation";
import { getActiveStudios } from "@/lib/studios";
import { AuthNavAction } from "./auth-nav-action";

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
  "yacht-marina": "Resort lifestyle",
  "beach-club": "Summer editorial",
  "metropolis-streets": "City editorial",
  "desert-dunes": "Desert fashion",
  "luxury-garage": "Auto luxury",
  "pit-lane-racing": "Racing editorial",
  "private-jet": "Private travel",
  "vip-airport-terminal": "VIP travel",
  "city-rooftop": "Skyline portrait",
  "fine-dining-restaurant": "Evening dining",
  "golf-club": "Country club",
  "italian-villa-garden": "Villa lifestyle",
  "paris-street": "Paris editorial",
  "tokyo-neon-night": "Neon night",
  "new-york-editorial-street": "NY street",
  "music-recording-studio": "Creative portrait",
  "cyprus-villa": "Sunny villa",
  "black-photo-studio": "Minimal fashion",
  "fashion-boutique": "Fashion editorial",
  "moroccan-riad": "Desert resort",
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
    <main className="atelier-page">
      <header className="atelier-nav">
        <a className="atelier-brand" href="/">
          <span>Virtual AI Photo Studio</span>
        </a>
        <nav aria-label="Главная навигация">
          <a href="#studios">Каталог</a>
          <AuthNavAction />
        </nav>
      </header>

      <section className="atelier-hero" id="top">
        <div className="atelier-hero-media" aria-hidden="true" />
        <div className="atelier-hero-copy">
          <h1>
            <span>Профессиональная фотосессия</span>
            <small>в выбранном интерьере</small>
          </h1>
          <p>
            Выберите готовое пространство, загрузите селфи и получите серию
            портретов с подходящей одеждой, позами, светом и атмосферой
          </p>
          <div className="atelier-actions">
            <a className="atelier-button atelier-button-light" href="#studios">
              Выбрать интерьер
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

      <section className="atelier-section before-after-section">
        <div className="before-after-grid" aria-label="Пример до и после">
          <div className="before-after-column">
            <span>До</span>
            <div className="before-after-selfies">
              <img alt="Селфи анфас" src="/selfie-guide/01-front-neutral.jpg" />
              <img alt="Селфи полуоборот" src="/selfie-guide/03-left-three-quarter.jpg" />
              <img alt="Селфи профиль" src="/selfie-guide/05-left-profile.jpg" />
            </div>
          </div>

          <div className="before-after-column before-after-column-featured">
            <span>После</span>
            <div className="before-after-results">
              <img alt="AI-фотосессия в luxury garage" src="/before-after/after-luxury-garage-01.jpg" />
              <img alt="AI-фотосессия у автомобиля" src="/before-after/after-luxury-garage-02.jpg" />
              <img alt="AI-фотосессия в премиальном гараже" src="/before-after/after-luxury-garage-03.jpg" />
              <img alt="AI-портрет в luxury garage" src="/before-after/after-luxury-garage-04.jpg" />
            </div>
          </div>
        </div>
      </section>

      <section className="atelier-section atelier-intro">
        <div>
          <h2>Каталог виртуальных студий</h2>
        </div>
        <p>Готовые пространства с продуманным светом, одеждой и позами</p>
      </section>

      <section className="atelier-section" id="studios">
        <div className="atelier-section-head atelier-section-head-reverse">
          <p>
            Внутри каждого интерьера можно посмотреть 9 ракурсов самой локации и
            начать загрузку селфи
          </p>
          <div>
            <h2>Выберите пространство для фотосессии</h2>
          </div>
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

      <footer className="atelier-footer">
        <a className="atelier-footer-brand" href="#top">
          Virtual AI Photo Studio
        </a>
        <nav aria-label="Юридическая информация">
          <a href="/oferta">Пользовательское соглашение</a>
          <a href="/privacy">Политика конфиденциальности</a>
          <a href="/personal-data-consent">Согласие на обработку персональных данных</a>
        </nav>
      </footer>
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
