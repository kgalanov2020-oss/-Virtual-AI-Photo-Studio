import type { Metadata } from "next";
import Link from "next/link";
import { AuthNavAction } from "@/app/auth-nav-action";
import { articles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Статьи об AI-фотосессиях | Virtual AI Photo Studio",
  description:
    "Практические статьи о виртуальной фотостудии, AI-фотосессиях по селфи, деловых фото, качестве генерации и новых сервисах для фотостудий.",
  alternates: {
    canonical: "https://virtualphotostudio.ru/articles",
  },
};

export default function ArticlesPage() {
  return (
    <main className="page articles-page">
      <header className="topbar landing-topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
          <Link href="/">Каталог</Link>
          <Link href="/karta-sayta">Оглавление</Link>
          <Link href="/upload">Начать фотосессию</Link>
          <AuthNavAction />
        </nav>
      </header>

      <section className="articles-hero">
        <p className="eyebrow">Блог</p>
        <h1>Статьи об AI-фотосессиях и виртуальной фотостудии</h1>
        <p className="lead">
          Разбираем, как работают фото по селфи, где использовать AI-портреты,
          чем виртуальная фотостудия отличается от обычной и как такой формат
          может помогать бизнесу.
        </p>
        <div className="actions">
          <Link className="button button-secondary" href="/karta-sayta">
            Открыть оглавление сайта
          </Link>
        </div>
      </section>

      <section className="section articles-grid-section">
        <div className="articles-grid">
          {articles.map((article) => (
            <Link className="article-card" href={`/articles/${article.slug}`} key={article.slug}>
              <span>{article.category}</span>
              <h2>{article.title}</h2>
              <p>{article.description}</p>
              <em>{article.readTime}</em>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
