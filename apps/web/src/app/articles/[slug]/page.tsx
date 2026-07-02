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

type ArticleShowcase = {
  before: string[];
  after: string[];
};

const selfieImages = [
  "/selfie-guide/01-front-neutral.webp",
  "/selfie-guide/02-front-smile.webp",
  "/selfie-guide/03-left-three-quarter.webp",
  "/selfie-guide/04-right-three-quarter.webp",
  "/selfie-guide/05-left-profile.webp",
  "/selfie-guide/06-right-profile.webp",
  "/selfie-guide/07-from-above.webp",
  "/selfie-guide/08-from-below.webp",
  "/selfie-guide/09-daylight.webp",
  "/selfie-guide/10-clean-face.webp",
];

const beforeSets = [
  [0, 2, 4],
  [1, 3, 5],
  [0, 6, 9],
  [1, 7, 8],
  [2, 5, 9],
  [3, 4, 8],
  [0, 3, 7],
  [1, 4, 6],
  [2, 6, 8],
  [5, 7, 9],
  [0, 5, 8],
  [1, 2, 7],
  [3, 6, 9],
  [4, 7, 8],
  [0, 1, 5],
  [2, 3, 9],
  [4, 5, 6],
  [0, 7, 8],
  [1, 6, 9],
  [2, 4, 7],
];

const articleShowcases = new Map<string, ArticleShowcase>(
  articles.map((article, index) => {
    return [
      article.slug,
      {
        before: beforeSets[index].map((imageIndex) => selfieImages[imageIndex]),
        after: [`/article-showcases/after-${String(index + 1).padStart(2, "0")}.webp`],
      },
    ];
  }),
);

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
  const showcase = articleShowcases.get(article.slug);

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

        {showcase ? (
          <section className="article-showcase" aria-label="Пример AI-фотосессии до и после">
            <div className="article-showcase-column">
              <span>До</span>
              <div className="article-showcase-selfies">
                {showcase.before.map((image, index) => (
                  <img
                    alt={`Исходное селфи ${index + 1} до AI-фотосессии`}
                    decoding="async"
                    height="1280"
                    key={image}
                    loading="lazy"
                    src={image}
                    width="960"
                  />
                ))}
              </div>
            </div>
            <div className="article-showcase-column article-showcase-column-after">
              <span>После</span>
              <div className="article-showcase-results">
                {showcase.after.map((image, index) => (
                  <img
                    alt={`Готовое AI-фото ${index + 1} для статьи ${article.title}`}
                    decoding="async"
                    height="1280"
                    key={image}
                    loading="lazy"
                    src={image}
                    width="1024"
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

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
