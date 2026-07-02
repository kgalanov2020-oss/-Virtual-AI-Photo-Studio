import Link from "next/link";
import { articles } from "@/lib/articles";
import { ArticlePublicationPanel } from "./article-publication-panel";
import { PromoCodePanel } from "./promo-code-panel";

export default function AdminPage() {
  return (
    <main className="page admin-page">
      <header className="topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Админ-навигация">
          <Link href="/outreach">Рассылка</Link>
          <Link href="/articles">Статьи</Link>
        </nav>
      </header>

      <section className="upload-layout">
        <div className="upload-copy">
          <p className="eyebrow">Админ-панель</p>
          <h1>Управление проектом</h1>
          <p>
            Единая точка для партнёрской рассылки, найденных студий, SEO-статей и
            промокодов. Чувствительные действия остаются защищены админ-токеном.
          </p>
        </div>
      </section>

      <section className="admin-grid">
        <article className="section admin-card">
          <div>
            <p className="eyebrow">Outreach</p>
            <h2>Парсинг и рассылка</h2>
            <p>
              Просмотр лидов, фильтр по email, ручная отправка, удаление и контроль
              автоматической отправки через Render Cron.
            </p>
          </div>
          <Link className="button button-primary" href="/outreach">
            Открыть рассылку
          </Link>
        </article>

        <article className="section admin-card">
          <div>
            <p className="eyebrow">SEO</p>
            <h2>Статьи</h2>
            <p>
              Сейчас опубликовано {articles.length} статей. Здесь будем держать
              управление темами, статусами публикации и визуальными примерами.
            </p>
          </div>
          <Link className="button button-secondary" href="/articles">
            Открыть статьи
          </Link>
        </article>

        <article className="section admin-card admin-card-wide">
          <div>
            <p className="eyebrow">Публикации статей</p>
            <h2>Где размещены материалы</h2>
            <p>
              Вносите ссылки на Дзен, VC, Telegram, партнёрские сайты и другие
              площадки, чтобы видеть, какие статьи уже опубликованы вне сайта.
            </p>
          </div>
          <ArticlePublicationPanel
            articles={articles.map((article) => ({
              slug: article.slug,
              title: article.title,
            }))}
          />
        </article>

        <article className="section admin-card admin-card-wide">
          <div>
            <p className="eyebrow">Промокоды</p>
            <h2>Активные кампании</h2>
            <p>
              Создавайте промокоды, задавайте количество фото, общий лимит применений,
              срок действия и включайте или отключайте кампании.
            </p>
          </div>
          <PromoCodePanel />
        </article>
      </section>
    </main>
  );
}
