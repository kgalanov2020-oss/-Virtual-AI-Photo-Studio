import { getStudioSession } from "@/lib/studios";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await getStudioSession("modern-business-studio");

  if (result.status === "missing-env") {
    return <SetupPanel />;
  }

  if (result.status === "error") {
    return <ErrorPanel message={result.message} />;
  }

  const { studio, shots } = result;
  const outputCount = shots.reduce((total, shot) => total + shot.variations, 0);

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">Виртуальная AI Фотостудия</div>
        <div className="status">Каталог студий подключён к Supabase</div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Первая студийная сессия</p>
          <h1>{studio.name}</h1>
          <p className="lead">{studio.description}</p>
          <div className="actions">
            <a className="button button-primary" href="/upload">
              Загрузить селфи
            </a>
            <a className="button button-secondary" href="#upload-guide">
              Гайд по селфи
            </a>
          </div>
        </div>

        <div className="studio-preview" aria-label="Превью современной офисной студии">
          <div className="preview-card">
            <strong>{outputCount} готовых фото</strong>
            <span>
              {shots.length} постановочных сцен, 4 варианта на сцену, единая
              бизнес-студия.
            </span>
          </div>
        </div>
      </section>

      <section className="section" id="shots">
        <div className="section-header">
          <div>
            <h2>План съёмки</h2>
            <p>Сцены загружаются из таблицы Supabase `studio_shots`.</p>
          </div>
          <div className="count-pill">
            {shots.length} сцен / {outputCount} фото
          </div>
        </div>

        <div className="shot-grid">
          {shots.map((shot) => (
            <article className="shot-card" key={shot.id}>
              <h3>{shot.name}</h3>
              <div className="meta-list">
                <div className="meta-item">
                  <span>Поза</span>
                  {shot.pose}
                </div>
                <div className="meta-item">
                  <span>Камера</span>
                  {shot.camera_angle}
                </div>
                <div className="meta-item">
                  <span>Кадрирование</span>
                  {shot.crop}
                </div>
                <div className="meta-item">
                  <span>Результат</span>
                  {shot.variations} варианта
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="upload-guide">
        <div className="section-header">
          <div>
            <h2>Гайд по селфи</h2>
            <p>Следующий шаг: превратить этот блок в загрузку фотографий.</p>
          </div>
        </div>
        <div className="shot-grid">
          {[
            "Анфас с нейтральным выражением лица",
            "Анфас с лёгкой улыбкой",
            "Левый полуоборот",
            "Правый полуоборот",
            "Левый профиль",
            "Правый профиль",
            "Фото немного сверху",
            "Фото немного снизу",
            "Фото при дневном свете",
            "Без солнцезащитных очков и сильных теней",
          ].map((item, index) => (
            <article className="shot-card" key={item}>
              <h3>{String(index + 1).padStart(2, "0")}</h3>
              <div className="meta-item">{item}</div>
            </article>
          ))}
        </div>
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
        <h1>Не удалось загрузить студию</h1>
        <p className="lead">{message}</p>
      </section>
    </main>
  );
}
