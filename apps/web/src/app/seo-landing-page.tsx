import Link from "next/link";
import { AuthNavAction } from "@/app/auth-nav-action";
import {
  createFaqJsonLd,
  createServiceJsonLd,
  type SeoPage,
} from "@/lib/seo-pages";

export function SeoLandingPage({ page }: { page: SeoPage }) {
  const faqJsonLd = createFaqJsonLd(page);
  const serviceJsonLd = createServiceJsonLd(page);

  return (
    <main className="page seo-landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="topbar landing-topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
          <Link href="/">Каталог</Link>
          <Link href="/upload">Начать фотосессию</Link>
          <AuthNavAction />
        </nav>
      </header>

      <section className="seo-hero">
        <div className="seo-hero-copy">
          <p className="eyebrow">{page.primaryQuery}</p>
          <h1>{page.h1}</h1>
          <p className="lead">{page.lead}</p>
          <div className="actions">
            <Link className="button button-primary" href="/upload">
              Начать фотосессию
            </Link>
            <Link className="button button-secondary" href="/#studios">
              Смотреть локации
            </Link>
          </div>
        </div>
        <div className="seo-hero-media" aria-label="Пример AI-фотосессии до и после">
          <img alt="Селфи до AI-фотосессии" src="/selfie-guide/01-front-neutral.webp" />
          <img alt="Профессиональный AI-портрет после обработки" src="/before-after/after-luxury-garage-01.webp" />
        </div>
      </section>

      <section className="section seo-content-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Как работает</p>
            <h2>Фотосессия без студии и фотографа</h2>
          </div>
        </div>
        <div className="seo-steps">
          <article>
            <span>01</span>
            <h3>Выберите интерьер</h3>
            <p>Офис, отель, пляж, яхта, ресторан, городская улица или fashion-студия.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Загрузите селфи</h3>
            <p>Добавьте несколько фото лица с разных ракурсов, сделанных на телефон.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Получите серию</h3>
            <p>Сервис создаст портреты с подходящей одеждой, светом, позами и атмосферой.</p>
          </article>
        </div>
      </section>

      <section className="section seo-split-section">
        <div>
          <p className="eyebrow">Преимущества</p>
          <h2>Почему это удобно</h2>
        </div>
        <ul className="seo-list">
          {page.benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </section>

      <section className="section seo-split-section">
        <div>
          <p className="eyebrow">Для чего подходит</p>
          <h2>Где использовать фото</h2>
        </div>
        <ul className="seo-list">
          {page.useCases.map((useCase) => (
            <li key={useCase}>{useCase}</li>
          ))}
        </ul>
      </section>

      <section className="section seo-faq-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>Частые вопросы</h2>
          </div>
        </div>
        <div className="seo-faq-list">
          {page.faq.map((item) => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section seo-final-cta">
        <h2>Попробуйте Virtual AI Photo Studio</h2>
        <p>Выберите локацию, загрузите селфи и получите готовую AI-фотосессию онлайн.</p>
        <Link className="button button-primary" href="/upload">
          Создать фотосессию
        </Link>
      </section>
    </main>
  );
}
