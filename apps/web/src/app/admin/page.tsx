import Link from "next/link";
import { articles } from "@/lib/articles";

const promoCodes = [
  {
    code: "STUDIO",
    description: "Партнёрский промокод для фотостудий и outreach-рассылки.",
  },
  {
    code: "START",
    description: "Стартовый промокод: одна тестовая генерация.",
  },
  {
    code: "WELCOME",
    description: "Приветственный промокод: две тестовые генерации.",
  },
  {
    code: "FRIEND",
    description: "Промокод для механики рекомендации другу.",
  },
];

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
          <Link href="/sessions">Мои фотосессии</Link>
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
            <p className="eyebrow">Промокоды</p>
            <h2>Активные кампании</h2>
            <p>
              Базовые промокоды заведены в Supabase. Следующий шаг - добавить сюда
              создание, отключение, лимиты и статистику применений.
            </p>
          </div>
          <div className="admin-promo-list">
            {promoCodes.map((promoCode) => (
              <div key={promoCode.code}>
                <strong>{promoCode.code}</strong>
                <span>{promoCode.description}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
