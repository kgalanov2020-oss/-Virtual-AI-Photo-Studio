import type { Metadata } from "next";
import Link from "next/link";
import { AuthNavAction } from "@/app/auth-nav-action";
import { articles } from "@/lib/articles";
import { seoPages } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Карта сайта | Virtual AI Photo Studio",
  description:
    "Оглавление сайта Virtual AI Photo Studio: каталог, AI-фотосессии, виртуальная фотостудия, статьи и юридические документы.",
  alternates: {
    canonical: "https://virtualphotostudio.ru/karta-sayta",
  },
};

const mainLinks = [
  { href: "/", label: "Главная и каталог виртуальных студий" },
  { href: "/upload", label: "Создать AI-фотосессию" },
  { href: "/articles", label: "Статьи об AI-фотосессиях" },
  { href: "/login", label: "Регистрация и вход" },
  { href: "/sessions", label: "Мои фотосессии" },
];

const legalLinks = [
  { href: "/oferta", label: "Пользовательское соглашение" },
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/personal-data-consent", label: "Согласие на обработку персональных данных" },
];

export default function SiteContentsPage() {
  return (
    <main className="page contents-page">
      <header className="topbar landing-topbar">
        <Link className="brand" href="/">
          Virtual AI Photo Studio
        </Link>
        <nav className="topnav" aria-label="Навигация">
          <Link href="/">Каталог</Link>
          <Link href="/articles">Статьи</Link>
          <AuthNavAction />
        </nav>
      </header>

      <section className="contents-hero">
        <p className="eyebrow">Оглавление</p>
        <h1>Карта сайта Virtual AI Photo Studio</h1>
        <p className="lead">
          Все основные страницы, SEO-разделы, статьи и документы в одном месте.
        </p>
      </section>

      <section className="section contents-grid">
        <ContentsGroup title="Основные страницы" links={mainLinks} />
        <ContentsGroup
          title="SEO-разделы"
          links={Object.values(seoPages).map((page) => ({
            href: `/${page.slug}`,
            label: page.h1,
          }))}
        />
        <ContentsGroup
          title="Статьи"
          links={articles.map((article) => ({
            href: `/articles/${article.slug}`,
            label: article.title,
          }))}
        />
        <ContentsGroup title="Документы" links={legalLinks} />
      </section>
    </main>
  );
}

function ContentsGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <article className="contents-group">
      <h2>{title}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
