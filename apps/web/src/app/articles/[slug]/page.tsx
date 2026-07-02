import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthNavAction } from "@/app/auth-nav-action";
import {
  articleMap,
  articles,
  createArticleFaqJsonLd,
  createArticleJsonLd,
  createArticleMetadata,
} from "@/lib/articles";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = articleMap.get(slug);

  if (!article) {
    return {};
  }

  return createArticleMetadata(article);
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = articleMap.get(slug);

  if (!article) {
    notFound();
  }

  const articleJsonLd = createArticleJsonLd(article);
  const faqJsonLd = createArticleFaqJsonLd(article);

  return (
    <main className="page article-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <header className="topbar landing-topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
          <Link href="/articles">Статьи</Link>
          <Link href="/upload">Начать фотосессию</Link>
          <AuthNavAction />
        </nav>
      </header>

      <article className="article-shell">
        <header className="article-header">
          <Link className="article-back-link" href="/articles">
            Все статьи
          </Link>
          <p className="eyebrow">{article.category}</p>
          <h1>{article.title}</h1>
          <p className="lead">{article.intro}</p>
          <div className="article-meta">
            <span>{new Intl.DateTimeFormat("ru-RU").format(new Date(article.date))}</span>
            <span>{article.readTime}</span>
          </div>
        </header>

        <section className="article-showcase" aria-label="Пример AI-фотосессии до и после">
          <div className="article-showcase-column">
            <span>До</span>
            <div className="article-showcase-selfies">
              <img
                alt="Обычное селфи анфас до AI-фотосессии"
                decoding="async"
                height="1280"
                loading="lazy"
                src="/selfie-guide/01-front-neutral.webp"
                width="960"
              />
              <img
                alt="Обычное селфи в полуоборот до AI-фотосессии"
                decoding="async"
                height="1280"
                loading="lazy"
                src="/selfie-guide/03-left-three-quarter.webp"
                width="960"
              />
              <img
                alt="Обычное селфи в профиль до AI-фотосессии"
                decoding="async"
                height="1280"
                loading="lazy"
                src="/selfie-guide/05-left-profile.webp"
                width="960"
              />
            </div>
          </div>
          <div className="article-showcase-column article-showcase-column-after">
            <span>После</span>
            <div className="article-showcase-results">
              <img
                alt={`Готовое AI-фото для статьи ${article.title}`}
                decoding="async"
                height="1280"
                loading="lazy"
                src="/before-after/after-luxury-garage-01.webp"
                width="1024"
              />
              <img
                alt="Портрет после AI-фотосессии в виртуальной студии"
                decoding="async"
                height="1280"
                loading="lazy"
                src="/before-after/after-luxury-garage-02.webp"
                width="1024"
              />
              <img
                alt="AI-фотосессия после загрузки селфи"
                decoding="async"
                height="1280"
                loading="lazy"
                src="/before-after/after-luxury-garage-03.webp"
                width="1024"
              />
            </div>
          </div>
        </section>

        <div className="article-body">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        {article.faq?.length ? (
          <section className="article-faq">
            <h2>Частые вопросы</h2>
            {article.faq.map((item) => (
              <article key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </section>
        ) : null}

        <footer className="article-cta">
          <h2>Попробуйте AI-фотосессию на своих селфи</h2>
          <p>Выберите интерьер, загрузите фото и получите серию портретов онлайн.</p>
          <Link className="button button-primary" href="/upload">
            Начать фотосессию
          </Link>
        </footer>
      </article>
    </main>
  );
}
