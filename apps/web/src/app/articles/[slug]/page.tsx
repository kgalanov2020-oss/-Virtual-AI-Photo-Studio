import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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

type ArticleExampleImage = {
  alt: string;
  src: string;
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

const exampleGroups: ArticleExampleImage[][] = [
  [
    { src: "/article-location-examples/yacht-01.webp", alt: "AI-фото на яхте у причала" },
    { src: "/article-location-examples/yacht-02.webp", alt: "AI-фото в морской локации" },
    { src: "/article-location-examples/villa-01.webp", alt: "AI-фото у бассейна на вилле" },
    { src: "/article-location-examples/villa-02.webp", alt: "AI-фото в светлой курортной локации" },
  ],
  [
    { src: "/article-location-examples/restaurant-01.webp", alt: "AI-фото в ресторане fine dining" },
    { src: "/article-location-examples/restaurant-02.webp", alt: "AI-фото за столом в премиальном ресторане" },
    { src: "/article-location-examples/pink-studio-01.webp", alt: "AI-фото в современной розовой студии" },
    { src: "/article-location-examples/pink-studio-02.webp", alt: "AI-фото в fashion-студии с мягким светом" },
  ],
  [
    { src: "/article-location-examples/desert-01.webp", alt: "AI-фото в пустынной локации" },
    { src: "/article-location-examples/desert-02.webp", alt: "AI-фото на фоне песчаных дюн" },
    { src: "/article-location-examples/riad-01.webp", alt: "AI-фото в марокканском riad" },
    { src: "/article-location-examples/riad-02.webp", alt: "AI-фото у каменной арки" },
  ],
  [
    { src: "/article-location-examples/jet-01.webp", alt: "AI-фото в бизнес-джете" },
    { src: "/article-location-examples/jet-02.webp", alt: "AI-фото в салоне частного самолёта" },
    { src: "/article-location-examples/yacht-03.webp", alt: "AI-фото на палубе яхты" },
    { src: "/article-location-examples/villa-03.webp", alt: "AI-фото на вилле у моря" },
  ],
  [
    { src: "/article-location-examples/pink-studio-03.webp", alt: "AI-фото в розовой циклораме" },
    { src: "/article-location-examples/pink-studio-04.webp", alt: "AI-фото в стильной пастельной студии" },
    { src: "/article-location-examples/restaurant-03.webp", alt: "AI-фото в вечернем ресторане" },
    { src: "/article-location-examples/riad-03.webp", alt: "AI-фото в тёплой архитектурной локации" },
  ],
  [
    { src: "/article-location-examples/desert-03.webp", alt: "AI-фото в luxury travel стиле" },
    { src: "/article-location-examples/desert-04.webp", alt: "AI-фото на закате в пустыне" },
    { src: "/article-location-examples/jet-03.webp", alt: "AI-фото в приватной деловой локации" },
    { src: "/article-location-examples/jet-04.webp", alt: "AI-фото в кресле бизнес-джета" },
  ],
  [
    { src: "/article-location-examples/villa-04.webp", alt: "AI-фото у бассейна на курорте" },
    { src: "/article-location-examples/yacht-04.webp", alt: "AI-фото на яхте в отпускном стиле" },
    { src: "/article-location-examples/riad-04.webp", alt: "AI-фото в южной вилле с арками" },
    { src: "/article-location-examples/restaurant-04.webp", alt: "AI-фото в камерном ресторане" },
  ],
];

const articleExampleImages = new Map<string, ArticleExampleImage[]>(
  articles.map((article, index) => [article.slug, exampleGroups[index % exampleGroups.length]]),
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
  const examples = articleExampleImages.get(article.slug) ?? [];

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
          <Link href="/admin">Админ</Link>
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
                {showcase.before.slice(0, 1).map((image, index) => (
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

        {examples.length ? (
          <section className="article-example-strip" aria-label="Дополнительные примеры AI-фотосессий">
            <div className="article-example-strip-copy">
              <span>Ещё примеры результата</span>
              <p>
                Эти кадры показывают, как один и тот же подход работает в разных локациях:
                яхта, вилла, ресторан, студия, riad, пустыня и бизнес-джет.
              </p>
            </div>
            <div className="article-example-grid">
              {examples.map((image) => (
                <img
                  alt={image.alt}
                  decoding="async"
                  height="1280"
                  key={image.src}
                  loading="lazy"
                  src={image.src}
                  width="960"
                />
              ))}
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

      </article>
    </main>
  );
}
